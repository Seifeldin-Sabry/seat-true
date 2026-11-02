import { expect, test } from "bun:test";
import type { WorkspaceRole } from "@seattrue/auth-policy";
import { auditRequests, createDatabase, rateLimit } from "@seattrue/db";
import { eq, like } from "drizzle-orm";
import { createApp } from "./app";
import { auditRequestsCsv } from "./audit-requests";
import { createProjectRepository } from "./projects";
import { createReconService } from "./reconciliation";
import { testAuthService, testWorkspace } from "./testing";

const databaseUrl = process.env.TEST_DATABASE_URL;
const integrationTest = databaseUrl ? test : test.skip;
const appOrigin = "http://localhost:3000";

test("the CSV quotes commas and quotes and defuses formulas", () => {
  const csv = auditRequestsCsv([
    {
      email: "a@northbeam-it.com",
      company: 'Northbeam, "IT"',
      clients: "26-75",
      distributor: "Pax8",
      psa: "=HYPERLINK(1)",
      createdAt: "2026-11-02T00:00:00.000Z",
      updatedAt: "2026-11-02T00:00:00.000Z",
    },
  ]);
  expect(csv.split("\r\n")[1]).toBe(
    `a@northbeam-it.com,"Northbeam, ""IT""",26-75,Pax8,'=HYPERLINK(1),2026-11-02T00:00:00.000Z,2026-11-02T00:00:00.000Z`,
  );
});

integrationTest(
  "audit requests: validation, dedupe, rate limit, platform-admin list",
  async () => {
    if (!databaseUrl) return;
    const connection = createDatabase(databaseUrl);
    const db = connection.db;
    const run = crypto.randomUUID().slice(0, 8);
    const ip = `10.8.${run}`;
    const email = `audit-${run}@northbeam-it.com`;
    let role: WorkspaceRole | null = null;
    let userId = `user-${run}`;
    let verified = true;
    const staffId = `staff-${run}`;
    const appFor = () => {
      const auth = testAuthService(
        role ? testWorkspace(role, "org-test", userId) : null,
      );
      return createApp({
        projects: createProjectRepository(db),
        db,
        recon: createReconService(db),
        auth: {
          ...auth,
          getSession: async (headers) => {
            const current = await auth.getSession(headers);
            return (
              current && {
                ...current,
                user: { ...current.user, emailVerified: verified },
              }
            );
          },
        },
        platformAdminEmails: [`${staffId}@northbeam-it.com`],
        allowedOrigins: [appOrigin],
        getClientIp: () => ip,
        logger: { info() {}, warn() {}, error() {} },
      });
    };
    const submit = (body: unknown, origin = appOrigin) =>
      appFor().handle(
        new Request(`${appOrigin}/api/audit-requests`, {
          method: "POST",
          headers: { Origin: origin, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
    const list = (format = "") =>
      appFor().handle(
        new Request(`${appOrigin}/api/admin/audit-requests${format}`),
      );
    const valid = {
      email,
      company: "Northbeam IT",
      clients: "26-75",
      distributor: "Pax8",
      psa: "HaloPSA",
    };

    try {
      // Validation (each counts toward the per-IP limit).
      expect((await submit({ ...valid, clients: "500" })).status).toBe(422);
      expect((await submit({ ...valid, psa: "Kaseya" })).status).toBe(422);
      expect((await submit({ ...valid, company: "  " })).status).toBe(422);
      const personal = await submit({ ...valid, email: `x-${run}@gmail.com` });
      expect((await personal.json()).error.code).toBe("WORK_EMAIL_REQUIRED");
      expect((await submit(valid, "https://evil.test")).status).toBe(403);

      // Dedupe: the same address again (any case) updates the one row.
      expect((await submit(valid)).status).toBe(201);
      await db.delete(rateLimit).where(like(rateLimit.key, `%${run}%`));
      const again = await submit({
        ...valid,
        email: email.toUpperCase(),
        clients: "76-150",
        distributor: "Microsoft Partner Center",
      });
      expect(again.status).toBe(201);
      expect(await again.json()).toEqual({ requested: true });
      const rows = await db
        .select()
        .from(auditRequests)
        .where(eq(auditRequests.email, email));
      expect(
        rows.map((row) => [row.clients, row.distributor, row.psa]),
      ).toEqual([["76-150", "Microsoft Partner Center", "HaloPSA"]]);

      // Rate limit: 5 handled requests per IP per window (1 so far).
      for (let index = 0; index < 4; index++)
        expect((await submit(valid)).status).toBe(201);
      const limited = await submit(valid);
      expect(limited.status).toBe(429);
      expect((await limited.json()).error.code).toBe("RATE_LIMITED");

      // List: platform admins only. A workspace owner is not enough.
      expect((await list()).status).toBe(401);
      for (const denied of ["owner", "admin", "tech"] as const) {
        role = denied;
        expect((await list()).status).toBe(403);
      }
      expect((await list("?format=csv")).status).toBe(403);
      userId = staffId;
      verified = false;
      expect((await list()).status).toBe(403);
      verified = true;
      const response = await list();
      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        requests: { email: string; company: string }[];
      };
      expect(body.requests.find((row) => row.email === email)?.company).toBe(
        "Northbeam IT",
      );
      const csv = await list("?format=csv");
      expect(csv.status).toBe(200);
      expect(csv.headers.get("content-type")).toContain("text/csv");
      expect(await csv.text()).toContain(email);
    } finally {
      await db.delete(auditRequests).where(eq(auditRequests.email, email));
      await db.delete(rateLimit).where(like(rateLimit.key, `%${run}%`));
      await connection.close();
    }
  },
);
