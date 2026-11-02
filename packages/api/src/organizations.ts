import { legal } from "@seattrue/auth-policy/legal";
import {
  type Database,
  invitation,
  member,
  organization,
  session,
  user,
} from "@seattrue/db";
import { and, desc, eq, gt, max } from "drizzle-orm";

export type Membership = {
  memberId: string;
  organizationId: string;
  organizationName: string;
  role: string;
  suspendedAt: Date | null;
  createdAt: Date;
};

/**
 * Deterministic ids ("org_" / "mem_" + user id) match the 0005 backfill, so
 * creating the personal workspace twice is a no-op.
 */
export async function ensurePersonalOrganization(
  db: Database,
  user: { id: string; name: string; email: string },
) {
  const organizationId = `org_${user.id}`;
  const label = user.name.trim() || user.email.split("@")[0] || "My";
  await db.transaction(async (tx) => {
    await tx
      .insert(organization)
      .values({
        id: organizationId,
        name: `${label}'s workspace`,
        slug: `personal-${user.id}`,
        // Sign-up is where the Owner accepts the Terms and DPA (email and Google alike).
        termsAcceptedAt: new Date(),
        termsVersion: legal.termsVersion,
      })
      .onConflictDoNothing();
    await tx
      .insert(member)
      .values({
        id: `mem_${user.id}`,
        organizationId,
        userId: user.id,
        role: "owner",
      })
      .onConflictDoNothing();
  });
  return organizationId;
}

/** Newest first, so a fresh invite acceptance wins as the default workspace. */
export async function membershipsFor(
  db: Database,
  userId: string,
): Promise<Membership[]> {
  return db
    .select({
      memberId: member.id,
      organizationId: member.organizationId,
      organizationName: organization.name,
      role: member.role,
      suspendedAt: member.suspendedAt,
      createdAt: member.createdAt,
    })
    .from(member)
    .innerJoin(organization, eq(organization.id, member.organizationId))
    .where(eq(member.userId, userId))
    .orderBy(desc(member.createdAt), desc(member.id));
}

/**
 * The workspace a session acts in: the stored active organization when the
 * user still belongs to it (suspended included, so the API can say why access
 * stopped), otherwise the newest membership that isn't suspended.
 */
export function pickActiveMembership(
  memberships: Membership[],
  activeOrganizationId: string | null | undefined,
): Membership | null {
  return (
    memberships.find(
      (entry) => entry.organizationId === activeOrganizationId,
    ) ??
    memberships.find((entry) => !entry.suspendedAt) ??
    null
  );
}

export type SeatMember = {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  lastActiveAt: Date;
  suspendedAt: Date | null;
};

/** Most recently active first, ties by id: deterministic for webhook replays. */
export const byRecency = (
  a: { id: string; lastActiveAt: Date },
  b: { id: string; lastActiveAt: Date },
) =>
  b.lastActiveAt.getTime() - a.lastActiveAt.getTime() ||
  a.id.localeCompare(b.id);

/** Members with their last session activity; owner first, then recency. */
export async function listSeatMembers(
  db: Database,
  organizationId: string,
): Promise<SeatMember[]> {
  const lastSeen = db
    .select({
      userId: session.userId,
      lastSeenAt: max(session.updatedAt).as("last_seen_at"),
    })
    .from(session)
    .groupBy(session.userId)
    .as("last_seen");
  const rows = await db
    .select({
      id: member.id,
      userId: member.userId,
      name: user.name,
      email: user.email,
      role: member.role,
      createdAt: member.createdAt,
      suspendedAt: member.suspendedAt,
      lastSeenAt: lastSeen.lastSeenAt,
    })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .leftJoin(lastSeen, eq(lastSeen.userId, member.userId))
    .where(eq(member.organizationId, organizationId));
  return rows
    .map(({ createdAt, lastSeenAt, ...row }) => ({
      ...row,
      // Aggregates in a subquery can come back as text; normalize to Date.
      lastActiveAt: new Date(lastSeenAt ?? createdAt),
    }))
    .sort((a, b) =>
      a.role === "owner" ? -1 : b.role === "owner" ? 1 : byRecency(a, b),
    );
}

/** Invitations that still hold a seat: pending and not expired. */
export async function listPendingInvitations(
  db: Database,
  organizationId: string,
) {
  return db
    .select({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
    })
    .from(invitation)
    .where(
      and(
        eq(invitation.organizationId, organizationId),
        eq(invitation.status, "pending"),
        gt(invitation.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(invitation.createdAt));
}
