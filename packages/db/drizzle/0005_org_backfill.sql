-- Every single-owner workspace becomes an organization owned by that user.
-- Idempotent: deterministic ids ('org_' / 'mem_' + user id), ON CONFLICT DO
-- NOTHING, and updates only touch rows whose organization_id is still NULL,
-- so running this file again changes nothing.
INSERT INTO "organization" ("id", "name", "slug", "created_at")
SELECT 'org_' || u."id",
       coalesce(nullif(trim(u."name"), ''), split_part(u."email", '@', 1)) || '''s workspace',
       'personal-' || u."id",
       now()
FROM "user" u
WHERE NOT EXISTS (
  SELECT 1 FROM "member" m WHERE m."user_id" = u."id" AND m."role" = 'owner'
)
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "member" ("id", "organization_id", "user_id", "role", "created_at")
SELECT 'mem_' || u."id", o."id", u."id", 'owner', now()
FROM "user" u
JOIN "organization" o ON o."id" = 'org_' || u."id"
ON CONFLICT DO NOTHING;
--> statement-breakpoint
UPDATE "session" SET "active_organization_id" = 'org_' || "user_id"
WHERE "active_organization_id" IS NULL
  AND EXISTS (SELECT 1 FROM "organization" o WHERE o."id" = 'org_' || "session"."user_id");
--> statement-breakpoint
UPDATE "clients" SET "organization_id" = 'org_' || "owner_id" WHERE "organization_id" IS NULL;
--> statement-breakpoint
UPDATE "customer_mappings" SET "organization_id" = 'org_' || "owner_id" WHERE "organization_id" IS NULL;
--> statement-breakpoint
UPDATE "agreement_lines" SET "organization_id" = 'org_' || "owner_id" WHERE "organization_id" IS NULL;
--> statement-breakpoint
UPDATE "reconciliation_runs" SET "organization_id" = 'org_' || "owner_id" WHERE "organization_id" IS NULL;
--> statement-breakpoint
UPDATE "reconciliation_exceptions" SET "organization_id" = 'org_' || "owner_id" WHERE "organization_id" IS NULL;
--> statement-breakpoint
-- Billing moves to the organization. A Checkout opened before the move
-- carries user metadata, so it is forgotten rather than reused.
UPDATE "billing_customers"
SET "organization_id" = 'org_' || "user_id",
    "pending_subscription_checkout_id" = NULL,
    "pending_subscription_checkout_expires_at" = NULL
WHERE "organization_id" IS NULL;
--> statement-breakpoint
UPDATE "billing_subscriptions" SET "organization_id" = 'org_' || "user_id" WHERE "organization_id" IS NULL;
--> statement-breakpoint
UPDATE "billing_plan_changes" SET "organization_id" = 'org_' || "user_id" WHERE "organization_id" IS NULL;
