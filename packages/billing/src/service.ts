import {
  billingCustomers,
  billingSubscriptions,
  billingWebhookEvents,
  type Database,
} from "@seattrue/db";
import { desc, eq, sql } from "drizzle-orm";
import Stripe from "stripe";
import { type Access, accessFor } from "./access";
import type { BillingEnvironment } from "./env";
import {
  type PlanId,
  planById,
  planByLookupKey,
  planLookupKeys,
  plans,
} from "./plans";

export class ExistingSubscriptionError extends Error {
  constructor() {
    super("Manage the existing subscription in the billing portal.");
    this.name = "ExistingSubscriptionError";
  }
}

export class BillingPriceConfigurationError extends Error {
  constructor(lookupKey: string) {
    super(
      `No active recurring Stripe Price with lookup key ${lookupKey}. Run scripts/stripe-seed.ts against this Stripe account.`,
    );
    this.name = "BillingPriceConfigurationError";
  }
}

/** Statuses that already hold a plan: a second Checkout is refused. */
const blockingSubscriptionStatuses = new Set([
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "incomplete",
  "paused",
]);

const handledEvents = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
  "invoice.paid",
  "invoice.payment_failed",
  "invoice.payment_action_required",
]);

export type BillingOverview = {
  enabled: true;
  plans: Array<{
    id: PlanId;
    name: string;
    description: string;
    amount: number | null;
    currency: string;
    interval: string | null;
  }>;
  subscription: {
    status: string;
    planId: PlanId | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
    pastDueSince: string | null;
    actionUrl: string | null;
  } | null;
  access: Access;
};

type BillingUser = { id: string; email: string };
type SubscriptionRow = typeof billingSubscriptions.$inferSelect;

function stripeId(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : (value?.id ?? null);
}

function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  return stripeId(invoice.parent?.subscription_details?.subscription);
}

function newestRelevant(rows: SubscriptionRow[]): SubscriptionRow | null {
  return (
    rows.find((row) => blockingSubscriptionStatuses.has(row.status)) ??
    rows[0] ??
    null
  );
}

/**
 * Subscription billing on Stripe Checkout + Billing Portal. Stripe charges
 * automatically and emails receipts and invoices; nothing here issues credits
 * or refunds. Every POST to Stripe carries an idempotency key.
 */
