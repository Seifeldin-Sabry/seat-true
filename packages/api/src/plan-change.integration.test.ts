import { expect, test } from "bun:test";
import { createBillingService } from "@seattrue/billing";
import {
  billingCustomers,
  billingWebhookEvents,
  clients,
  createDatabase,
  type Database,
  member,
  organization,
  user,
} from "@seattrue/db";
import type { EmailService } from "@seattrue/email";
import { and, eq, inArray, isNotNull, like } from "drizzle-orm";
import type Stripe from "stripe";
import { ensurePersonalOrganization } from "./organizations";
import { createPlanLimits, PlanLimitError } from "./plan-limits";
import { createPlanRoutes } from "./plan-routes";
import { createReconRoutes } from "./recon-routes";
import { ClientLockedError, createReconService } from "./reconciliation";
import { testGuard, testWorkspace } from "./testing";

const databaseUrl = process.env.TEST_DATABASE_URL;
const integrationTest = databaseUrl ? test : test.skip;
const origin = "http://localhost:3000";
const PERIOD_START = 1_790_000_000;
const PERIOD_END = 1_792_600_000;

/** In-memory Stripe for plan changes; records every POST with its key. */
function fakeStripe(suffix: string) {
  const posts: { method: string; params: unknown; key: string | undefined }[] =
    [];
  const price = (lookupKey: string) => ({
    id: `price_${lookupKey}_${suffix}`,
    lookup_key: lookupKey,
    active: true,
    recurring: { interval: "month" },
    unit_amount: lookupKey.includes("solo") ? 14900 : 24900,
    currency: "usd",
  });
  const prices = [
    price("seattrue_solo_monthly"),
    price("seattrue_team_monthly"),
  ];
  const sub = {
    id: `sub_${suffix}`,
    customer: `cus_${suffix}`,
    status: "active",
    cancel_at_period_end: false,
    schedule: null as string | null,
    lookupKey: "seattrue_team_monthly",
  };
  const record =
    (method: string, result: (params: unknown) => unknown) =>
    async (...args: unknown[]) => {
      const params = typeof args[0] === "string" ? args[1] : args[0];
      const options = args[args.length - 1] as { idempotencyKey?: string };
      posts.push({ method, params, key: options?.idempotencyKey });
      return result(params);
    };
  const stripe = {
    prices: { list: async () => ({ data: prices }) },
    subscriptions: {
      retrieve: async () => ({
        ...sub,
        items: {
          data: [
            {
              id: `si_${suffix}`,
              price: prices.find((entry) => entry.lookup_key === sub.lookupKey),
              current_period_start: PERIOD_START,
              current_period_end: PERIOD_END,
            },
          ],
        },
      }),
      update: record("subscriptions.update", () => ({ id: sub.id })),
    },
    subscriptionSchedules: {
      create: record("subscriptionSchedules.create", () => {
        sub.schedule = `sub_sched_${suffix}`;
        return { id: sub.schedule };
      }),
      update: record("subscriptionSchedules.update", () => ({})),
      release: record("subscriptionSchedules.release", () => {
        sub.schedule = null;
        return {};
      }),
    },
  };
  return { stripe: stripe as unknown as Stripe, posts, sub };
}

/** Owner user + personal workspace, as sign-up creates them. */
async function createWorkspace(db: Database, ownerUserId: string) {
  const email = `${ownerUserId.replaceAll("-", "")}@northbeam-it.com`;
  await db.insert(user).values({ id: ownerUserId, name: "Owner", email });
  return ensurePersonalOrganization(db, {
    id: ownerUserId,
    name: "Owner",
    email,
  });
}

async function removeWorkspace(
  db: Database,
  organizationId: string,
  userIds: string[],
) {
  await db.delete(organization).where(eq(organization.id, organizationId));
  await db.delete(user).where(inArray(user.id, userIds));
}

function subscriptionUpdated(
  id: string,
  subscriptionId: string,
  created: number,
) {
  return {
    id,
    type: "customer.subscription.updated",
    created,
    data: { object: { object: "subscription", id: subscriptionId } },
  } as unknown as Stripe.Event;
}

