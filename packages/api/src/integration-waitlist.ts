import {
  isWorkEmail,
  WORK_EMAIL_REQUIRED_MESSAGE,
} from "@seattrue/auth-policy";
import { type Database, integrationWaitlist, rateLimit } from "@seattrue/db";
import { count, sql } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { type AuthService, isPlatformAdmin } from "./auth";

/**
 * Coming soon integrations that take sign-ups. Must equal the "soon" slugs in
 * apps/app/src/lib/integrations.ts (locked by structured-data.test.ts).
 */
export const waitlistIntegrationSlugs = [
  "pax8-api",
  "giacom",
  "sherweb",
  "partner-center-api",
  "connectwise",
  "autotask",
  "halopsa",
  "mcp-server",
] as const;

export type IntegrationWaitlistCountDto = { slug: string; count: number };

/**
 * Fixed-window limit kept in Postgres (Better Auth's rate_limit table), so it
 * works with the Redis cache off. Returns false once `max` hits land in the window.
 */
export async function allowRequest(
  db: Database,
  key: string,
  max: number,
  windowMs: number,
  now = Date.now(),
): Promise<boolean> {
  const [row] = await db
    .insert(rateLimit)
    .values({ id: crypto.randomUUID(), key, count: 1, lastRequest: now })
    .onConflictDoUpdate({
      target: rateLimit.key,
      set: {
        count: sql`case when ${rateLimit.lastRequest} < ${now - windowMs} then 1 else ${rateLimit.count} + 1 end`,
        lastRequest: sql`case when ${rateLimit.lastRequest} < ${now - windowMs} then ${now} else ${rateLimit.lastRequest} end`,
      },
    })
    .returning({ count: rateLimit.count });
  return (row?.count ?? 0) <= max;
}

export type IntegrationWaitlistOptions = {
  db: Database;
  auth: Pick<AuthService, "getSession">;
  /** Who may read the SeatTrue-wide counts. Empty means nobody. */
  platformAdminEmails: readonly string[];
  allowedOrigins: string[];
  /** Sign-ups per client IP per window. */
  limit?: { max: number; windowMs: number };
};

export function createIntegrationWaitlistRoutes({
  db,
  auth,
  platformAdminEmails,
  allowedOrigins,
  limit = { max: 5, windowMs: 10 * 60_000 },
}: IntegrationWaitlistOptions) {
  const trustedOrigins = new Set(allowedOrigins);
  return (
    new Elysia({ name: "integration-waitlist-routes" })
      // Public "Notify me when it's live" form. No email is sent yet.
      .post(
        "/integrations/waitlist",
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
              `integration-waitlist:${ip}`,
              limit.max,
              limit.windowMs,
            ))
          )
            return status(429, {
              error: {
                code: "RATE_LIMITED" as const,
                message: "Too many sign-ups from here. Try again later.",
              },
            });
          if (!isWorkEmail(body.email))
            return status(422, {
              error: {
                code: "WORK_EMAIL_REQUIRED" as const,
                message: WORK_EMAIL_REQUIRED_MESSAGE,
              },
            });
          // Same email + integration again is a no-op that still succeeds.
          await db
            .insert(integrationWaitlist)
            .values({
              slug: body.slug,
              email: body.email.trim().toLowerCase(),
              company: body.company?.trim() || null,
            })
            .onConflictDoNothing();
          return status(201, { joined: true as const });
        },
        {
          body: t.Object(
            {
              slug: t.UnionEnum(waitlistIntegrationSlugs),
              email: t.String({ format: "email", maxLength: 254 }),
              company: t.Optional(t.String({ maxLength: 160 })),
            },
            { additionalProperties: false },
          ),
        },
      )
      // SeatTrue-wide demand: platform admins only, never workspace owners.
      .get("/integrations/waitlist/counts", async ({ request, status }) => {
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
          .select({ slug: integrationWaitlist.slug, count: count() })
          .from(integrationWaitlist)
          .groupBy(integrationWaitlist.slug);
        const bySlug = new Map(rows.map((row) => [row.slug, row.count]));
        return {
          counts: waitlistIntegrationSlugs.map(
            (slug): IntegrationWaitlistCountDto => ({
              slug,
              count: bySlug.get(slug) ?? 0,
            }),
          ),
        };
      })
  );
}
