import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createDatabase } from "@seattrue/db";
import { sql } from "drizzle-orm";

const databaseUrl = process.env.TEST_DATABASE_URL;
const integrationTest = databaseUrl ? test : test.skip;
const migrations = new URL("../../../packages/db/drizzle/", import.meta.url);
const journal = JSON.parse(
  readFileSync(new URL("meta/_journal.json", migrations), "utf8"),
) as { entries: { tag: string }[] };

function statements(tag: string) {
  return readFileSync(new URL(`${tag}.sql`, migrations), "utf8")
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

type Db = ReturnType<typeof createDatabase>["db"];

async function apply(db: Db, tag: string) {
  for (const statement of statements(tag)) await db.execute(sql.raw(statement));
}

async function rows(db: Db, query: string) {
  return [...(await db.execute(sql.raw(query)))];
}

integrationTest(
  "org migration backfills single-owner workspaces and is idempotent",
  async () => {
    if (!databaseUrl) return;
    const admin = createDatabase(databaseUrl);
    const name = `seattrue_migration_${crypto.randomUUID().replaceAll("-", "")}`;
    await admin.db.execute(sql.raw(`CREATE DATABASE "${name}"`));
    const url = new URL(databaseUrl);
    url.pathname = `/${name}`;
    const scratch = createDatabase(url.toString());
    const db = scratch.db;
    const tags = journal.entries.map((entry) => entry.tag);
    const backfill = tags.findIndex((tag) => tag.endsWith("_org_backfill"));
    expect(backfill).toBeGreaterThan(0);

    try {
      // Schema as it was before organizations.
      for (const tag of tags.slice(0, backfill - 1)) await apply(db, tag);
      await db.execute(sql`
        INSERT INTO "user" (id, name, email) VALUES
          ('u1', 'Ann', 'ann@northbeam-it.com'),
          ('u2', '', 'bo@harbor-it.com');
        INSERT INTO "session" (id, expires_at, token, user_id)
          VALUES ('s1', now() + interval '1 day', 'tok1', 'u1');
        INSERT INTO clients (id, owner_id, name) VALUES
          ('00000000-0000-4000-8000-000000000001', 'u1', 'Acme'),
          ('00000000-0000-4000-8000-000000000002', 'u2', 'Bolt');
        INSERT INTO customer_mappings (owner_id, customer_key, client_id)
          VALUES ('u1', 'PX-1', '00000000-0000-4000-8000-000000000001');
        INSERT INTO agreement_lines (owner_id, client_id, sku, product_name, quantity, unit_price_cents)
          VALUES ('u1', '00000000-0000-4000-8000-000000000001', 'M365', 'M365', 3, 1200);
        INSERT INTO reconciliation_runs (id, owner_id, source, file_name, vendor_lines)
          VALUES ('00000000-0000-4000-8000-0000000000a1', 'u1', 'pax8-csv', 'bill.csv', '[]');
        INSERT INTO reconciliation_exceptions (owner_id, run_id, kind, customer_key, customer_name, sku, product_name,
            vendor_quantity, billed_quantity, unit_cost_cents, expected_unit_price_cents, billed_unit_price_cents,
            monthly_impact_cents, summary)
          VALUES ('u1', '00000000-0000-4000-8000-0000000000a1', 'unbilled_seats', 'PX-1', 'Acme', 'M365', 'M365',
            3, 2, 1000, 1200, 1200, 1200, 'one seat');
        INSERT INTO billing_customers (user_id, stripe_customer_id, pending_subscription_checkout_id)
          VALUES ('u1', 'cus_1', 'cs_old');
        INSERT INTO billing_subscriptions (stripe_subscription_id, user_id, stripe_customer_id, price_id, status)
          VALUES ('sub_1', 'u1', 'cus_1', 'price_1', 'active');
        INSERT INTO billing_plan_changes (id, user_id, stripe_subscription_id, target_lookup_key, keep_client_ids, status)
          VALUES ('pc1', 'u1', 'sub_1', 'seattrue_starter_monthly', '[]', 'applied');
      `);

      await apply(db, tags[backfill - 1] as string);
      await apply(db, tags[backfill] as string);
      const snapshot = async () => ({
        organizations: await rows(
          db,
          `SELECT id, name, slug FROM organization ORDER BY id`,
        ),
        members: await rows(
          db,
          `SELECT id, organization_id, user_id, role FROM member ORDER BY id`,
        ),
        sessions: await rows(db, `SELECT active_organization_id FROM session`),
        clients: await rows(
          db,
          `SELECT name, organization_id FROM clients ORDER BY name`,
        ),
        scoped: await rows(
          db,
          `SELECT
            (SELECT organization_id FROM customer_mappings) AS mapping,
            (SELECT organization_id FROM agreement_lines) AS agreement,
            (SELECT organization_id FROM reconciliation_runs) AS run,
            (SELECT organization_id FROM reconciliation_exceptions) AS exception,
            (SELECT organization_id FROM billing_customers) AS customer,
            (SELECT pending_subscription_checkout_id FROM billing_customers) AS pending,
            (SELECT organization_id FROM billing_subscriptions) AS subscription,
            (SELECT organization_id FROM billing_plan_changes) AS plan_change`,
        ),
      });
      const first = await snapshot();
      expect(first.organizations).toEqual([
        { id: "org_u1", name: "Ann's workspace", slug: "personal-u1" },
        { id: "org_u2", name: "bo's workspace", slug: "personal-u2" },
      ]);
      expect(first.members).toEqual([
        {
          id: "mem_u1",
          organization_id: "org_u1",
          user_id: "u1",
          role: "owner",
        },
        {
          id: "mem_u2",
          organization_id: "org_u2",
          user_id: "u2",
          role: "owner",
        },
      ]);
      expect(first.sessions).toEqual([{ active_organization_id: "org_u1" }]);
      expect(first.clients).toEqual([
        { name: "Acme", organization_id: "org_u1" },
        { name: "Bolt", organization_id: "org_u2" },
      ]);
      expect(first.scoped).toEqual([
        {
          mapping: "org_u1",
          agreement: "org_u1",
          run: "org_u1",
          exception: "org_u1",
          customer: "org_u1",
          pending: null,
          subscription: "org_u1",
          plan_change: "org_u1",
        },
      ]);

      // Running the backfill again is a no-op.
      await apply(db, tags[backfill] as string);
      expect(await snapshot()).toEqual(first);

      // The rest of the chain makes the scope mandatory and drops owner ids.
      for (const tag of tags.slice(backfill + 1)) await apply(db, tag);
      expect(
        await rows(
          db,
          `SELECT table_name FROM information_schema.columns
           WHERE table_schema = 'public' AND column_name IN ('owner_id')
           ORDER BY table_name`,
        ),
      ).toEqual([{ table_name: "projects" }]);
      expect(
        await rows(
          db,
          `SELECT c.name, c.organization_id, b.stripe_customer_id
           FROM clients c LEFT JOIN billing_customers b USING (organization_id)
           ORDER BY c.name`,
        ),
      ).toEqual([
        {
          name: "Acme",
          organization_id: "org_u1",
          stripe_customer_id: "cus_1",
        },
        { name: "Bolt", organization_id: "org_u2", stripe_customer_id: null },
      ]);
    } finally {
      await scratch.close();
      await admin.db.execute(sql.raw(`DROP DATABASE IF EXISTS "${name}"`));
      await admin.close();
    }
  },
);
