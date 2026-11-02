import {
  type BillingService,
  limitsFor,
  type PlanId,
  planById,
  planByLookupKey,
  selectClientsToKeep,
} from "@seattrue/billing";
import { type Database, member, user } from "@seattrue/db";
import type { EmailService } from "@seattrue/email";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { recordAudit } from "./audit";
import type { Logger } from "./logger";
import {
  listPendingInvitations,
  listSeatMembers,
  type SeatMember,
} from "./organizations";
import type { LimitClient, ReconService } from "./reconciliation";

/** 402 PLAN_LIMIT: the plan is full; the message says how to make room. */
export class PlanLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanLimitError";
  }
}

export type Overage = {
  kind: "clients" | "users";
  current: number;
  limit: number;
  summary: string;
};

export type DowngradePreflight = {
  targetPlanId: PlanId;
  limit: number | null;
  /** Seat limit of the target plan (members; the owner always stays). */
  memberLimit: number | null;
  overages: Overage[];
  /** Every active client, most recently active first, for the keep picker. */
  clients: { id: string; name: string; lastActiveAt: string }[];
  /** Default selection: least recently active clients get locked. */
  defaultKeepClientIds: string[];
  defaultLockClientIds: string[];
  /** Every member, owner first, then most recently active. */
  members: {
    id: string;
    name: string;
    email: string;
    role: string;
    lastActiveAt: string;
  }[];
  /** Non-owner members kept by default (most recently active). */
  defaultKeepMemberIds: string[];
  defaultSuspendMemberIds: string[];
};

