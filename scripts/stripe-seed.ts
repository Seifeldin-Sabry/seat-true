/**
 * Creates or updates SeatTrue's Stripe products, prices and billing portal
 * configuration on whatever account STRIPE_SECRET_KEY points at (sandbox or
 * live). Safe to re-run: everything is looked up first and never duplicated.
 *
 *   bun run stripe:seed
 *
 * Prints the IDs; set STRIPE_PORTAL_CONFIG_ID to the printed portal ID.
 */
import { plans } from "@seattrue/billing";
import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
if (!secretKey) {
  console.error("STRIPE_SECRET_KEY is not set.");
  process.exit(1);
}
const stripe = new Stripe(secretKey, { maxNetworkRetries: 2 });
const mode = secretKey.startsWith("sk_live_") ? "LIVE" : "test/sandbox";
console.log(`Seeding SeatTrue billing on the ${mode} Stripe account…`);

async function ensureProduct(id: string, name: string, description: string) {
  try {
    const product = await stripe.products.retrieve(id);
    if (!product.active || product.name !== name) {
      return stripe.products.update(id, { active: true, name, description });
    }
    return product;
  } catch (error) {
    if (!(error instanceof Stripe.errors.StripeInvalidRequestError))
      throw error;
    return stripe.products.create(
      { id, name, description },
      { idempotencyKey: `seed:product:${id}` },
    );
  }
}

async function ensurePrice(
  productId: string,
  lookupKey: string,
  unitAmount: number,
) {
  const existing = await stripe.prices.list({
    lookup_keys: [lookupKey],
    active: true,
    limit: 1,
  });
  const current = existing.data[0];
  if (
    current &&
    current.unit_amount === unitAmount &&
    current.currency === "usd" &&
    current.recurring?.interval === "month" &&
    (typeof current.product === "string"
      ? current.product
      : current.product.id) === productId
  ) {
    return current;
  }
  // Amount changed: a new price takes over the lookup key; old subscribers
  // keep their old price until moved.
  return stripe.prices.create(
    {
      product: productId,
      currency: "usd",
      unit_amount: unitAmount,
      recurring: { interval: "month" },
      lookup_key: lookupKey,
      transfer_lookup_key: true,
      tax_behavior: "exclusive",
    },
    { idempotencyKey: `seed:price:${lookupKey}:${unitAmount}` },
  );
}

const seeded: { productId: string; priceId: string }[] = [];
for (const plan of plans) {
  const product = await ensureProduct(
    plan.productId,
    `SeatTrue ${plan.name}`,
    plan.description,
  );
  const price = await ensurePrice(product.id, plan.lookupKey, plan.unitAmount);
  seeded.push({ productId: product.id, priceId: price.id });
  console.log(
    `${plan.lookupKey}: product ${product.id}, price ${price.id} (${plan.unitAmount / 100} USD/month)`,
  );
}

/**
 * Portal: switch Solo <-> Team (upgrades invoiced now, downgrades at period
 * end, so no credits), cancel at period end without proration, update card,
 * address and tax ID, see invoices. No refunds anywhere.
 */
const portalParams: Stripe.BillingPortal.ConfigurationCreateParams = {
  metadata: { app: "seattrue" },
  business_profile: {
    headline:
      "SeatTrue billing: cancel any time, access until the end of the paid period.",
  },
  features: {
    customer_update: {
      enabled: true,
      allowed_updates: ["email", "address", "tax_id", "name"],
    },
    payment_method_update: { enabled: true },
    invoice_history: { enabled: true },
    subscription_cancel: {
      enabled: true,
      mode: "at_period_end",
      proration_behavior: "none",
    },
    subscription_update: {
      enabled: true,
      default_allowed_updates: ["price"],
      proration_behavior: "always_invoice",
      products: seeded.map(({ productId, priceId }) => ({
        product: productId,
        prices: [priceId],
      })),
      schedule_at_period_end: {
        conditions: [{ type: "decreasing_item_amount" }],
      },
    },
  },
};

const configurations = await stripe.billingPortal.configurations.list({
  limit: 100,
});
const existingPortal = configurations.data.find(
  (configuration) =>
    configuration.metadata?.app === "seattrue" && configuration.active,
);
const portal = existingPortal
  ? await stripe.billingPortal.configurations.update(
      existingPortal.id,
      portalParams,
    )
  : await stripe.billingPortal.configurations.create(portalParams, {
      idempotencyKey: `seed:portal:seattrue:${seeded.map((entry) => entry.priceId).join(",")}`,
    });

console.log(`Billing portal configuration: ${portal.id}`);
console.log(
  `Next: bun run secrets:set STRIPE_PORTAL_CONFIG_ID "${portal.id}" (production) or add it to .env (local).`,
);
