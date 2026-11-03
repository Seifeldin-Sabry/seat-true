import { auditLog, type Database } from "@seattrue/db";
import { desc, eq } from "drizzle-orm";

/** Who did it. Null user = the system (e.g. a Stripe webhook). */
export type Actor = { userId: string; email: string } | null;

export type AuditAction =
  | "exception.approve"
  | "exception.dismiss"
  | "exception.billed"
  | "exception.reopen"
  | "exception.flag"
  | "exception.unflag"
  | "exception.comment"
  | "mapping.change"
  | "client.markup"
  | "client.create"
  | "billing.import"
  | "billing.lines_edit"
  | "member.invited"
  | "member.invite_canceled"
  | "member.joined"
  | "member.removed"
  | "member.role_changed"
  | "plan.change";

export type AuditEntry = {
  organizationId: string;
  actor: Actor;
  action: AuditAction;
  targetType: string;
  targetId?: string | null;
  before?: unknown;
  after?: unknown;
};

export type AuditDto = {
  id: string;
  actorEmail: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  before: unknown;
  after: unknown;
  createdAt: string;
};

/** A db or an open transaction; audit rows ride in the caller's transaction. */
type Executor = Pick<Database, "insert">;

export async function recordAudit(executor: Executor, entry: AuditEntry) {
  await executor.insert(auditLog).values({
    organizationId: entry.organizationId,
    actorUserId: entry.actor?.userId ?? null,
    actorEmail: entry.actor?.email ?? null,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId ?? null,
    before: entry.before ?? null,
    after: entry.after ?? null,
  });
}

export function createAuditLog(db: Database) {
  return {
    record: (entry: AuditEntry) => recordAudit(db, entry),
    // ponytail: newest 200 rows, no paging; add a cursor when someone needs history.
    async list(organizationId: string): Promise<AuditDto[]> {
      const rows = await db
        .select({
          id: auditLog.id,
          actorEmail: auditLog.actorEmail,
          action: auditLog.action,
          targetType: auditLog.targetType,
          targetId: auditLog.targetId,
          before: auditLog.before,
          after: auditLog.after,
          createdAt: auditLog.createdAt,
        })
        .from(auditLog)
        .where(eq(auditLog.organizationId, organizationId))
        .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
        .limit(200);
      return rows.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
      }));
    },
  };
}

export type AuditLog = ReturnType<typeof createAuditLog>;