import { byRecency } from "./organizations";

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

  async function currentLimits(organizationId: string) {
    const lookupKey = billing
      ? await billing.currentPlanLookupKey(organizationId)
      : null;
    return { lookupKey, limits: limitsFor(lookupKey) };
  }

  function activeOnly(clients: LimitClient[]) {
    return clients.filter((client) => !client.lockedAt);
  }

  const seatMembers = (organizationId: string) =>
    listSeatMembers(db, organizationId);
  const pendingInvitations = async (organizationId: string) =>
    (await listPendingInvitations(db, organizationId)).length;

  function seatLimitError(planName: string, limit: number) {
    return new PlanLimitError(
      `${planName} includes ${limit} users. Upgrade to Team for unlimited users.`,
    );
  }

  async function assertCanAddClient(organizationId: string) {
    const { lookupKey, limits } = await currentLimits(organizationId);
    const limit = limits.clients;
    if (limit === null) return;
    const active = activeOnly(await recon.limitClients(organizationId));
    if (active.length >= limit) {
      throw new PlanLimitError(
        `${planByLookupKey(lookupKey)?.name ?? "Your plan"} includes ${limit} active clients. Upgrade to Team, or archive a client, to add another.`,
      );
    }
  }

  /** Seats = active members + pending invites, so invites can't overbook. */
  async function assertCanInvite(organizationId: string) {
    const { lookupKey, limits } = await currentLimits(organizationId);
    if (limits.users === null) return;
    const [members, pending] = await Promise.all([
      seatMembers(organizationId),
      pendingInvitations(organizationId),
    ]);
    const used = members.filter((entry) => !entry.suspendedAt).length + pending;
    if (used >= limits.users)
      throw seatLimitError(
        planByLookupKey(lookupKey)?.name ?? "Your plan",
        limits.users,
      );
  }

  /** On accept the invite's own seat is in use, so only members count. */
  async function assertCanJoin(organizationId: string) {
    const { lookupKey, limits } = await currentLimits(organizationId);
    if (limits.users === null) return;
    const members = await seatMembers(organizationId);
    if (members.filter((entry) => !entry.suspendedAt).length >= limits.users)
      throw seatLimitError(
        planByLookupKey(lookupKey)?.name ?? "Your plan",
        limits.users,
      );
  }

  async function seatUsage(organizationId: string) {
    const { limits } = await currentLimits(organizationId);
    const [members, pending] = await Promise.all([
      seatMembers(organizationId),
      pendingInvitations(organizationId),
    ]);
    return {
      used: members.filter((entry) => !entry.suspendedAt).length + pending,
      limit: limits.users,
    };
  }

  /** Owners first (never suspended), then the preferred list, then recency. */
  function selectMembers(
    members: SeatMember[],
    limit: number | null,
    preferred: readonly string[],
  ) {
    const owners = members
      .filter((entry) => entry.role === "owner")
      .map((entry) => entry.id);
    return selectClientsToKeep(members, limit, [...owners, ...preferred]);
  }

  async function preflight(
    organizationId: string,
    targetPlanId: PlanId,
  ): Promise<DowngradePreflight> {
    const target = planById(targetPlanId);
    const limit = target.limits.clients;
    const memberLimit = target.limits.users;
    const [clients, members] = await Promise.all([
      recon.limitClients(organizationId),
      seatMembers(organizationId),
    ]);
    clients.sort(byRecency);
    const selection = selectClientsToKeep(clients, limit);
    const memberSelection = selectMembers(members, memberLimit, []);
    const overages: Overage[] = [];
    if (limit !== null && clients.length > limit)
      overages.push({
        kind: "clients",
        current: clients.length,
        limit,
        summary: `${clients.length} clients vs ${limit} on ${target.name}`,
      });
    if (memberLimit !== null && members.length > memberLimit)
      overages.push({
        kind: "users",
        current: members.length,
        limit: memberLimit,
        summary: `${members.length} users vs ${memberLimit} on ${target.name}`,
      });
    const nonOwners = new Set(
      members
        .filter((entry) => entry.role !== "owner")
        .map((entry) => entry.id),
    );
    return {
      targetPlanId,
      limit,
      memberLimit,
      overages,
      clients: clients.map((client) => ({
        id: client.id,
        name: client.name,
        lastActiveAt: client.lastActiveAt.toISOString(),
      })),
      defaultKeepClientIds: selection.keep,
      defaultLockClientIds: selection.lock,
      members: members.map((entry) => ({
        id: entry.id,
        name: entry.name,
        email: entry.email,
        role: entry.role,
        lastActiveAt: entry.lastActiveAt.toISOString(),
      })),
      defaultKeepMemberIds: memberSelection.keep.filter((id) =>
        nonOwners.has(id),
      ),
      defaultSuspendMemberIds: memberSelection.lock,
    };
  }

  /** Suspend or restore members to match the seat limit; same rules as clients. */
  async function applySeats(
    organizationId: string,
    limit: number | null,
    keepMemberIds: readonly string[] | undefined,
    at: Date,
  ) {
    const members = await seatMembers(organizationId);
    // Without an explicit keep-list, preserve the current state (see apply).
    const preferred = keepMemberIds?.length
      ? keepMemberIds
      : members
          .filter((entry) => !entry.suspendedAt)
          .sort(byRecency)
          .map((entry) => entry.id);
    const selection = selectMembers(members, limit, preferred);
    const changed = await db.transaction(async (tx) => {
      const suspended = selection.lock.length
        ? await tx
            .update(member)
            .set({ suspendedAt: at })
            .where(
              and(
                eq(member.organizationId, organizationId),
                inArray(member.id, selection.lock),
                isNull(member.suspendedAt),
              ),
            )
            .returning({ id: member.id })
        : [];
      const restored = selection.keep.length
        ? await tx
            .update(member)
            .set({ suspendedAt: null })
            .where(
              and(
                eq(member.organizationId, organizationId),
                inArray(member.id, selection.keep),
                isNotNull(member.suspendedAt),
              ),
            )
            .returning({ id: member.id })
        : [];
      for (const [rows, action] of [
        [suspended, "member.suspended"],
        [restored, "member.restored"],
      ] as const) {
        for (const row of rows)
          await recordAudit(tx, {
            organizationId,
            actor: null,
            action,
            targetType: "member",
            targetId: row.id,
            after: { seatLimit: limit },
          });
      }
      return { suspended, restored };
    });
    const names = new Map(
      members.map((entry) => [entry.id, entry.name || entry.email]),
    );
    return {
      suspended: changed.suspended.map((row) => names.get(row.id) ?? row.id),
      restored: changed.restored.map((row) => names.get(row.id) ?? row.id),
    };
  }

  /** Bring client locks and member suspensions in line with a plan. */
  async function apply(
    organizationId: string,
    planLookupKey: string | null,
    keep: { clientIds?: readonly string[]; memberIds?: readonly string[] } = {},
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
    const seats = await applySeats(
      organizationId,
      limits.users,
      keep.memberIds,
      at,
    );
    return {
      locked: changed.locked.map((id) => names.get(id) ?? id),
      unlocked: changed.unlocked.map((id) => names.get(id) ?? id),
      suspended: seats.suspended,
      restored: seats.restored,
    };
  }

  /**
   * Webhook hook: Stripe moved the subscription. A downgrade scheduled in the
   * app brings its keep-lists; anything else (e.g. changed in the Stripe
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
    if (
      keep === null &&
      (result.locked.length > 0 || result.suspended.length > 0)
    ) {
      await notifyOwner(
        state.organizationId,
        state.planLookupKey,
        result,
        state.eventId,
      );
    }
  }

  async function notifyOwner(
    organizationId: string,
    planLookupKey: string,
    result: { locked: string[]; suspended: string[] },
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
    const { locked, suspended } = result;
    const count = (n: number, noun: string) =>
      `${n} ${noun}${n === 1 ? "" : "s"}`;
    const subject = [
      locked.length ? `${count(locked.length, "client")} locked` : null,
      suspended.length ? `${count(suspended.length, "user")} suspended` : null,
    ]
      .filter(Boolean)
      .join(", ");
    const text = [
      `Hi ${owner.name},`,
      `Your subscription moved to ${planName}, which includes ${plan?.limits.clients ?? "fewer"} active clients and ${plan?.limits.users ?? "fewer"} users. Nothing was deleted.`,
      locked.length
        ? `These clients are now read-only and left out of reconciliation:\n${locked.map((name) => `- ${name}`).join("\n")}`
        : null,
      suspended.length
        ? `These people can no longer open the workspace until you upgrade:\n${suspended.map((name) => `- ${name}`).join("\n")}`
        : null,
      "Upgrade to Team to restore them, or archive clients to make room.",
    ]
      .filter(Boolean)
      .join("\n\n");
    const list = (names: string[]) =>
      `<ul>${names.map((name) => `<li>${escapeHtml(name)}</li>`).join("")}</ul>`;
    await email.send({
      to: owner.email,
      subject: `SeatTrue: ${subject} after moving to ${planName}`,
      text: `${text}\n`,
      html: `<p>Hi ${escapeHtml(owner.name)},</p><p>Your subscription moved to ${escapeHtml(planName)}. Nothing was deleted.</p>${locked.length ? `<p>These clients are now read-only and left out of reconciliation:</p>${list(locked)}` : ""}${suspended.length ? `<p>These people can no longer open the workspace until you upgrade:</p>${list(suspended)}` : ""}<p>Upgrade to Team to restore them, or archive clients to make room.</p>`,
      idempotencyKey: `plan-lock:${organizationId}:${eventId}`,
    });
  }

  return {
    assertCanAddClient,
    assertCanInvite,
    assertCanJoin,
    seatUsage,
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
