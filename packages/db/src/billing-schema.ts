import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { user } from "./auth-schema";
import { organization } from "./org-schema";

/** Billing belongs to the workspace (Better Auth organization). */
const organizationId = () =>
  text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" });

export const billingCustomers = pgTable("billing_customers", {
  organizationId: organizationId().primaryKey(),
  stripeCustomerId: text("stripe_customer_id").notNull().unique(),
  pendingSubscriptionCheckoutId: text("pending_subscription_checkout_id"),
  pendingSubscriptionCheckoutExpiresAt: timestamp(
    "pending_subscription_checkout_expires_at",
    { withTimezone: true },
  ),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const billingPurchases = pgTable(
  "billing_purchases",
  {
    checkoutSessionId: text("checkout_session_id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    stripeCustomerId: text("stripe_customer_id").notNull(),
    paymentIntentId: text("payment_intent_id"),
    priceId: text("price_id").notNull(),
    status: text("status").notNull(),
    amountTotal: integer("amount_total"),
    currency: text("currency"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("billing_purchases_user_id_idx").on(table.userId)],
);

export const billingSubscriptions = pgTable(
  "billing_subscriptions",
  {
    stripeSubscriptionId: text("stripe_subscription_id").primaryKey(),
    organizationId: organizationId(),
    stripeCustomerId: text("stripe_customer_id").notNull(),
    priceId: text("price_id").notNull(),
    status: text("status").notNull(),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
    /** Plan lookup key (e.g. seattrue_starter_monthly); price IDs differ per Stripe account. */
    planLookupKey: text("plan_lookup_key"),
    /** First moment the subscription went past_due; drives the 7-day grace period. */
    pastDueSince: timestamp("past_due_since", { withTimezone: true }),
    /** Hosted invoice URL when a payment needs customer action (3-D Secure). */
    actionUrl: text("action_url"),
    /** `created` of the newest Stripe event applied, to ignore stale invoice details. */
    lastEventAt: timestamp("last_event_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("billing_subscriptions_organization_id_idx").on(table.organizationId),
  ],
);

export const billingWebhookEvents = pgTable("billing_webhook_events", {
  stripeEventId: text("stripe_event_id").primaryKey(),
  type: text("type").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/**
 * A downgrade the user scheduled in the app. Applied by the subscription
 * webhook at the period-end transition using the stored keep-list.
 */
export const billingPlanChanges = pgTable(
  "billing_plan_changes",
  {
    id: text("id").primaryKey(),
    organizationId: organizationId(),
    stripeSubscriptionId: text("stripe_subscription_id").notNull(),
    stripeScheduleId: text("stripe_schedule_id"),
    targetLookupKey: text("target_lookup_key").notNull(),
    keepClientIds: jsonb("keep_client_ids").$type<string[]>().notNull(),
    status: text("status")
      .$type<"scheduled" | "applied" | "canceled">()
      .notNull(),
    effectiveAt: timestamp("effective_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("billing_plan_changes_organization_id_idx").on(table.organizationId),
  ],
);
