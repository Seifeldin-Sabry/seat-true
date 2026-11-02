import {
  isWorkEmail,
  WORK_EMAIL_REQUIRED_MESSAGE,
} from "@seattrue/auth-policy";
import { auditRequests, type Database } from "@seattrue/db";
import { desc, sql } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { type AuthService, isPlatformAdmin } from "./auth";
import { allowRequest } from "./integration-waitlist";

export const auditClientCounts = ["1-25", "26-75", "76-150", "150+"] as const;
export const auditDistributors = [
  "Pax8",
  "Microsoft Partner Center",
  "Giacom",
  "Sherweb",
  "Other",
] as const;
export const auditPsas = [
  "ConnectWise",
  "Autotask",
  "HaloPSA",
  "Other",
  "None",
] as const;

export type AuditRequestDto = {
  email: string;
  company: string;
  clients: string;
  distributor: string;
  psa: string;
  createdAt: string;
  updatedAt: string;
};

const csvColumns = [
  "email",
  "company",
  "clients",
  "distributor",
  "psa",
  "createdAt",
  "updatedAt",
] as const;

/** RFC 4180 quoting, plus a leading ' on cells a spreadsheet would run as a formula. */
function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function auditRequestsCsv(rows: AuditRequestDto[]): string {
  const lines = rows.map((row) =>
    csvColumns.map((column) => csvCell(row[column])).join(","),
  );
  return `${[csvColumns.join(","), ...lines].join("\r\n")}\r\n`;
}

export type AuditRequestRoutesOptions = {
  db: Database;
  auth: Pick<AuthService, "getSession">;
  /** Who may read the requests. Empty means nobody. */
  platformAdminEmails: readonly string[];
  allowedOrigins: string[];
  /** Requests per client IP per window. */
  limit?: { max: number; windowMs: number };
};

export function createAuditRequestRoutes({
  db,
  auth,
  platformAdminEmails,
  allowedOrigins,
  limit = { max: 5, windowMs: 10 * 60_000 },
}: AuditRequestRoutesOptions) {
  const trustedOrigins = new Set(allowedOrigins);
  return (
    new Elysia({ name: "audit-request-routes" })
      // Public free margin audit form. No email is sent; staff follow up by hand.
      .post(
        "/audit-requests",
        async ({ request, body, status }) => {
          if (!trustedOrigins.has(request.headers.get("origin") ?? ""))
            return status(403, {
              error: {
                code: "INVALID_ORIGIN" as const,
                message: "Origin not allowed.",
              },
            });
          // x-real-ip is set by the app from the trusted proxy header only.
          const ip = request.headers.get("x-real-ip") ?? "unknown";
          if (
            !(await allowRequest(
              db,
              `audit-request:${ip}`,
              limit.max,
              limit.windowMs,
            ))
          )
            return status(429, {
              error: {
                code: "RATE_LIMITED" as const,
                message: "Too many requests from here. Try again later.",
              },
            });
          if (!isWorkEmail(body.email))
            return status(422, {
              error: {
                code: "WORK_EMAIL_REQUIRED" as const,
                message: WORK_EMAIL_REQUIRED_MESSAGE,
              },
            });
          const company = body.company.trim();
          if (!company)
            return status(422, {
              error: {
                code: "COMPANY_REQUIRED" as const,
                message: "Add your MSP name.",
              },
            });
          const values = {
            company,
            clients: body.clients,
            distributor: body.distributor,
            psa: body.psa,
          };
          // Same email again updates the request and still succeeds.
          await db
            .insert(auditRequests)
            .values({ email: body.email.trim().toLowerCase(), ...values })
            .onConflictDoUpdate({
              target: auditRequests.email,
              set: { ...values, updatedAt: sql`now()` },
            });
          return status(201, { requested: true as const });
        },
        {
          body: t.Object(
            {
              email: t.String({ format: "email", maxLength: 254 }),
              company: t.String({ minLength: 1, maxLength: 160 }),
              clients: t.UnionEnum(auditClientCounts),
              distributor: t.UnionEnum(auditDistributors),
              psa: t.UnionEnum(auditPsas),
            },
            { additionalProperties: false },
          ),
        },
      )
      // SeatTrue staff only, never workspace owners. Newest first; ?format=csv to export.
      .get(
        "/admin/audit-requests",
        async ({ request, query, status }) => {
          const current = await auth.getSession(request.headers);
          if (!current)
            return status(401, {
              error: {
                code: "UNAUTHORIZED" as const,
                message: "Sign in required.",
              },
            });
          if (!isPlatformAdmin(current.user, platformAdminEmails))
            return status(403, {
              error: {
                code: "FORBIDDEN" as const,
                message: "Only SeatTrue staff can see this.",
              },
            });
          const rows = await db
            .select()
            .from(auditRequests)
            .orderBy(desc(auditRequests.updatedAt));
          const requests = rows.map(
            (row): AuditRequestDto => ({
              email: row.email,
              company: row.company,
              clients: row.clients,
              distributor: row.distributor,
              psa: row.psa,
              createdAt: row.createdAt.toISOString(),
              updatedAt: row.updatedAt.toISOString(),
            }),
          );
          if (query.format === "csv")
            return new Response(auditRequestsCsv(requests), {
              headers: {
                "content-type": "text/csv; charset=utf-8",
                "content-disposition":
                  'attachment; filename="audit-requests.csv"',
                "cache-control": "private, no-store",
              },
            });
          return { requests };
        },
        { query: t.Object({ format: t.Optional(t.Literal("csv")) }) },
      )
  );
}
