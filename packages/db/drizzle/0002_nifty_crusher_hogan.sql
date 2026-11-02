ALTER TABLE "billing_subscriptions" ADD COLUMN "plan_lookup_key" text;--> statement-breakpoint
ALTER TABLE "billing_subscriptions" ADD COLUMN "past_due_since" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "billing_subscriptions" ADD COLUMN "action_url" text;--> statement-breakpoint
ALTER TABLE "billing_subscriptions" ADD COLUMN "last_event_at" timestamp with time zone;