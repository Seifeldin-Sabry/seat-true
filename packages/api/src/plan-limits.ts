import {
  type BillingService,
  limitsFor,
  type PlanId,
  planById,
  planByLookupKey,
  plans,
  selectClientsToKeep,
} from "@seattrue/billing";
import { type Database, member, user } from "@seattrue/db";
import type { EmailService } from "@seattrue/email";
import { and, eq } from "drizzle-orm";
import type { Logger } from "./logger";
import { byRecency } from "./organizations";
import type { LimitClient, ReconService } from "./reconciliation";

/** 402 PLAN_LIMIT: the plan is full; the message says how to make room. */
export class PlanLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanLimitError";
  }
}

export type Overage = {
  kind: "clients";
  current: number;
  limit: number;
  summary: string;
};

export type DowngradePreflight = {
  targetPlanId: PlanId;
  limit: number | null;
  overages: Overage[];
  /** Every active client, most recently active first, for the keep picker. */
  clients: { id: string; name: string; lastActiveAt: string }[];
  /** Default selection: least recently active clients get locked. */
  defaultKeepClientIds: string[];
  defaultLockClientIds: string[];
};

/** The unlimited plan, named in upgrade prompts. */
const topPlan = plans.reduce((top, plan) =>
  plan.rank > top.rank ? plan : top,
);

/**
 * Plan limits across reconciliation and billing. Users are unlimited on every
 * plan; only active clients are capped. Locks are deterministic from
 * (clients, limit, keep-list), so replaying a webhook changes nothing.
 */
export function createPlanLimits(options: {
  db: Database;
  recon: ReconService;
  billing: BillingService | null;
  email?: EmailService;
  logger?: Logger;
}) {
  const { db, recon, billing, email, logger } = options;

  async function currentLimits(organizationId: string) {
    const lookupKey = billing
      ? await billing.currentPlanLookupKey(organizationId)
      : null;
    return { lookupKey, limits: limitsFor(lookupKey) };
  }

  function activeOnly(clients: LimitClient[]) {
    return clients.filter((client) => !client.lockedAt);
  }

  async function assertCanAddClient(organizationId: string) {
    const { lookupKey, limits } = await currentLimits(organizationId);
    const limit = limits.clients;
    if (limit === null) return;
    const active = activeOnly(await recon.limitClients(organizationId));
    if (active.length >= limit) {
      throw new PlanLimitError(
        `${planByLookupKey(lookupKey)?.name ?? "Your plan"} includes ${limit} active clients. Upgrade to ${topPlan.name}, or archive a client, to add another.`,
      );
    }
  }

  async function preflight(
    organizationId: string,
    targetPlanId: PlanId,
  ): Promise<DowngradePreflight> {
    const target = planById(targetPlanId);
    const limit = target.limits.clients;
    const clients = await recon.limitClients(organizationId);
    clients.sort(byRecency);
    const selection = selectClientsToKeep(clients, limit);
    const overages: Overage[] = [];
    if (limit !== null && clients.length > limit)
      overages.push({
        kind: "clients",
        current: clients.length,
        limit,
        summary: `${clients.length} clients vs ${limit} on ${target.name}`,
      });
    return {
      targetPlanId,
      limit,
      overages,
      clients: clients.map((client) => ({
        id: client.id,
        name: client.name,
        lastActiveAt: client.lastActiveAt.toISOString(),
      })),
      defaultKeepClientIds: selection.keep,
      defaultLockClientIds: selection.lock,
    };
  }

  /** Bring client locks in line with a plan. */
  async function apply(
    organizationId: string,
    planLookupKey: string | null,
    keep: { clientIds?: readonly string[] } = {},
    at: Date = new Date(),
  ) {
    const clients = await recon.limitClients(organizationId);
    // Without an explicit keep-list, preserve the current state: clients that
    // are unlocked now stay unlocked (most recent first), so routine webhook
    // events never reshuffle which clients a user chose to keep.
    const preferred = keep.clientIds?.length
      ? keep.clientIds
      : clients
          .filter((client) => !client.lockedAt)
          .sort(byRecency)
          .map((client) => client.id);
    const limits = limitsFor(planLookupKey);
    const selection = selectClientsToKeep(clients, limits.clients, preferred);
    const changed = await recon.applyLocks(
      organizationId,
      selection.lock,
      selection.keep,
      at,
    );
    const names = new Map(clients.map((client) => [client.id, client.name]));
    return {
      locked: changed.locked.map((id) => names.get(id) ?? id),
      unlocked: changed.unlocked.map((id) => names.get(id) ?? id),
    };
  }

  /**
   * Webhook hook: Stripe moved the subscription. A downgrade scheduled in the
   * app brings its keep-list; anything else (e.g. changed in the Stripe
   * dashboard) gets the default policy and an email to the owner.
   */
  async function onSubscriptionState(state: {
    organizationId: string;
    planLookupKey: string | null;
    eventId: string;
  }) {
    if (!state.planLookupKey) return;
    const keep = billing
      ? await billing.takeScheduledKeepList(
          state.organizationId,
          state.planLookupKey,
        )
      : null;
    const result = await apply(
      state.organizationId,
      state.planLookupKey,
      keep ?? {},
    );
    if (keep === null && result.locked.length > 0) {
      await notifyOwner(
        state.organizationId,
        state.planLookupKey,
        result.locked,
        state.eventId,
      );
    }
  }

  async function notifyOwner(
    organizationId: string,
    planLookupKey: string,
    locked: string[],
    eventId: string,
  ) {
    if (!email?.enabled) {
      logger?.warn({
        event: "plan_lock_email_skipped",
        reason: "email disabled",
      });
      return;
    }
    const [owner] = await db
      .select({ email: user.email, name: user.name })
      .from(member)
      .innerJoin(user, eq(user.id, member.userId))
      .where(
        and(
          eq(member.organizationId, organizationId),
          eq(member.role, "owner"),
        ),
      )
      .limit(1);
    if (!owner) return;
    const plan = planByLookupKey(planLookupKey);
    const planName = plan?.name ?? "a smaller plan";
    const count = `${locked.length} client${locked.length === 1 ? "" : "s"}`;
    const text = [
      `Hi ${owner.name},`,
      `Your subscription moved to ${planName}, which includes ${plan?.limits.clients ?? "fewer"} active clients. Nothing was deleted.`,
      `These clients are now read-only and left out of reconciliation:\n${locked.map((name) => `- ${name}`).join("\n")}`,
      `Upgrade to ${topPlan.name} to restore them, or archive clients to make room.`,
    ].join("\n\n");
    const list = `<ul>${locked.map((name) => `<li>${escapeHtml(name)}</li>`).join("")}</ul>`;
    await email.send({
      to: owner.email,
      subject: `SeatTrue: ${count} locked after moving to ${planName}`,
      text: `${text}\n`,
      html: `<p>Hi ${escapeHtml(owner.name)},</p><p>Your subscription moved to ${escapeHtml(planName)}. Nothing was deleted.</p><p>These clients are now read-only and left out of reconciliation:</p>${list}<p>Upgrade to ${topPlan.name} to restore them, or archive clients to make room.</p>`,
      idempotencyKey: `plan-lock:${organizationId}:${eventId}`,
    });
  }

  return {
    assertCanAddClient,
    preflight,
    apply,
    onSubscriptionState,
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export type PlanLimits = ReturnType<typeof createPlanLimits>;