export function createBillingService(
  db: Database,
  config: BillingEnvironment,
  stripe = new Stripe(config.secretKey, { maxNetworkRetries: 2 }),
) {
  let priceCache: Map<string, Stripe.Price> | null = null;

  async function prices(): Promise<Map<string, Stripe.Price>> {
    if (priceCache) return priceCache;
    const listed = await stripe.prices.list({
      lookup_keys: [...planLookupKeys],
      active: true,
      expand: ["data.product"],
      limit: 10,
    });
    const byKey = new Map<string, Stripe.Price>();
    for (const price of listed.data) {
      if (price.lookup_key && price.recurring)
        byKey.set(price.lookup_key, price);
    }
    for (const key of planLookupKeys) {
      if (!byKey.has(key)) throw new BillingPriceConfigurationError(key);
    }
    priceCache = byKey;
    return byKey;
  }

  async function customerFor(user: BillingUser): Promise<string> {
    const existing = await db
      .select({ stripeCustomerId: billingCustomers.stripeCustomerId })
      .from(billingCustomers)
      .where(eq(billingCustomers.userId, user.id))
      .limit(1);
    if (existing[0]) return existing[0].stripeCustomerId;

    // Stripe's idempotency key covers concurrent first checkouts and retries if
    // customer creation succeeds but the database write fails.
    const created = await stripe.customers.create(
      { email: user.email, metadata: { userId: user.id } },
      { idempotencyKey: `customer:${user.id}` },
    );
    await db
      .insert(billingCustomers)
      .values({ userId: user.id, stripeCustomerId: created.id })
      .onConflictDoNothing();

    const stored = await db
      .select({ stripeCustomerId: billingCustomers.stripeCustomerId })
      .from(billingCustomers)
      .where(eq(billingCustomers.userId, user.id))
      .limit(1);
    if (!stored[0])
      throw new Error("Could not persist Stripe customer mapping");
    return stored[0].stripeCustomerId;
  }

  async function subscriptionRows(userId: string) {
    return db
      .select()
      .from(billingSubscriptions)
      .where(eq(billingSubscriptions.userId, userId))
      .orderBy(desc(billingSubscriptions.updatedAt));
  }

  async function access(userId: string, now = new Date()): Promise<Access> {
    return accessFor(newestRelevant(await subscriptionRows(userId)), now);
  }

  async function overview(userId: string): Promise<BillingOverview> {
    const [byKey, rows] = await Promise.all([
      prices(),
      subscriptionRows(userId),
    ]);
    const current = newestRelevant(rows);
    return {
      enabled: true,
      plans: plans.map((plan) => {
        const price = byKey.get(plan.lookupKey);
        return {
          id: plan.id,
          name: plan.name,
          description: plan.description,
          amount: price?.unit_amount ?? null,
          currency: price?.currency ?? "usd",
          interval: price?.recurring?.interval ?? null,
        };
      }),
      subscription: current
        ? {
            status: current.status,
            planId: planByLookupKey(current.planLookupKey)?.id ?? null,
            currentPeriodEnd: current.currentPeriodEnd?.toISOString() ?? null,
            cancelAtPeriodEnd: current.cancelAtPeriodEnd,
            pastDueSince: current.pastDueSince?.toISOString() ?? null,
            actionUrl: current.actionUrl,
          }
        : null,
      access: accessFor(current),
    };
  }

  /**
   * One plan per workspace. A transaction-scoped advisory lock serializes
   * Checkout creation; an existing plan sends the user to the portal instead,
   * and an open session is reused rather than creating a second payable one.
   */
  async function checkout(
    user: BillingUser,
    planId: PlanId,
    attemptId: string = crypto.randomUUID(),
  ) {
    const plan = planById(planId);
    const price = (await prices()).get(plan.lookupKey);
    if (!price) throw new BillingPriceConfigurationError(plan.lookupKey);
    const priceIds = new Set(
      [...(await prices()).values()].map((entry) => entry.id),
    );
    const customer = await customerFor(user);

    return db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(871302, hashtext(${user.id}))`,
      );

      const stored = await tx
        .select({ status: billingSubscriptions.status })
        .from(billingSubscriptions)
        .where(eq(billingSubscriptions.userId, user.id));
      if (stored.some((row) => blockingSubscriptionStatuses.has(row.status))) {
        throw new ExistingSubscriptionError();
      }

      // Stripe is authoritative if a completed Checkout precedes the webhook.
      const live = await stripe.subscriptions.list({
        customer,
        status: "all",
        limit: 100,
      });
      if (
        live.data.some(
          (subscription) =>
            blockingSubscriptionStatuses.has(subscription.status) &&
            subscription.items.data.some((item) => priceIds.has(item.price.id)),
        )
      ) {
        throw new ExistingSubscriptionError();
      }

      const [pending] = await tx
        .select({
          id: billingCustomers.pendingSubscriptionCheckoutId,
          expiresAt: billingCustomers.pendingSubscriptionCheckoutExpiresAt,
        })
        .from(billingCustomers)
        .where(eq(billingCustomers.userId, user.id))
        .limit(1);
      if (
        pending?.id &&
        pending.expiresAt &&
        pending.expiresAt.getTime() > Date.now()
      ) {
        const session = await stripe.checkout.sessions.retrieve(pending.id);
        if (
          stripeId(session.customer) !== customer ||
          session.metadata?.userId !== user.id
        ) {
          throw new Error(
            "Pending Checkout customer mapping does not match user",
          );
        }
        if (
          session.status === "open" &&
          session.url &&
          session.metadata?.planLookupKey === plan.lookupKey
        ) {
          return { url: session.url };
        }
        if (session.status === "open") {
          await stripe.checkout.sessions.expire(session.id, undefined, {
            idempotencyKey: `checkout-expire:${session.id}`,
          });
        }
      }

      const metadata = { userId: user.id, planLookupKey: plan.lookupKey };
      const session = await stripe.checkout.sessions.create(
        {
          mode: "subscription",
          customer,
          client_reference_id: user.id,
          line_items: [{ price: price.id, quantity: 1 }],
          success_url: `${config.appOrigin}/app/billing?checkout=success`,
          cancel_url: `${config.appOrigin}/app/billing?checkout=cancelled`,
          metadata,
          subscription_data: { metadata },
          customer_update: { address: "auto", name: "auto" },
          tax_id_collection: { enabled: true },
        },
        {
          idempotencyKey: `checkout:${user.id}:${plan.lookupKey}:${attemptId}`,
        },
      );
      if (!session.url)
        throw new Error("Stripe Checkout returned no hosted URL");
      await tx
        .update(billingCustomers)
        .set({
          pendingSubscriptionCheckoutId: session.id,
          pendingSubscriptionCheckoutExpiresAt: new Date(
            session.expires_at * 1000,
          ),
        })
        .where(eq(billingCustomers.userId, user.id));
      return { url: session.url };
    });
  }

  async function portal(
    userId: string,
    attemptId: string = crypto.randomUUID(),
  ) {
    const [customer] = await db
      .select({ stripeCustomerId: billingCustomers.stripeCustomerId })
      .from(billingCustomers)
      .where(eq(billingCustomers.userId, userId))
      .limit(1);
    if (!customer) return null;

    const session = await stripe.billingPortal.sessions.create(
      {
        customer: customer.stripeCustomerId,
        return_url: `${config.appOrigin}/app/billing`,
        ...(config.portalConfigurationId
          ? { configuration: config.portalConfigurationId }
          : {}),
      },
      { idempotencyKey: `portal:${userId}:${attemptId}` },
    );
    return { url: session.url };
  }

  async function verifyWebhook(
    rawBody: string,
    signature: string,
  ): Promise<Stripe.Event> {
    return stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      config.webhookSecret,
    );
  }

  function subscriptionIdFor(event: Stripe.Event): string | null {
    const object = event.data.object as { object?: string };
    if (object.object === "subscription")
      return (event.data.object as Stripe.Subscription).id;
    if (object.object === "invoice")
      return invoiceSubscriptionId(event.data.object as Stripe.Invoice);
    if (object.object === "checkout.session") {
      const session = event.data.object as Stripe.Checkout.Session;
      return session.mode === "subscription"
        ? stripeId(session.subscription)
        : null;
    }
    return null;
  }

  /**
   * Idempotent and order-independent: the event id is recorded in the same
   * transaction as its effects (duplicates are skipped), and state always comes
   * from re-fetching the subscription, never from the possibly stale payload.
   * Errors propagate so the route returns 5xx and Stripe retries.
   */
  async function processWebhook(event: Stripe.Event): Promise<void> {
    if (!handledEvents.has(event.type)) return;
    const subscriptionId = subscriptionIdFor(event);
    if (!subscriptionId) return;
    const eventAt = new Date(event.created * 1000);

    await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(871304, hashtext(${subscriptionId}))`,
      );
      const inserted = await tx
        .insert(billingWebhookEvents)
        .values({ stripeEventId: event.id, type: event.type })
        .onConflictDoNothing()
        .returning({ stripeEventId: billingWebhookEvents.stripeEventId });
      if (!inserted.length) return;

      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const customerId = stripeId(subscription.customer);
      if (!customerId) throw new Error("Subscription has no Stripe customer");

      const [owner] = await tx
        .select({ userId: billingCustomers.userId })
        .from(billingCustomers)
        .where(eq(billingCustomers.stripeCustomerId, customerId))
        .limit(1);
      if (!owner) return; // Other activity on the same Stripe account.

      const item = subscription.items.data.find((entry) =>
        planByLookupKey(entry.price.lookup_key),
      );
      if (!item) {
        // Plan moved away from SeatTrue prices: drop local entitlement.
        await tx
          .delete(billingSubscriptions)
          .where(
            eq(billingSubscriptions.stripeSubscriptionId, subscription.id),
          );
        return;
      }

      const [previous] = await tx
        .select()
        .from(billingSubscriptions)
        .where(eq(billingSubscriptions.stripeSubscriptionId, subscription.id))
        .limit(1);
      const isNewest =
        !previous?.lastEventAt || eventAt >= previous.lastEventAt;

      // The action URL comes from the invoice in this event, so only the
      // newest invoice event may set or clear it.
      let actionUrl = previous?.actionUrl ?? null;
      if (isNewest && event.type === "invoice.payment_action_required") {
        actionUrl =
          (event.data.object as Stripe.Invoice).hosted_invoice_url ?? null;
      }
      if (
        subscription.status !== "past_due" &&
        subscription.status !== "incomplete"
      ) {
        actionUrl = null;
      }

      const state = {
        stripeSubscriptionId: subscription.id,
        userId: owner.userId,
        stripeCustomerId: customerId,
        priceId: item.price.id,
        planLookupKey: item.price.lookup_key,
        status: subscription.status,
        currentPeriodEnd: item.current_period_end
          ? new Date(item.current_period_end * 1000)
          : null,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        pastDueSince:
          subscription.status === "past_due"
            ? (previous?.pastDueSince ?? eventAt)
            : null,
        actionUrl,
        lastEventAt:
          previous?.lastEventAt && previous.lastEventAt > eventAt
            ? previous.lastEventAt
            : eventAt,
        updatedAt: new Date(),
      };
      await tx.insert(billingSubscriptions).values(state).onConflictDoUpdate({
        target: billingSubscriptions.stripeSubscriptionId,
        set: state,
      });
    });
  }

  return { overview, access, checkout, portal, verifyWebhook, processWebhook };
}

export type BillingService = ReturnType<typeof createBillingService>;
