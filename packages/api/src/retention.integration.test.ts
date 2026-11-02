import { expect, test } from "bun:test";
import {
  account,
  auditLog,
  billingCustomers,
  billingSubscriptions,
  clients,
  createDatabase,
  customerMappings,
  member,
  organization,
  reconciliationRuns,
  user,
  waitlistEntries,
} from "@seattrue/db";
import { createEmailService } from "@seattrue/email";
import type { AuthContext } from "better-auth";
import { decryptOAuthToken, setTokenUtil } from "better-auth/oauth2";
import { and, eq, inArray } from "drizzle-orm";
import { createAuth } from "./auth";
import {
  createRetention,
  createRetentionRoutes,
  decideRetention,
  type RetentionReport,
  retentionDryRun,
} from "./retention";
import { testGuard, testWorkspace } from "./testing";
import { createWorkspaceExportRoutes } from "./workspace-export";

const databaseUrl = process.env.TEST_DATABASE_URL;
const authSecret = process.env.BETTER_AUTH_SECRET;
const integrationTest = databaseUrl ? test : test.skip;
const silent = { info() {}, warn() {}, error() {} };
const DAY = 24 * 60 * 60 * 1000;
const ago = (now: Date, days: number) => new Date(now.getTime() - days * DAY);

test("RETENTION_DRY_RUN is on unless exactly false", () => {
  expect(retentionDryRun({})).toBe(true);
  expect(retentionDryRun({ RETENTION_DRY_RUN: "0" })).toBe(true);
  expect(retentionDryRun({ RETENTION_DRY_RUN: " False " })).toBe(false);
});

test("deletion needs the period over and a warning at least 7 days old", () => {
  const now = new Date("2026-11-02T00:00:00Z");
  const ended = (days: number, warnedDaysAgo: number | null) =>
    decideRetention(
      {
        endedAt: ago(now, days),
        lastActiveAt: ago(now, 400),
        warnedAt: warnedDaysAgo === null ? null : ago(now, warnedDaysAgo),
      },
      now,
    ).action;
  expect(ended(20, null)).toBe("keep");
  expect(ended(29, null)).toBe("warn");
  expect(ended(29, 6)).toBe("keep");
  expect(ended(31, null)).toBe("warn");
  expect(ended(31, 6)).toBe("keep");
  expect(ended(31, 7)).toBe("delete");
  // A warning from before the latest end no longer counts.
  expect(ended(31, 40)).toBe("warn");
  const idle = (days: number, warnedDaysAgo: number | null) =>
    decideRetention(
      {
        endedAt: null,
        lastActiveAt: ago(now, days),
        warnedAt: warnedDaysAgo === null ? null : ago(now, warnedDaysAgo),
      },
      now,
    ).action;
  expect(idle(80, null)).toBe("keep");
  expect(idle(85, null)).toBe("warn");
  expect(idle(91, 8)).toBe("delete");
  // Signed in after the warning: kept.
  expect(idle(1, 8)).toBe("keep");
});

test("the retention job is QStash-signature protected", async () => {
  let runs = 0;
  const report: RetentionReport = {
    dryRun: true,
    warned: [],
    deleted: [],
    deletedUsers: 0,
    purged: {},
  };
  const routes = (enabled: boolean) =>
    createRetentionRoutes({
      jobs: {
        enabled,
        verify: async (job, signature) =>
          job === "retention" && signature === "valid",
      },
      retention: {
        run: async () => {
          runs++;
          return report;
        },
      },
    });
  const call = (signature: string | null, enabled = true) =>
    routes(enabled).handle(
      new Request("http://localhost/jobs/retention", {
        method: "POST",
        headers: signature ? { "Upstash-Signature": signature } : {},
        body: "{}",
      }),
    );
  expect((await call(null)).status).toBe(401);
  expect((await call("forged")).status).toBe(401);
  expect((await call("valid", false)).status).toBe(503);
  expect(runs).toBe(0);
  const ok = await call("valid");
  expect(ok.status).toBe(200);
  expect(await ok.json()).toEqual(report);
  expect(runs).toBe(1);
});

test("only the Owner can export the workspace", async () => {
  for (const role of ["admin", "tech"] as const) {
    const app = createWorkspaceExportRoutes({
      // Never reached: the role check comes first.
      db: undefined as never,
      guard: testGuard(testWorkspace(role)),
    });
    const response = await app.handle(
      new Request("http://localhost/workspace/export"),
    );
    expect(response.status).toBe(403);
  }
  const anonymous = createWorkspaceExportRoutes({
    db: undefined as never,
    guard: testGuard(null),
  });
  expect(
    (await anonymous.handle(new Request("http://localhost/workspace/export")))
      .status,
  ).toBe(401);
});

