ALTER TABLE "agreement_lines" DROP CONSTRAINT "agreement_lines_owner_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "billing_customers" DROP CONSTRAINT "billing_customers_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "billing_plan_changes" DROP CONSTRAINT "billing_plan_changes_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "billing_subscriptions" DROP CONSTRAINT "billing_subscriptions_user_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "clients" DROP CONSTRAINT "clients_owner_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "customer_mappings" DROP CONSTRAINT "customer_mappings_owner_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "reconciliation_exceptions" DROP CONSTRAINT "reconciliation_exceptions_owner_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "reconciliation_runs" DROP CONSTRAINT "reconciliation_runs_owner_id_user_id_fk";
--> statement-breakpoint
DROP INDEX "agreement_lines_owner_id_idx";--> statement-breakpoint
DROP INDEX "billing_plan_changes_user_id_idx";--> statement-breakpoint
DROP INDEX "billing_subscriptions_user_id_idx";--> statement-breakpoint
DROP INDEX "clients_owner_id_idx";--> statement-breakpoint
DROP INDEX "customer_mappings_owner_key_idx";--> statement-breakpoint
DROP INDEX "reconciliation_exceptions_owner_run_idx";--> statement-breakpoint
DROP INDEX "reconciliation_runs_owner_id_idx";--> statement-breakpoint
ALTER TABLE "agreement_lines" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "billing_customers" DROP CONSTRAINT "billing_customers_pkey";--> statement-breakpoint
ALTER TABLE "billing_customers" ADD PRIMARY KEY ("organization_id");--> statement-breakpoint
ALTER TABLE "billing_customers" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "billing_plan_changes" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "billing_subscriptions" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "clients" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "customer_mappings" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "exception_comments" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "reconciliation_exceptions" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "reconciliation_runs" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "agreement_lines_organization_id_idx" ON "agreement_lines" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "billing_plan_changes_organization_id_idx" ON "billing_plan_changes" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "billing_subscriptions_organization_id_idx" ON "billing_subscriptions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "clients_organization_id_idx" ON "clients" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_mappings_organization_key_idx" ON "customer_mappings" USING btree ("organization_id","customer_key");--> statement-breakpoint
CREATE INDEX "reconciliation_exceptions_organization_run_idx" ON "reconciliation_exceptions" USING btree ("organization_id","run_id");--> statement-breakpoint
CREATE INDEX "reconciliation_runs_organization_id_idx" ON "reconciliation_runs" USING btree ("organization_id");--> statement-breakpoint
ALTER TABLE "agreement_lines" DROP COLUMN "owner_id";--> statement-breakpoint
ALTER TABLE "billing_customers" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "billing_plan_changes" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "billing_subscriptions" DROP COLUMN "user_id";--> statement-breakpoint
ALTER TABLE "clients" DROP COLUMN "owner_id";--> statement-breakpoint
ALTER TABLE "customer_mappings" DROP COLUMN "owner_id";--> statement-breakpoint
ALTER TABLE "reconciliation_exceptions" DROP COLUMN "owner_id";--> statement-breakpoint
ALTER TABLE "reconciliation_runs" DROP COLUMN "owner_id";