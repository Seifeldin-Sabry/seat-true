import {
  auditLog,
  auditRequests,
  billingWebhookEvents,
  type Database,
  integrationWaitlist,
  invitation,
  member,
  oauthAccessToken,
  oauthRefreshToken,
  organization,
  rateLimit,
  session,
  user,
  verification,
  waitlistEntries,
} from "@seattrue/db";
import type { EmailService } from "@seattrue/email";
import type { JobQueue } from "@seattrue/jobs";
import { and, eq, inArray, lt, type SQL, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { Elysia } from "elysia";
import type { Logger } from "./logger";

/**
 * Retention periods promised in /privacy, /terms and /dpa. Change them there
 * too.
 */
export const RETENTION = {
  /** Read-only export window after a subscription ends. */
  endedReadOnlyDays: 30,
  /** Idle days before a never-subscribed workspace is deleted. */
  neverSubscribedIdleDays: 90,
  /** The Owner is emailed this long before deletion. */
  warningDays: 7,
  /** Audit requests, waitlists. */
  enquiryMonths: 24,
  /** Rate-limit counters and webhook processing records. */
  technicalLogDays: 30,
  /** Rows per DELETE statement; workspaces per run. */
  batchSize: 500,
  workspacesPerRun: 50,
} as const;

/** Statuses after which Stripe never bills the subscription again. */
const ENDED_STATUSES = ["canceled", "incomplete_expired"];
/** Statuses that do not count as a subscription being in place. */
const NOT_IN_PLACE = [...ENDED_STATUSES, "incomplete"];
const WARNING_ACTION = "workspace.deletion_scheduled";
const DAY_MS = 24 * 60 * 60 * 1000;

/** Dry run unless RETENTION_DRY_RUN is exactly "false". */
export function retentionDryRun(env: Record<string, string | undefined>) {
  return env.RETENTION_DRY_RUN?.trim().toLowerCase() !== "false";
}

export type RetentionReason = "subscription_ended" | "never_subscribed_idle";

export type WorkspaceCandidate = {
  /** When the last subscription ended; null when none ever started. */
  endedAt: Date | null;
  /** Latest of creation, last sign-in and any member's live session. */
  lastActiveAt: Date;
  /** Latest deletion warning sent to the Owner. */
  warnedAt: Date | null;
};

export type RetentionDecision =
  | { action: "keep" }
  | { action: "warn"; reason: RetentionReason; deleteAfter: Date }
  | { action: "delete"; reason: RetentionReason };

/**
 * - Subscription ended: read-only for 30 days, then deleted.
 * - Never subscribed: deleted after 90 days without a sign-in.
 * Either way the Owner is warned first and deletion waits at least 7 days
 * after the warning. A warning older than the latest end or sign-in no
 * longer counts, so a workspace that comes back is never deleted on a stale
 * warning.
 */
export function decideRetention(
  candidate: WorkspaceCandidate,
  now: Date,
): RetentionDecision {
  const reason: RetentionReason = candidate.endedAt
    ? "subscription_ended"
    : "never_subscribed_idle";
  const basis = candidate.endedAt ?? candidate.lastActiveAt;
  const days = candidate.endedAt
    ? RETENTION.endedReadOnlyDays
    : RETENTION.neverSubscribedIdleDays;
  const deleteAfter = basis.getTime() + days * DAY_MS;
  const warningMs = RETENTION.warningDays * DAY_MS;
  if (now.getTime() < deleteAfter - warningMs) return { action: "keep" };
  const warnedAt =
    candidate.warnedAt && candidate.warnedAt >= basis
      ? candidate.warnedAt
      : null;
  if (!warnedAt)
    return {
      action: "warn",
      reason,
      deleteAfter: new Date(Math.max(deleteAfter, now.getTime() + warningMs)),
    };
  if (
    now.getTime() >= deleteAfter &&
    now.getTime() - warnedAt.getTime() >= warningMs
  )
    return { action: "delete", reason };
  return { action: "keep" };
}

export type RetentionReport = {
  dryRun: boolean;
  warned: { organizationId: string; reason: RetentionReason }[];
  deleted: { organizationId: string; reason: RetentionReason }[];
  deletedUsers: number;
  purged: Record<string, number>;
};

export type RetentionOptions = {
  db: Database;
  email: EmailService;
  appOrigin: string;
  logger: Logger;
  dryRun: boolean;
};

type CandidateRow = {
  id: string;
  name: string;
  ended_at: Date | string | null;
  last_active_at: Date | string;
  warned_at: Date | string | null;
  stripe_customer_id: string | null;
};

const asDate = (value: Date | string | null) =>
  value === null ? null : new Date(value);

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? "&#39;",
  );
}