integrationTest(
  "retention: ended >30 days deleted, 29 days and past_due kept, dry run and repeat runs delete nothing more",
  async () => {
    if (!databaseUrl) return;
    const connection = createDatabase(databaseUrl);
    const db = connection.db;
    const now = new Date();
    const tag = crypto.randomUUID().slice(0, 8);
    const org = (name: string) => `org-ret-${name}-${tag}`;
    const ids = {
      ended31: org("ended31"),
      ended29: org("ended29"),
      pastDue: org("pastdue"),
      idle: org("idle"),
      other: org("other"),
    };
    const userIds = {
      owner: `u-ret-owner-${tag}`,
      tech: `u-ret-tech-${tag}`,
      owner29: `u-ret-owner29-${tag}`,
    };
    try {
      await db.insert(organization).values(
        Object.values(ids).map((id) => ({
          id,
          name: id,
          slug: id,
          createdAt: ago(now, 120),
        })),
      );
      await db.insert(user).values([
        { id: userIds.owner, name: "Owner", email: `owner-${tag}@a.example` },
        { id: userIds.tech, name: "Tech", email: `tech-${tag}@a.example` },
        { id: userIds.owner29, name: "Owner", email: `o29-${tag}@a.example` },
      ]);
      await db.insert(member).values([
        {
          id: `m1-${tag}`,
          organizationId: ids.ended31,
          userId: userIds.owner,
          role: "owner",
        },
        {
          id: `m2-${tag}`,
          organizationId: ids.ended31,
          userId: userIds.tech,
          role: "tech",
        },
        // The owner also belongs to another workspace, so keeps the account.
        {
          id: `m3-${tag}`,
          organizationId: ids.other,
          userId: userIds.owner,
          role: "tech",
        },
        {
          id: `m4-${tag}`,
          organizationId: ids.ended29,
          userId: userIds.owner29,
          role: "owner",
        },
      ]);
      const [client] = await db
        .insert(clients)
        .values({ organizationId: ids.ended31, name: "Client" })
        .returning();
      const clientId = client?.id as string;
      await db.insert(customerMappings).values({
        organizationId: ids.ended31,
        customerKey: `pax8-${tag}`,
        clientId,
      });
      await db.insert(reconciliationRuns).values({
        organizationId: ids.ended31,
        source: "pax8-csv",
        fileName: "bill.csv",
        vendorLines: [],
      });
      await db.insert(billingCustomers).values({
        organizationId: ids.ended31,
        stripeCustomerId: `cus_${tag}`,
      });
      const subscription = (
        organizationId: string,
        status: string,
        endedDaysAgo: number,
      ) => ({
        stripeSubscriptionId: `sub_${organizationId}`,
        organizationId,
        stripeCustomerId: `cus_${organizationId}`,
        priceId: "price_test",
        status,
        currentPeriodEnd: ago(now, endedDaysAgo),
        pastDueSince: status === "past_due" ? ago(now, 40) : null,
        updatedAt: ago(now, endedDaysAgo),
      });
      await db
        .insert(billingSubscriptions)
        .values([
          subscription(ids.ended31, "canceled", 31),
          subscription(ids.ended29, "canceled", 29),
          subscription(ids.pastDue, "past_due", 40),
          subscription(ids.other, "active", -20),
        ]);
      // Owners of both ended workspaces were warned 8 days ago.
      await db.insert(auditLog).values(
        [ids.ended31, ids.ended29].map((organizationId) => ({
          organizationId,
          action: "workspace.deletion_scheduled",
          targetType: "organization",
          targetId: organizationId,
          createdAt: ago(now, 8),
        })),
      );
      const oldEntry = `old-${tag}@waitlist.example`;
      const newEntry = `new-${tag}@waitlist.example`;
      await db.insert(waitlistEntries).values([
        { email: oldEntry, createdAt: ago(now, 25 * 31) },
        { email: newEntry, createdAt: ago(now, 30) },
      ]);

      const scope = { organizationIds: Object.values(ids) };
      const retention = (dryRun: boolean) =>
        createRetention({
          db,
          email: createEmailService({ env: {} }),
          appOrigin: "http://localhost:4000",
          logger: silent,
          dryRun,
        });
      const existing = async () =>
        (
          await db
            .select({ id: organization.id })
            .from(organization)
            .where(inArray(organization.id, Object.values(ids)))
        )
          .map((row) => row.id)
          .sort();
      const waitlist = async () =>
        (
          await db
            .select({ email: waitlistEntries.email })
            .from(waitlistEntries)
            .where(inArray(waitlistEntries.email, [oldEntry, newEntry]))
        ).map((row) => row.email);

      // Dry run: reports, deletes and writes nothing.
      const dry = await retention(true).run(now, scope);
      expect(dry.dryRun).toBe(true);
      expect(dry.deleted.map((d) => d.organizationId)).toEqual([ids.ended31]);
      expect(dry.warned.map((d) => d.organizationId)).toEqual([ids.idle]);
      expect(dry.purged.waitlistEntries).toBeGreaterThanOrEqual(1);
      expect(await existing()).toEqual(Object.values(ids).sort());
      expect((await waitlist()).sort()).toEqual([newEntry, oldEntry].sort());

      const live = await retention(false).run(now, scope);
      expect(live.deleted).toEqual([
        { organizationId: ids.ended31, reason: "subscription_ended" },
      ]);
      expect(live.warned).toEqual([
        { organizationId: ids.idle, reason: "never_subscribed_idle" },
      ]);
      expect(live.deletedUsers).toBe(1);
      expect(await existing()).toEqual(
        [ids.ended29, ids.pastDue, ids.idle, ids.other].sort(),
      );
      // Customer data and billing rows went with the workspace.
      expect(
        await db.select().from(clients).where(eq(clients.id, clientId)),
      ).toEqual([]);
      expect(
        await db
          .select()
          .from(billingCustomers)
          .where(eq(billingCustomers.organizationId, ids.ended31)),
      ).toEqual([]);
      // Users with no other workspace are gone; the shared owner stays.
      const remaining = await db
        .select({ id: user.id })
        .from(user)
        .where(inArray(user.id, Object.values(userIds)));
      expect(remaining.map((row) => row.id).sort()).toEqual(
        [userIds.owner, userIds.owner29].sort(),
      );
      expect(await waitlist()).toEqual([newEntry]);

      // Idempotent: nothing more is deleted, the warning is not repeated.
      const again = await retention(false).run(now, scope);
      expect(again.deleted).toEqual([]);
      expect(again.warned).toEqual([]);
      expect(await existing()).toEqual(
        [ids.ended29, ids.pastDue, ids.idle, ids.other].sort(),
      );
      const warnings = await db
        .select()
        .from(auditLog)
        .where(
          and(
            eq(auditLog.organizationId, ids.idle),
            eq(auditLog.action, "workspace.deletion_scheduled"),
          ),
        );
      expect(warnings).toHaveLength(1);
    } finally {
      await db
        .delete(organization)
        .where(inArray(organization.id, Object.values(ids)));
      await db.delete(user).where(inArray(user.id, Object.values(userIds)));
      await db
        .delete(waitlistEntries)
        .where(eq(waitlistEntries.email, `new-${tag}@waitlist.example`));
      await connection.close();
    }
  },
);

