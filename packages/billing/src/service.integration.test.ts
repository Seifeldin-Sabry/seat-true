import { expect, test } from "bun:test";
import {
  billingSubscriptions,
  billingWebhookEvents,
  createDatabase,
  organization,
} from "@seattrue/db";
import { eq, inArray } from "drizzle-orm";
import type Stripe from "stripe";
import type { BillingEnvironment } from "./env";
import {
  BillingPriceConfigurationError,
  createBillingService,
  ExistingSubscriptionError,
} from "./service";

const databaseTest = process.env.TEST_DATABASE_URL ? test : test.skip;

const config: BillingEnvironment = {
  secretKey: "sk_test_fake",
  webhookSecret: "whsec_fake",
  portalConfigurationId: "bpc_test_portal",
  appOrigin: "http://localhost:3000",
};

type Call = {
  method: string;
  params: unknown;
  idempotencyKey: string | undefined;
};

/** Minimal in-memory Stripe that records every call and its idempotency key. */
function fakeStripe(suffix: string) {
  const calls: Call[] = [];
  const priceFor = (lookupKey: string, amount: number) => ({
    id: `price_${lookupKey}_${suffix}`,
    lookup_key: lookupKey,
    active: true,
    recurring: { interval: "month" },
    unit_amount: amount,
    currency: "usd",
  });
  const state = {
    prices: [
      priceFor("seattrue_starter_monthly", 4900),
      priceFor("seattrue_pro_monthly", 14900),
    ],
    subscription: {
      id: `sub_${suffix}`,
      customer: `cus_${suffix}`,
      status: "active" as Stripe.Subscription.Status,
      cancel_at_period_end: false,
      lookupKey: "seattrue_starter_monthly",
    },
    liveSubscriptions: [] as unknown[],
  };
  const stripe = {
    prices: {
      list: async () => ({ data: state.prices }),
    },
    customers: {
      create: async (
        params: unknown,
        options?: { idempotencyKey?: string },
      ) => {
        calls.push({
          method: "customers.create",
          params,
          idempotencyKey: options?.idempotencyKey,
        });
        return { id: `cus_${suffix}` };
      },
    },
    subscriptions: {
      list: async () => ({ data: state.liveSubscriptions }),
      retrieve: async () => {
        const price = state.prices.find(
          (entry) => entry.lookup_key === state.subscription.lookupKey,
        );
        return {
          ...state.subscription,
          items: {
            data: [
              {
                price: price ?? {
                  id: "price_other",
                  lookup_key: "someone_elses_plan",
                },
                current_period_end: 1_800_000_000,
              },
            ],
          },
        };
      },
    },
    checkout: {
      sessions: {
        create: async (
          params: unknown,
          options?: { idempotencyKey?: string },
        ) => {
          calls.push({
            method: "checkout.sessions.create",
            params,
            idempotencyKey: options?.idempotencyKey,
          });
          return {
            id: `cs_${suffix}_${calls.length}`,
            url: `https://checkout.stripe.test/${calls.length}`,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
          };
        },
        retrieve: async (id: string) => ({
          id,
          status: "open",
          url: `https://checkout.stripe.test/${id}`,
          customer: `cus_${suffix}`,
          metadata: {
            organizationId: undefined as string | undefined,
            planLookupKey: "seattrue_starter_monthly",
          },
        }),
        expire: async () => ({}),
      },
    },
    billingPortal: {
      sessions: {
        create: async (
          params: unknown,
          options?: { idempotencyKey?: string },
        ) => {
          calls.push({
            method: "billingPortal.sessions.create",
            params,
            idempotencyKey: options?.idempotencyKey,
          });
          return { url: "https://billing.stripe.test/session" };
        },
      },
    },
  };
  return { stripe: stripe as unknown as Stripe, calls, state };
}

function subscriptionEvent(
  id: string,
  type: string,
  subscriptionId: string,
  created: number,
): Stripe.Event {
  return {
    id,
    type,
    created,
    data: { object: { object: "subscription", id: subscriptionId } },
  } as unknown as Stripe.Event;
}

