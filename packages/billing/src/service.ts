import {
  billingCustomers,
  billingPlanChanges,
  billingSubscriptions,
  billingWebhookEvents,
  type Database,
} from "@seattrue/db";
import { and, desc, eq, sql } from "drizzle-orm";
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

export class PlanChangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanChangeError";
  }
}

/** Called after each applied subscription state, so plan limits follow Stripe. */
export type SubscriptionStateHook = (state: {
  organizationId: string;
  planLookupKey: string | null;
  status: string;
  eventId: string;
}) => Promise<void>;

export type PlanChangeResult =
  | { kind: "upgraded"; planId: PlanId }
  | {
      kind: "downgrade_scheduled";
      planId: PlanId;
      effectiveAt: string | null;
      keepClientIds: string[];
    };

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
    scheduledPlanId: PlanId | null;
  } | null;
  access: Access;
};

type BillingAccount = { id: string; email: string };
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
  hooks: { onSubscriptionState?: SubscriptionStateHook } = {},
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

  async function customerFor(account: BillingAccount): Promise<string> {
    const existing = await db
      .select({ stripeCustomerId: billingCustomers.stripeCustomerId })
      .from(billingCustomers)
      .where(eq(billingCustomers.organizationId, account.id))
      .limit(1);
    if (existing[0]) return existing[0].stripeCustomerId;

    // Stripe's idempotency key covers concurrent first checkouts and retries if
    // customer creation succeeds but the database write fails.
    const created = await stripe.customers.create(
      { email: account.email, metadata: { organizationId: account.id } },
      { idempotencyKey: `customer:${account.id}` },
    );
    await db
      .insert(billingCustomers)
      .values({ organizationId: account.id, stripeCustomerId: created.id })
      .onConflictDoNothing();

    const stored = await db
      .select({ stripeCustomerId: billingCustomers.stripeCustomerId })
      .from(billingCustomers)
      .where(eq(billingCustomers.organizationId, account.id))
      .limit(1);
    if (!stored[0])
      throw new Error("Could not persist Stripe customer mapping");
    return stored[0].stripeCustomerId;
  }

  async function subscriptionRows(organizationId: string) {
    return db
      .select()
      .from(billingSubscriptions)
      .where(eq(billingSubscriptions.organizationId, organizationId))
      .orderBy(desc(billingSubscriptions.updatedAt));
  }

  async function access(
    organizationId: string,
    now = new Date(),
  ): Promise<Access> {
    return accessFor(
      newestRelevant(await subscriptionRows(organizationId)),
      now,
    );
  }

  async function overview(organizationId: string): Promise<BillingOverview> {
    const [byKey, rows] = await Promise.all([
      prices(),
      subscriptionRows(organizationId),
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
            scheduledPlanId:
              planByLookupKey(
                (await scheduledChange(organizationId))?.targetLookupKey,
              )?.id ?? null,
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
    account: BillingAccount,
    planId: PlanId,
    attemptId: string = crypto.randomUUID(),
  ) {
    const plan = planById(planId);
    const price = (await prices()).get(plan.lookupKey);
    if (!price) throw new BillingPriceConfigurationError(plan.lookupKey);
    const priceIds = new Set(
      [...(await prices()).values()].map((entry) => entry.id),
    );
    const customer = await customerFor(account);

    return db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(871302, hashtext(${account.id}))`,
      );

      const stored = await tx
        .select({ status: billingSubscriptions.status })
        .from(billingSubscriptions)
        .where(eq(billingSubscriptions.organizationId, account.id));
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
        .where(eq(billingCustomers.organizationId, account.id))
        .limit(1);
      if (
        pending?.id &&
        pending.expiresAt &&
        pending.expiresAt.getTime() > Date.now()
      ) {
        const session = await stripe.checkout.sessions.retrieve(pending.id);
        if (
          stripeId(session.customer) !== customer ||
          session.metadata?.organizationId !== account.id
        ) {
          throw new Error(
            "Pending Checkout customer mapping does not match workspace",
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

      const metadata = {
        organizationId: account.id,
        planLookupKey: plan.lookupKey,
      };
      const session = await stripe.checkout.sessions.create(
        {
          mode: "subscription",
          customer,
          client_reference_id: account.id,
          line_items: [{ price: price.id, quantity: 1 }],
          success_url: `${config.appOrigin}/app/billing?checkout=success`,
          cancel_url: `${config.appOrigin}/app/billing?checkout=cancelled`,
          metadata,
          subscription_data: { metadata },
          customer_update: { address: "auto", name: "auto" },
          tax_id_collection: { enabled: true },
        },
        {
          idempotencyKey: `checkout:${account.id}:${plan.lookupKey}:${attemptId}`,
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
        .where(eq(billingCustomers.organizationId, account.id));
      return { url: session.url };
    });
  }

  async function portal(
    organizationId: string,
    attemptId: string = crypto.randomUUID(),
  ) {
    const [customer] = await db
      .select({ stripeCustomerId: billingCustomers.stripeCustomerId })
      .from(billingCustomers)
      .where(eq(billingCustomers.organizationId, organizationId))
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
      { idempotencyKey: `portal:${organizationId}:${attemptId}` },
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

    let applied: Parameters<SubscriptionStateHook>[0] | null = null;
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
        .select({ organizationId: billingCustomers.organizationId })
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
        applied = {
          organizationId: owner.organizationId,
          planLookupKey: null,
          status: subscription.status,
          eventId: event.id,
        };
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
        organizationId: owner.organizationId,
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
      applied = {
        organizationId: owner.organizationId,
        planLookupKey: item.price.lookup_key,
        status: subscription.status,
        eventId: event.id,
      };
    });
    // After commit: a failure here throws, the route returns 500 and Stripe
    // retries; the hook is idempotent, the event row makes the rest a no-op.
    const committed = applied as Parameters<SubscriptionStateHook>[0] | null;
    if (committed) await hooks.onSubscriptionState?.(committed);
  }

  async function scheduledChange(organizationId: string) {
    const [row] = await db
      .select()
      .from(billingPlanChanges)
      .where(
        and(
          eq(billingPlanChanges.organizationId, organizationId),
          eq(billingPlanChanges.status, "scheduled"),
        ),
      )
      .orderBy(desc(billingPlanChanges.createdAt))
      .limit(1);
    return row ?? null;
  }

  async function cancelScheduledChanges(
    organizationId: string,
    attemptId: string,
  ) {
    const pending = await scheduledChange(organizationId);
    if (!pending) return;
    if (pending.stripeScheduleId) {
      await stripe.subscriptionSchedules.release(
        pending.stripeScheduleId,
        undefined,
        {
          idempotencyKey: `schedule-release:${pending.stripeScheduleId}:${attemptId}`,
        },
      );
    }
    await db
      .update(billingPlanChanges)
      .set({ status: "canceled" })
      .where(
        and(
          eq(billingPlanChanges.organizationId, organizationId),
          eq(billingPlanChanges.status, "scheduled"),
        ),
      );
  }

  /**
   * Upgrades apply now and invoice the difference immediately. Downgrades are
   * scheduled for the end of the paid period (no credit, no refund) with the
   * clients the user chose to keep; the webhook applies the lock when Stripe
   * moves the subscription to the new plan.
   */
  async function changePlan(
    organizationId: string,
    planId: PlanId,
    options: { keepClientIds?: string[]; attemptId?: string } = {},
  ): Promise<PlanChangeResult> {
    const attemptId = options.attemptId ?? crypto.randomUUID();
    const target = planById(planId);
    const row = newestRelevant(await subscriptionRows(organizationId));
    if (!row || !["active", "trialing", "past_due"].includes(row.status)) {
      throw new PlanChangeError("Subscribe first, then change plans here.");
    }
    const current = planByLookupKey(row.planLookupKey);
    if (current?.id === target.id) {
      await cancelScheduledChanges(organizationId, attemptId);
      throw new PlanChangeError(`You're already on ${target.name}.`);
    }
    const targetPrice = (await prices()).get(target.lookupKey);
    if (!targetPrice)
      throw new BillingPriceConfigurationError(target.lookupKey);
    const subscription = await stripe.subscriptions.retrieve(
      row.stripeSubscriptionId,
    );
    const item = subscription.items.data.find((entry) =>
      planByLookupKey(entry.price.lookup_key),
    );
    if (!item) throw new PlanChangeError("Subscription has no SeatTrue plan.");

    if (!current || target.rank > current.rank) {
      await cancelScheduledChanges(organizationId, attemptId);
      await stripe.subscriptions.update(
        subscription.id,
        {
          items: [{ id: item.id, price: targetPrice.id }],
          proration_behavior: "always_invoice",
        },
        {
          idempotencyKey: `upgrade:${subscription.id}:${target.lookupKey}:${attemptId}`,
        },
      );
      return { kind: "upgraded", planId: target.id };
    }

    await cancelScheduledChanges(organizationId, attemptId);
    const scheduleId =
      stripeId(subscription.schedule) ??
      (
        await stripe.subscriptionSchedules.create(
          { from_subscription: subscription.id },
          { idempotencyKey: `schedule:${subscription.id}:${attemptId}` },
        )
      ).id;
    const periodEnd = item.current_period_end;
    await stripe.subscriptionSchedules.update(
      scheduleId,
      {
        end_behavior: "release",
        phases: [
          {
            items: [{ price: item.price.id, quantity: 1 }],
            start_date: item.current_period_start,
            end_date: periodEnd,
          },
          {
            items: [{ price: targetPrice.id, quantity: 1 }],
            proration_behavior: "none",
          },
        ],
      },
      {
        idempotencyKey: `schedule-update:${scheduleId}:${target.lookupKey}:${attemptId}`,
      },
    );
    const keepClientIds = options.keepClientIds ?? [];
    const effectiveAt = periodEnd ? new Date(periodEnd * 1000) : null;
    await db.insert(billingPlanChanges).values({
      id: attemptId,
      organizationId,
      stripeSubscriptionId: subscription.id,
      stripeScheduleId: scheduleId,
      targetLookupKey: target.lookupKey,
      keepClientIds,
      status: "scheduled",
      effectiveAt,
    });
    return {
      kind: "downgrade_scheduled",
      planId: target.id,
      effectiveAt: effectiveAt?.toISOString() ?? null,
      keepClientIds,
    };
  }

  /** The keep-list for a downgrade that just took effect; marks it applied. */
  async function takeScheduledKeepList(
    organizationId: string,
    planLookupKey: string,
  ): Promise<{ clientIds: string[] } | null> {
    const pending = await scheduledChange(organizationId);
    if (!pending || pending.targetLookupKey !== planLookupKey) return null;
    await db
      .update(billingPlanChanges)
      .set({ status: "applied" })
      .where(eq(billingPlanChanges.id, pending.id));
    return { clientIds: pending.keepClientIds };
  }

  async function currentPlanLookupKey(organizationId: string) {
    const row = newestRelevant(await subscriptionRows(organizationId));
    return row && accessFor(row) !== "read_only" ? row.planLookupKey : null;
  }

  return {
    overview,
    access,
    checkout,
    portal,
    verifyWebhook,
    processWebhook,
    changePlan,
    scheduledChange,
    takeScheduledKeepList,
    currentPlanLookupKey,
  };
}

export type BillingService = ReturnType<typeof createBillingService>;