export function createRetention(options: RetentionOptions) {
  const { db, email, appOrigin, logger, dryRun } = options;

  /** Workspaces with no subscription in place; `only` scopes tests. */
  async function candidates(only?: string[]) {
    const scope = only
      ? sql`and o.id in (${sql.join(
          only.map((id) => sql`${id}`),
          sql`, `,
        )})`
      : sql``;
    const rows = await db.execute<CandidateRow>(sql`
      select o.id, o.name,
        s.ended_at,
        greatest(o.created_at, o.last_active_at, (
          select max(se.updated_at) from session se
          join member m on m.user_id = se.user_id
          where m.organization_id = o.id
        )) as last_active_at,
        (select max(a.created_at) from audit_log a
          where a.organization_id = o.id and a.action = ${WARNING_ACTION}
        ) as warned_at,
        (select bc.stripe_customer_id from billing_customers bc
          where bc.organization_id = o.id) as stripe_customer_id
      from organization o
      left join (
        select organization_id,
          bool_or(status not in (${sql.join(
            NOT_IN_PLACE.map((s) => sql`${s}`),
            sql`, `,
          )})) as in_place,
          max(least(current_period_end, updated_at)) filter (
            where status in (${sql.join(
              ENDED_STATUSES.map((s) => sql`${s}`),
              sql`, `,
            )})
          ) as ended_at
        from billing_subscriptions group by organization_id
      ) s on s.organization_id = o.id
      where coalesce(s.in_place, false) = false ${scope}
      order by o.created_at
    `);
    return [...rows];
  }

  async function ownerEmail(organizationId: string) {
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
    return owner ?? null;
  }

  async function warn(
    row: CandidateRow,
    reason: RetentionReason,
    deleteAfter: Date,
    now: Date,
  ) {
    const owner = await ownerEmail(row.id);
    const day = deleteAfter.toISOString().slice(0, 10);
    if (owner && email.enabled) {
      const exportUrl = `${appOrigin}/app/billing`;
      const subject = `Your SeatTrue workspace ${row.name} will be deleted on ${day}`;
      const why =
        reason === "subscription_ended"
          ? "Your subscription has ended and the 30-day read-only period is almost over."
          : "This workspace never started a subscription and nobody has signed in to it for almost 90 days.";
      const body = `${why} On or after ${day} we delete the workspace and all its data: clients, mappings, uploaded bills, reconciliation results and members. Download a full export before then from the billing page. Subscribe or sign in to keep it.`;
      try {
        await email.send({
          to: owner.email,
          subject,
          text: `${subject}\n\n${body}\n\nExport your data: ${exportUrl}`,
          html: `<!doctype html><html lang="en"><body style="font-family:Helvetica,Arial,sans-serif;color:#14211b"><h1 style="font-size:20px">${escapeHtml(subject)}</h1><p style="line-height:1.6">${escapeHtml(body)}</p><p><a href="${escapeHtml(exportUrl)}">Export your data</a></p></body></html>`,
          idempotencyKey: `retention-warning:${row.id}:${day}`,
        });
      } catch (err) {
        // No audit row: the warning is retried on the next run.
        logger.error({
          event: "retention_warning_email_failed",
          organizationId: row.id,
          err,
        });
        return false;
      }
    } else {
      logger.warn({
        event: "retention_warning_not_emailed",
        organizationId: row.id,
        reason: owner ? "email_disabled" : "no_owner",
      });
    }
    await db.insert(auditLog).values({
      organizationId: row.id,
      action: WARNING_ACTION,
      targetType: "organization",
      targetId: row.id,
      after: { reason, deleteAfter: deleteAfter.toISOString() },
      createdAt: now,
    });
    return true;
  }

  /** The org (and every row cascading from it) plus users left with no other workspace. */
  async function deleteWorkspace(organizationId: string) {
    return db.transaction(async (tx) => {
      const orphans = await tx.execute<{ id: string }>(sql`
        select m.user_id as id from member m
        where m.organization_id = ${organizationId}
        and not exists (select 1 from member other
          where other.user_id = m.user_id
          and other.organization_id <> ${organizationId})
      `);
      const userIds = [...orphans].map((row) => row.id);
      await tx
        .update(session)
        .set({ activeOrganizationId: null })
        .where(eq(session.activeOrganizationId, organizationId));
      // Cascades: members, invitations, audit log, clients, customer and SKU
      // mappings, agreement lines, uploaded bills (reconciliation runs and
      // billing imports), exceptions and comments, billing rows.
      await tx.delete(organization).where(eq(organization.id, organizationId));
      // Cascades: sessions, accounts (OAuth tokens), one-time purchases.
      if (userIds.length)
        await tx.delete(user).where(inArray(user.id, userIds));
      return userIds.length;
    });
  }

  /** Deletes matching rows in batches; counts them in a dry run. */
  async function purge(table: PgTable, where: SQL) {
    if (dryRun) {
      const [row] = await db.execute<{ n: number }>(
        sql`select count(*)::int as n from ${table} where ${where}`,
      );
      return row?.n ?? 0;
    }
    let total = 0;
    for (;;) {
      const [row] = await db.execute<{ n: number }>(sql`
        with gone as (
          delete from ${table} where ctid in (
            select ctid from ${table} where ${where} limit ${RETENTION.batchSize}
          ) returning 1
        ) select count(*)::int as n from gone
      `);
      const n = row?.n ?? 0;
      total += n;
      if (n < RETENTION.batchSize) return total;
    }
  }

  return {
    async run(
      now: Date,
      scope: { organizationIds?: string[] } = {},
    ): Promise<RetentionReport> {
      const report: RetentionReport = {
        dryRun,
        warned: [],
        deleted: [],
        deletedUsers: 0,
        purged: {},
      };

      for (const row of await candidates(scope.organizationIds)) {
        const decision = decideRetention(
          {
            endedAt: asDate(row.ended_at),
            lastActiveAt: new Date(row.last_active_at),
            warnedAt: asDate(row.warned_at),
          },
          now,
        );
        if (decision.action === "keep") continue;
        const entry = { organizationId: row.id, reason: decision.reason };
        if (decision.action === "warn") {
          const warned =
            dryRun ||
            (await warn(row, decision.reason, decision.deleteAfter, now));
          if (!warned) continue;
          report.warned.push(entry);
          logger.info({
            event: dryRun
              ? "retention_workspace_would_warn"
              : "retention_workspace_warned",
            ...entry,
            deleteAfter: decision.deleteAfter.toISOString(),
          });
          continue;
        }
        if (report.deleted.length >= RETENTION.workspacesPerRun) continue;
        // Platform-level record: the workspace's own audit log goes with it.
        // Invoices stay in Stripe under this customer for 7 years.
        logger.info({
          event: dryRun
            ? "retention_workspace_would_delete"
            : "retention_workspace_deleted",
          ...entry,
          stripeCustomerId: row.stripe_customer_id,
        });
        if (!dryRun) report.deletedUsers += await deleteWorkspace(row.id);
        report.deleted.push(entry);
      }

      const days = (n: number) => new Date(now.getTime() - n * DAY_MS);
      const months = (n: number) => {
        const date = new Date(now);
        date.setUTCMonth(date.getUTCMonth() - n);
        return date;
      };
      const enquiryCutoff = months(RETENTION.enquiryMonths);
      const logCutoff = days(RETENTION.technicalLogDays);
      const purges: [string, PgTable, SQL | undefined][] = [
        ["sessions", session, lt(session.expiresAt, now)],
        ["verifications", verification, lt(verification.expiresAt, now)],
        ["invitations", invitation, lt(invitation.expiresAt, now)],
        [
          "mcpAccessTokens",
          oauthAccessToken,
          lt(oauthAccessToken.expiresAt, now),
        ],
        [
          "mcpRefreshTokens",
          oauthRefreshToken,
          lt(oauthRefreshToken.expiresAt, now),
        ],
        [
          "rateLimits",
          rateLimit,
          lt(rateLimit.lastRequest, logCutoff.getTime()),
        ],
        [
          "webhookEvents",
          billingWebhookEvents,
          lt(billingWebhookEvents.processedAt, logCutoff),
        ],
        [
          "auditRequests",
          auditRequests,
          lt(auditRequests.updatedAt, enquiryCutoff),
        ],
        [
          "waitlistEntries",
          waitlistEntries,
          lt(waitlistEntries.createdAt, enquiryCutoff),
        ],
        [
          "integrationWaitlist",
          integrationWaitlist,
          lt(integrationWaitlist.createdAt, enquiryCutoff),
        ],
      ];
      for (const [name, table, where] of purges)
        if (where) report.purged[name] = await purge(table, where);

      logger.info({
        event: "retention_job_processed",
        dryRun,
        warned: report.warned.length,
        deleted: report.deleted.length,
        deletedUsers: report.deletedUsers,
        purged: report.purged,
      });
      return report;
    },
  };
}

export type Retention = ReturnType<typeof createRetention>;

/** POST /jobs/retention: daily QStash schedule; any body. */
export function createRetentionRoutes(options: {
  jobs: Pick<JobQueue, "enabled" | "verify"> | null | undefined;
  retention: Retention | null | undefined;
}) {
  const { jobs, retention } = options;
  return new Elysia({ name: "retention-routes" }).post(
    "/jobs/retention",
    async ({ request, status }) => {
      if (!jobs?.enabled || !retention) {
        return status(503, {
          error: {
            code: "JOBS_NOT_CONFIGURED" as const,
            message: "Jobs are not configured for this deployment.",
          },
        });
      }
      const body = await request.text();
      const signature = request.headers.get("upstash-signature");
      if (!signature || !(await jobs.verify("retention", signature, body))) {
        return status(401, {
          error: {
            code: "INVALID_JOB_SIGNATURE" as const,
            message: "Job signature verification failed.",
          },
        });
      }
      // Idempotent: deleted rows are gone, warnings are recorded once.
      return retention.run(new Date());
    },
    { parse: "none" },
  );
}