function invoiceEvent(
  id: string,
  type: string,
  subscriptionId: string,
  created: number,
  hostedInvoiceUrl = "https://invoice.stripe.test/pay",
): Stripe.Event {
  return {
    id,
    type,
    created,
    data: {
      object: {
        object: "invoice",
        hosted_invoice_url: hostedInvoiceUrl,
        parent: { subscription_details: { subscription: subscriptionId } },
      },
    },
  } as unknown as Stripe.Event;
}

databaseTest(
  "checkout, portal and webhooks are idempotent and gate access",
  async () => {
    const connection = createDatabase(process.env.TEST_DATABASE_URL ?? "");
    const organizationId = crypto.randomUUID();
    const suffix = organizationId.replaceAll("-", "");
    const { stripe, calls, state } = fakeStripe(suffix);
    const billing = createBillingService(connection.db, config, stripe);
    const owner = { id: organizationId, email: `${suffix}@northbeam-it.com` };
    const subscriptionId = state.subscription.id;
    const eventIds: string[] = [];
    const event = (name: string) => {
      const id = `evt_${name}_${suffix}`;
      eventIds.push(id);
      return id;
    };
    await connection.db.insert(organization).values({
      id: organizationId,
      name: "Owner's workspace",
      slug: `billing-${suffix}`,
    });

    try {
      // Checkout: one customer, stable idempotency keys, lookup-key prices.
      const first = await billing.checkout(owner, "starter", "attempt-1");
      expect(first.url).toContain("checkout.stripe.test");
      const created = calls.filter(
        (call) => call.method === "checkout.sessions.create",
      );
      expect(created[0]?.idempotencyKey).toBe(
        `checkout:${organizationId}:seattrue_starter_monthly:attempt-1`,
      );
      expect(created[0]?.params).toMatchObject({
        mode: "subscription",
        line_items: [
          { price: `price_seattrue_starter_monthly_${suffix}`, quantity: 1 },
        ],
        success_url: "http://localhost:3000/app/billing?checkout=success",
      });
      const customerCalls = calls.filter(
        (call) => call.method === "customers.create",
      );
      expect(customerCalls).toHaveLength(1);
      expect(customerCalls[0]?.idempotencyKey).toBe(
        `customer:${organizationId}`,
      );

      // Webhook: subscription becomes active; duplicate delivery is a no-op.
      const activeEvent = subscriptionEvent(
        event("created"),
        "customer.subscription.created",
        subscriptionId,
        1_000,
      );
      await billing.processWebhook(activeEvent);
      await billing.processWebhook(activeEvent);
      const recorded = await connection.db
        .select()
        .from(billingWebhookEvents)
        .where(eq(billingWebhookEvents.stripeEventId, activeEvent.id));
      expect(recorded).toHaveLength(1);
      expect(await billing.access(organizationId)).toBe("full");
      const view = await billing.overview(organizationId);
      expect(view.subscription).toMatchObject({
        status: "active",
        planId: "starter",
      });
      expect(view.plans.map((plan) => plan.amount)).toEqual([4900, 14900]);

      // Double checkout while subscribed goes to the portal instead.
      await expect(
        billing.checkout(owner, "pro", "attempt-2"),
      ).rejects.toBeInstanceOf(ExistingSubscriptionError);

      // Portal uses the configured portal and returns to /app/billing.
      const portal = await billing.portal(organizationId, "p1");
      expect(portal?.url).toBe("https://billing.stripe.test/session");
      const portalCall = calls.find(
        (call) => call.method === "billingPortal.sessions.create",
      );
      expect(portalCall?.params).toMatchObject({
        configuration: "bpc_test_portal",
        return_url: "http://localhost:3000/app/billing",
      });
      expect(portalCall?.idempotencyKey).toBe(`portal:${organizationId}:p1`);

      // Payment fails: past_due with a grace window, then 3-D Secure link.
      state.subscription.status = "past_due";
      await billing.processWebhook(
        invoiceEvent(
          event("failed"),
          "invoice.payment_failed",
          subscriptionId,
          2_000,
        ),
      );
      await billing.processWebhook(
        invoiceEvent(
          event("action"),
          "invoice.payment_action_required",
          subscriptionId,
          3_000,
        ),
      );
      let [row] = await connection.db
        .select()
        .from(billingSubscriptions)
        .where(eq(billingSubscriptions.stripeSubscriptionId, subscriptionId));
      expect(row?.status).toBe("past_due");
      expect(row?.pastDueSince?.getTime()).toBe(2_000_000);
      expect(row?.actionUrl).toBe("https://invoice.stripe.test/pay");
      expect(
        await billing.access(organizationId, new Date(2_000_000 + 86_400_000)),
      ).toBe("grace");
      expect(
        await billing.access(
          organizationId,
          new Date(2_000_000 + 8 * 86_400_000),
        ),
      ).toBe("read_only");

      // An older event delivered late must not overwrite newer invoice details.
      await billing.processWebhook(
        invoiceEvent(
          event("stale_action"),
          "invoice.payment_action_required",
          subscriptionId,
          1_500,
          "https://invoice.stripe.test/stale",
        ),
      );
      [row] = await connection.db
        .select()
        .from(billingSubscriptions)
        .where(eq(billingSubscriptions.stripeSubscriptionId, subscriptionId));
      expect(row?.actionUrl).toBe("https://invoice.stripe.test/pay");
      expect(row?.lastEventAt?.getTime()).toBe(3_000_000);

      // Paid: back to active, grace and action link cleared.
      state.subscription.status = "active";
      await billing.processWebhook(
        invoiceEvent(event("paid"), "invoice.paid", subscriptionId, 4_000),
      );
      [row] = await connection.db
        .select()
        .from(billingSubscriptions)
        .where(eq(billingSubscriptions.stripeSubscriptionId, subscriptionId));
      expect(row).toMatchObject({
        status: "active",
        pastDueSince: null,
        actionUrl: null,
      });

      // Canceled at period end: read-only, nothing deleted.
      state.subscription.status = "canceled";
      await billing.processWebhook(
        subscriptionEvent(
          event("deleted"),
          "customer.subscription.deleted",
          subscriptionId,
          5_000,
        ),
      );
      expect(await billing.access(organizationId)).toBe("read_only");

      // Plan moved to a price that isn't SeatTrue's: local entitlement dropped.
      state.subscription.lookupKey = "someone_elses_plan";
      await billing.processWebhook(
        subscriptionEvent(
          event("foreign"),
          "customer.subscription.updated",
          subscriptionId,
          6_000,
        ),
      );
      expect(await billing.access(organizationId)).toBe("none");

      // Unhandled event types are acknowledged without side effects.
      await billing.processWebhook({
        id: `evt_ignored_${suffix}`,
        type: "charge.refunded",
        created: 7_000,
        data: { object: { object: "charge" } },
      } as unknown as Stripe.Event);
      const ignored = await connection.db
        .select()
        .from(billingWebhookEvents)
        .where(eq(billingWebhookEvents.stripeEventId, `evt_ignored_${suffix}`));
      expect(ignored).toHaveLength(0);
    } finally {
      await connection.db
        .delete(billingWebhookEvents)
        .where(inArray(billingWebhookEvents.stripeEventId, eventIds));
      await connection.db
        .delete(organization)
        .where(eq(organization.id, organizationId));
      await connection.close();
    }
  },
);

databaseTest("missing Stripe prices fail with a seed hint", async () => {
  const connection = createDatabase(process.env.TEST_DATABASE_URL ?? "");
  const { stripe, state } = fakeStripe("noprices");
  state.prices = [];
  const billing = createBillingService(connection.db, config, stripe);
  try {
    await expect(billing.overview(crypto.randomUUID())).rejects.toBeInstanceOf(
      BillingPriceConfigurationError,
    );
  } finally {
    await connection.close();
  }
});