integrationTest("the Owner's export has the workspace data", async () => {
  if (!databaseUrl) return;
  const connection = createDatabase(databaseUrl);
  const db = connection.db;
  const tag = crypto.randomUUID().slice(0, 8);
  const organizationId = `org-export-${tag}`;
  try {
    await db
      .insert(organization)
      .values({ id: organizationId, name: "Export", slug: organizationId });
    await db.insert(clients).values({ organizationId, name: `Acme ${tag}` });
    await db.insert(reconciliationRuns).values({
      organizationId,
      source: "pax8-csv",
      fileName: `pax8-${tag}.csv`,
      vendorLines: [],
    });
    const app = createWorkspaceExportRoutes({
      db,
      guard: testGuard(testWorkspace("owner", organizationId)),
    });
    const response = await app.handle(
      new Request("http://localhost/workspace/export"),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain("attachment");
    const text = await response.text();
    expect(text).toContain(`Acme ${tag}`);
    const data = JSON.parse(text);
    expect(data.clients).toHaveLength(1);
    expect(data.distributorBills[0].fileName).toBe(`pax8-${tag}.csv`);
  } finally {
    await db.delete(organization).where(eq(organization.id, organizationId));
    await connection.close();
  }
});

const authTest = databaseUrl && authSecret ? test : test.skip;

authTest(
  "Google sign-in tokens are stored encrypted; old plaintext rows still read",
  async () => {
    if (!databaseUrl || !authSecret) return;
    const connection = createDatabase(databaseUrl);
    const db = connection.db;
    const tag = crypto.randomUUID().slice(0, 8);
    const userId = `u-enc-${tag}`;
    try {
      const auth = createAuth(db, {
        baseURL: "http://localhost:4000",
        secret: authSecret,
        trustedOrigins: ["http://localhost:4000"],
      });
      // Cast: the plugin-typed context trips exactOptionalPropertyTypes.
      const context = (await auth.$context) as unknown as AuthContext;
      expect(context.options.account?.encryptOAuthTokens).toBe(true);
      await db
        .insert(user)
        .values({ id: userId, name: "Enc", email: `enc-${tag}@a.example` });
      const accessToken = `ya29.plaintext-${tag}`;
      await context.internalAdapter.createAccount({
        userId,
        providerId: "google",
        accountId: `google-${tag}`,
        // The same call Better Auth's OAuth callback makes before storing.
        accessToken: (await setTokenUtil(accessToken, context)) as string,
        refreshToken: (await setTokenUtil(
          `1//refresh-${tag}`,
          context,
        )) as string,
      });
      const [row] = await db
        .select()
        .from(account)
        .where(eq(account.userId, userId));
      expect(row?.accessToken).toBeTruthy();
      expect(row?.accessToken).not.toContain("plaintext");
      expect(row?.refreshToken).not.toContain("refresh");
      expect(await decryptOAuthToken(row?.accessToken as string, context)).toBe(
        accessToken,
      );
      // Rows written before encryption was enabled are returned as they are.
      expect(await decryptOAuthToken("ya29.legacy-token", context)).toBe(
        "ya29.legacy-token",
      );
    } finally {
      await db.delete(user).where(eq(user.id, userId));
      await connection.close();
    }
  },
);
