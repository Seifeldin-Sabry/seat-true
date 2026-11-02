CREATE TABLE "billing_plan_changes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"stripe_subscription_id" text NOT NULL,
	"stripe_schedule_id" text,
	"target_lookup_key" text NOT NULL,
	"keep_client_ids" jsonb NOT NULL,
	"status" text NOT NULL,
	"effective_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "locked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "last_active_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "billing_plan_changes" ADD CONSTRAINT "billing_plan_changes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "billing_plan_changes_user_id_idx" ON "billing_plan_changes" USING btree ("user_id");