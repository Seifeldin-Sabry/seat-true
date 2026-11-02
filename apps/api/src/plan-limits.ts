import {
  type BillingService,
  limitsFor,
  type PlanId,
  planById,
  planByLookupKey,
  selectClientsToKeep,
} from "@seattrue/billing";
import { type Database, user } from "@seattrue/db";
import type { EmailService } from "@seattrue/email";
import { eq } from "drizzle-orm";
import type { Logger } from "./logger";
import type { LimitClient, ReconService } from "./reconciliation";

export class PlanLimitError extends Error {
  constructor(planName: string, limit: number) {
    super(
      `${planName} includes ${limit} active clients. Upgrade to Team, or archive a client, to add another.`,
    );
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

/**
 * Plan limits across reconciliation and billing. Locks are deterministic from
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

  async function currentLimit(ownerId: string) {
    const lookupKey = billing
      ? await billing.currentPlanLookupKey(ownerId)
      : null;
    return { lookupKey, limit: limitsFor(lookupKey).clients };
  }

  function activeOnly(clients: LimitClient[]) {
    return clients.filter((client) => !client.lockedAt);
  }

  async function assertCanAddClient(ownerId: string) {
    const { lookupKey, limit } = await currentLimit(ownerId);
    if (limit === null) return;
    const active = activeOnly(await recon.limitClients(ownerId));
    if (active.length >= limit) {
      throw new PlanLimitError(
        planByLookupKey(lookupKey)?.name ?? "Your plan",
        limit,
      );
    }
  }

  async function preflight(
    ownerId: string,
    targetPlanId: PlanId,
  ): Promise<DowngradePreflight> {
    const target = planById(targetPlanId);
    const limit = target.limits.clients;
    const clients = (await recon.limitClients(ownerId)).sort(
      (a, b) =>
        b.lastActiveAt.getTime() - a.lastActiveAt.getTime() ||
        a.id.localeCompare(b.id),
    );
    const selection = selectClientsToKeep(clients, limit);
    return {
      targetPlanId,
      limit,
      overages:
        limit !== null && clients.length > limit
          ? [
              {
                kind: "clients",
                current: clients.length,
                limit,
                summary: `${clients.length} clients vs ${limit} on ${target.name}`,
              },
            ]
          : [],
      clients: clients.map((client) => ({
        id: client.id,
        name: client.name,
        lastActiveAt: client.lastActiveAt.toISOString(),
      })),
      defaultKeepClientIds: selection.keep,
      defaultLockClientIds: selection.lock,
    };
  }

  /** Bring locks in line with a plan; returns names of newly locked clients. */
  async function apply(
    ownerId: string,
    planLookupKey: string | null,
    keepClientIds: readonly string[] = [],
    at: Date = new Date(),
  ) {
    const clients = await recon.limitClients(ownerId);
    // Without an explicit keep-list, preserve the current state: clients that
    // are unlocked now stay unlocked (most recent first), so routine webhook
    // events never reshuffle which clients a user chose to keep.
    const preferred = keepClientIds.length
      ? keepClientIds
      : clients
          .filter((client) => !client.lockedAt)
          .sort(
            (a, b) =>
              b.lastActiveAt.getTime() - a.lastActiveAt.getTime() ||
              a.id.localeCompare(b.id),
          )
          .map((client) => client.id);
    const selection = selectClientsToKeep(
      clients,
      limitsFor(planLookupKey).clients,
      preferred,
    );
    const changed = await recon.applyLocks(
      ownerId,
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
    userId: string;
    planLookupKey: string | null;
    eventId: string;
  }) {
    if (!state.planLookupKey) return;
    const keep = billing
      ? await billing.takeScheduledKeepList(state.userId, state.planLookupKey)
      : null;
    const result = await apply(state.userId, state.planLookupKey, keep ?? []);
    if (keep === null && result.locked.length > 0) {
      await notifyOwner(
        state.userId,
        state.planLookupKey,
        result.locked,
        state.eventId,
      );
    }
  }

  async function notifyOwner(
    ownerId: string,
    planLookupKey: string,
    lockedNames: string[],
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
      .from(user)
      .where(eq(user.id, ownerId))
      .limit(1);
    if (!owner) return;
    const plan = planByLookupKey(planLookupKey);
    const list = lockedNames.map((name) => `- ${name}`).join("\n");
    await email.send({
      to: owner.email,
      subject: `SeatTrue: ${lockedNames.length} clients locked after moving to ${plan?.name ?? "a smaller plan"}`,
      text: `Hi ${owner.name},\n\nYour subscription moved to ${plan?.name ?? "a smaller plan"}, which includes ${plan?.limits.clients ?? "fewer"} active clients. These clients are now read-only and left out of reconciliation. Nothing was deleted:\n\n${list}\n\nUpgrade to Team or archive other clients to unlock them.\n`,
      html: `<p>Hi ${escapeHtml(owner.name)},</p><p>Your subscription moved to ${escapeHtml(plan?.name ?? "a smaller plan")}. These clients are now read-only and left out of reconciliation. Nothing was deleted:</p><ul>${lockedNames.map((name) => `<li>${escapeHtml(name)}</li>`).join("")}</ul><p>Upgrade to Team or archive other clients to unlock them.</p>`,
      idempotencyKey: `plan-lock:${ownerId}:${eventId}`,
    });
  }

  return { assertCanAddClient, preflight, apply, onSubscriptionState };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export type PlanLimits = ReturnType<typeof createPlanLimits>;