integrationTest(
  "downgrades respect usage: preflight, keep choice, locks, unlock, external change",
  async () => {
    if (!databaseUrl) return;
    const connection = createDatabase(databaseUrl);
    const db = connection.db;
    const ownerUserId = `plan-${crypto.randomUUID()}`;
    const suffix = ownerUserId.replaceAll("-", "");
    const { stripe, posts, sub } = fakeStripe(suffix);
    const ownerId = await createWorkspace(db, ownerUserId);
    const sent: {
      to: string;
      subject: string;
      text: string;
      idempotencyKey?: string;
    }[] = [];
    const email = {
      enabled: true,
      send: async (message: {
        to: string;
        subject: string;
        text: string;
        idempotencyKey?: string;
      }) => {
        sent.push(message);
        return { id: `email_${sent.length}` };
      },
    } as unknown as EmailService;
    const recon = createReconService(db);
    let limits: ReturnType<typeof createPlanLimits> | undefined;
    const billing = createBillingService(
      db,
      {
        secretKey: "sk_test_fake",
        webhookSecret: "whsec_fake",
        portalConfigurationId: null,
        appOrigin: origin,
      },
      stripe,
      {
        onSubscriptionState: (state) =>
          limits?.onSubscriptionState(state) ?? Promise.resolve(),
      },
    );
    limits = createPlanLimits({ db, recon, billing, email });
    const planRoutes = createPlanRoutes({
      billing,
      planLimits: limits,
      guard: testGuard(testWorkspace("owner", ownerId, ownerUserId)),
      allowedOrigins: [origin],
    });
    const reconRoutes = createReconRoutes({
      recon,
      guard: testGuard(testWorkspace("owner", ownerId, ownerUserId)),
      allowedOrigins: [origin],
      assertCanAddClient: limits.assertCanAddClient,
    });
    const post = (
      routes: { handle(r: Request): Promise<Response> },
      path: string,
      body: unknown,
    ) =>
      routes.handle(
        new Request(`http://localhost${path}`, {
          method: "POST",
          headers: { origin, "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
    let eventCounter = 0;
    const deliver = async (created: number) => {
      eventCounter += 1;
      const event = subscriptionUpdated(
        `evt_${suffix}_${eventCounter}`,
        sub.id,
        created,
      );
      await billing.processWebhook(event);
      return event;
    };
    const lockedNames = async () =>
      (
        await db
          .select({ name: clients.name })
          .from(clients)
          .where(
            and(
              eq(clients.organizationId, ownerId),
              isNotNull(clients.lockedAt),
            ),
          )
      )
        .map((row) => row.name)
        .sort();

    await db
      .insert(billingCustomers)
      .values({ organizationId: ownerId, stripeCustomerId: sub.customer });
    // Two techs besides the owner: 3 users vs Solo's 2 seats.
    const recentTech = `${ownerUserId}-recent`;
    const olderTech = `${ownerUserId}-older`;
    await db.insert(user).values([
      { id: recentTech, name: "Rae", email: `rae-${suffix}@northbeam-it.com` },
      { id: olderTech, name: "Oli", email: `oli-${suffix}@northbeam-it.com` },
    ]);
    await db.insert(member).values([
      {
        id: `mem-${recentTech}`,
        organizationId: ownerId,
        userId: recentTech,
        role: "tech",
        createdAt: new Date(Date.UTC(2026, 9, 2)),
      },
      {
        id: `mem-${olderTech}`,
        organizationId: ownerId,
        userId: olderTech,
        role: "admin",
        createdAt: new Date(Date.UTC(2026, 8, 2)),
      },
    ]);
    const suspendedMembers = async () =>
      (
        await db
          .select({ id: member.id })
          .from(member)
          .where(
            and(
              eq(member.organizationId, ownerId),
              isNotNull(member.suspendedAt),
            ),
          )
      )
        .map((row) => row.id)
        .sort();
    // 152 clients; c000 is the most recently active, c151 the least.
    const base = Date.UTC(2026, 9, 1);
    await db.insert(clients).values(
      Array.from({ length: 152 }, (_, index) => ({
        organizationId: ownerId,
        name: `c${String(index).padStart(3, "0")}`,
        lastActiveAt: new Date(base - index * 60_000),
      })),
    );
    const idOf = async (name: string) =>
      (
        await db
          .select({ id: clients.id })
          .from(clients)
          .where(
            and(eq(clients.organizationId, ownerId), eq(clients.name, name)),
          )
      )[0]?.id ?? "";

    try {
      // On Team (unlimited) via webhook: nothing locked.
      await deliver(1_000);
      expect(await lockedNames()).toEqual([]);

      // Preflight to Solo reports the overage with least-recent defaults.
      const preflight = await limits.preflight(ownerId, "solo");
      expect(preflight.overages).toEqual([
        {
          kind: "clients",
          current: 152,
          limit: 150,
          summary: "152 clients vs 150 on Solo",
        },
        {
          kind: "users",
          current: 3,
          limit: 2,
          summary: "3 users vs 2 on Solo",
        },
      ]);
      // Owner first, then most recently active; the older admin is suspended.
      expect(preflight.members.map((entry) => entry.id)).toEqual([
        `mem_${ownerUserId}`,
        `mem-${recentTech}`,
        `mem-${olderTech}`,
      ]);
      expect(preflight.defaultKeepMemberIds).toEqual([`mem-${recentTech}`]);
      expect(preflight.defaultSuspendMemberIds).toEqual([`mem-${olderTech}`]);
      expect(preflight.defaultLockClientIds).toEqual([
        await idOf("c150"),
        await idOf("c151"),
      ]);

      // Overage downgrade needs the typed confirmation.
      const unconfirmed = await post(planRoutes, "/billing/plan-change", {
        plan: "solo",
      });
      expect(unconfirmed.status).toBe(422);
      expect((await unconfirmed.json()).error.code).toBe(
        "CONFIRMATION_REQUIRED",
      );

      // Keep the two least-recent clients instead: c148 and c149 get locked.
      const keep = [await idOf("c150"), await idOf("c151")];
      for (let index = 0; index < 148; index++)
        keep.push(await idOf(`c${String(index).padStart(3, "0")}`));
      // Keeping both techs would exceed the seats left beside the owner.
      const tooMany = await post(planRoutes, "/billing/plan-change", {
        plan: "solo",
        confirm: "DOWNGRADE",
        keepClientIds: keep,
        keepMemberIds: [`mem-${recentTech}`, `mem-${olderTech}`],
      });
      expect(tooMany.status).toBe(422);
      expect((await tooMany.json()).error.code).toBe("TOO_MANY_KEPT");
      // Keep the older admin instead of the default.
      const scheduled = await post(planRoutes, "/billing/plan-change", {
        plan: "solo",
        confirm: "DOWNGRADE",
        keepClientIds: keep,
        keepMemberIds: [`mem-${olderTech}`],
      });
      expect(scheduled.status).toBe(200);
      expect(await scheduled.json()).toMatchObject({
        kind: "downgrade_scheduled",
        planId: "solo",
        effectiveAt: new Date(PERIOD_END * 1000).toISOString(),
      });
      const scheduleUpdate = posts.find(
        (entry) => entry.method === "subscriptionSchedules.update",
      );
      expect(scheduleUpdate?.params).toMatchObject({
        end_behavior: "release",
        phases: [
          { end_date: PERIOD_END },
          {
            items: [{ price: `price_seattrue_solo_monthly_${suffix}` }],
            proration_behavior: "none",
          },
        ],
      });
      expect(scheduleUpdate?.key).toContain(
        `schedule-update:sub_sched_${suffix}:seattrue_solo_monthly:`,
      );
      // Nothing locked until Stripe actually moves the plan at period end.
      expect(await lockedNames()).toEqual([]);
      expect(await suspendedMembers()).toEqual([]);

      // Period-end transition: webhook applies the stored keep-list.
      sub.lookupKey = "seattrue_solo_monthly";
      const transition = await deliver(2_000);
      expect(await lockedNames()).toEqual(["c148", "c149"]);
      expect(await suspendedMembers()).toEqual([`mem-${recentTech}`]);
      expect(sent).toHaveLength(0); // In-app downgrade: user already confirmed.

      // Idempotent replay: same event and a later duplicate state change nothing.
      await billing.processWebhook(transition);
      await deliver(2_500);
      expect(await lockedNames()).toEqual(["c148", "c149"]);
      expect(await suspendedMembers()).toEqual([`mem-${recentTech}`]);
      // Full: the owner and the kept admin use both Solo seats.
      await expect(limits.assertCanInvite(ownerId)).rejects.toBeInstanceOf(
        PlanLimitError,
      );

      // Locked clients are read-only and excluded; limits block new clients.
      await expect(
        recon.setMapping(ownerId, "PX-1", await idOf("c148"), null),
      ).rejects.toBeInstanceOf(ClientLockedError);
      await expect(limits.assertCanAddClient(ownerId)).rejects.toBeInstanceOf(
        PlanLimitError,
      );
      const create = await post(reconRoutes, "/recon/clients", {
        name: "One more",
        markupPct: 20,
      });
      expect(create.status).toBe(402);
      expect((await create.json()).error.code).toBe("PLAN_LIMIT");

      // "Fix it first": archiving frees a slot, so restoring needs room again.
      const archive = await reconRoutes.handle(
        new Request(`http://localhost/recon/clients/${await idOf("c000")}`, {
          method: "PATCH",
          headers: { origin, "content-type": "application/json" },
          body: JSON.stringify({ archived: true }),
        }),
      );
      expect(archive.status).toBe(200);
      expect(
        (
          await post(reconRoutes, "/recon/clients", {
            name: "Fits now",
            markupPct: 20,
          })
        ).status,
      ).toBe(201);

      // Upgrade: immediate, always_invoice, unlocks everything.
      const upgraded = await post(planRoutes, "/billing/plan-change", {
        plan: "team",
      });
      expect(await upgraded.json()).toEqual({
        kind: "upgraded",
        planId: "team",
      });
      const update = posts.find(
        (entry) => entry.method === "subscriptions.update",
      );
      expect(update?.params).toMatchObject({
        proration_behavior: "always_invoice",
      });
      expect(update?.key).toContain(`upgrade:${sub.id}:seattrue_team_monthly:`);
      expect(await lockedNames()).toEqual([]);
      expect(await suspendedMembers()).toEqual([]);
      sub.lookupKey = "seattrue_team_monthly";
      await deliver(3_000);
      expect(await lockedNames()).toEqual([]);

      // External downgrade (e.g. Stripe dashboard): default policy + one email.
      sub.lookupKey = "seattrue_solo_monthly";
      const external = await deliver(4_000);
      const lockedExternally = await lockedNames();
      expect(lockedExternally).toHaveLength(2);
      // Default policy: owner first, then the most recently active member.
      expect(await suspendedMembers()).toEqual([`mem-${olderTech}`]);
      expect(sent).toHaveLength(1);
      expect(sent[0]?.subject).toContain("2 clients locked, 1 user suspended");
      expect(sent[0]?.text).toContain("- Oli");
      expect(sent[0]?.idempotencyKey).toBe(
        `plan-lock:${ownerId}:${external.id}`,
      );
      await billing.processWebhook(external);
      await deliver(4_500);
      expect(await lockedNames()).toEqual(lockedExternally);
      expect(await suspendedMembers()).toEqual([`mem-${olderTech}`]);
      expect(sent).toHaveLength(1);
    } finally {
      await db
        .delete(billingWebhookEvents)
        .where(like(billingWebhookEvents.stripeEventId, `evt_${suffix}_%`));
      await removeWorkspace(db, ownerId, [ownerUserId, recentTech, olderTech]);
      await connection.close();
    }
  },
);

integrationTest(
  "clean downgrade under the limit schedules without locking",
  async () => {
    if (!databaseUrl) return;
    const connection = createDatabase(databaseUrl);
    const db = connection.db;
    const ownerUserId = `plan-${crypto.randomUUID()}`;
    const suffix = ownerUserId.replaceAll("-", "");
    const { stripe, posts, sub } = fakeStripe(suffix);
    const ownerId = await createWorkspace(db, ownerUserId);
    const recon = createReconService(db);
    let limits: ReturnType<typeof createPlanLimits> | undefined;
    const billing = createBillingService(
      db,
      {
        secretKey: "sk_test_fake",
        webhookSecret: "whsec_fake",
        portalConfigurationId: null,
        appOrigin: origin,
      },
      stripe,
      {
        onSubscriptionState: (state) =>
          limits?.onSubscriptionState(state) ?? Promise.resolve(),
      },
    );
    limits = createPlanLimits({ db, recon, billing });
    await db
      .insert(billingCustomers)
      .values({ organizationId: ownerId, stripeCustomerId: sub.customer });
    await db
      .insert(clients)
      .values([{ organizationId: ownerId, name: "Only client" }]);
    try {
      await billing.processWebhook(
        subscriptionUpdated(`evt_${suffix}_a`, sub.id, 1_000),
      );
      expect((await limits.preflight(ownerId, "solo")).overages).toEqual([]);
      const result = await billing.changePlan(ownerId, "solo", {
        attemptId: "clean",
      });
      expect(result.kind).toBe("downgrade_scheduled");
      expect(posts.map((entry) => entry.key)).toEqual([
        `schedule:${sub.id}:clean`,
        `schedule-update:sub_sched_${suffix}:seattrue_solo_monthly:clean`,
      ]);
      sub.lookupKey = "seattrue_solo_monthly";
      await billing.processWebhook(
        subscriptionUpdated(`evt_${suffix}_b`, sub.id, 2_000),
      );
      const locked = await db
        .select()
        .from(clients)
        .where(
          and(eq(clients.organizationId, ownerId), isNotNull(clients.lockedAt)),
        );
      expect(locked).toEqual([]);
    } finally {
      await db
        .delete(billingWebhookEvents)
        .where(
          inArray(billingWebhookEvents.stripeEventId, [
            `evt_${suffix}_a`,
            `evt_${suffix}_b`,
          ]),
        );
      await removeWorkspace(db, ownerId, [ownerUserId]);
      await connection.close();
    }
  },
);
