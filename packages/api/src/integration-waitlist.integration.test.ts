import { expect, test } from "bun:test";
import type { WorkspaceRole } from "@seattrue/auth-policy";
import { createDatabase, integrationWaitlist, rateLimit } from "@seattrue/db";
import { eq, like } from "drizzle-orm";
import { createApp } from "./app";
import { allowRequest } from "./integration-waitlist";
import { createProjectRepository } from "./projects";
import { createReconService } from "./reconciliation";
import { testAuthService, testWorkspace } from "./testing";

const databaseUrl = process.env.TEST_DATABASE_URL;
const integrationTest = databaseUrl ? test : test.skip;
const appOrigin = "http://localhost:3000";

integrationTest(
  "integration waitlist: validation, dedupe, rate limit, owner-only counts",
  async () => {
    if (!databaseUrl) return;
    const connection = createDatabase(databaseUrl);
    const db = connection.db;
    const run = crypto.randomUUID().slice(0, 8);
    const ip = `10.9.${run}`;
    const email = `notify-${run}@northbeam-it.com`;
    let role: WorkspaceRole | null = null;
    const appFor = () =>
      createApp({
        projects: createProjectRepository(db),
        db,
        recon: createReconService(db),
        auth: testAuthService(role ? testWorkspace(role) : null),
        allowedOrigins: [appOrigin],
        getClientIp: () => ip,
        logger: { info() {}, warn() {}, error() {} },
      });
    const signUp = (body: unknown, origin = appOrigin) =>
      appFor().handle(
        new Request(`${appOrigin}/api/integrations/waitlist`, {
          method: "POST",
          headers: { Origin: origin, "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
    const counts = () =>
      appFor().handle(
        new Request(`${appOrigin}/api/integrations/waitlist/counts`),
      );

    try {
      // Validation: unknown or live slug, bad email, personal email, origin.
      expect((await signUp({ slug: "pax8-csv", email })).status).toBe(422);
      expect((await signUp({ slug: "nope", email })).status).toBe(422);
      expect(
        (await signUp({ slug: "halopsa", email: "not-an-email" })).status,
      ).toBe(422);
      const personal = await signUp({
        slug: "halopsa",
        email: `x-${run}@gmail.com`,
      });
      expect((await personal.json()).error.code).toBe("WORK_EMAIL_REQUIRED");
      expect(
        (await signUp({ slug: "halopsa", email }, "https://evil.test")).status,
      ).toBe(403);

      // Dedupe: same email + slug twice (any case) succeeds and stores one row.
      const first = await signUp({ slug: "halopsa", email, company: "Acme" });
      expect(first.status).toBe(201);
      expect(await first.json()).toEqual({ joined: true });
      expect(
        (await signUp({ slug: "halopsa", email: email.toUpperCase() })).status,
      ).toBe(201);
      const rows = await db
        .select()
        .from(integrationWaitlist)
        .where(eq(integrationWaitlist.email, email));
      expect(rows.map((row) => [row.slug, row.company])).toEqual([
        ["halopsa", "Acme"],
      ]);

      // Rate limit: 5 handled requests per IP per window (3 so far).
      expect((await signUp({ slug: "autotask", email })).status).toBe(201);
      expect((await signUp({ slug: "giacom", email })).status).toBe(201);
      const limited = await signUp({ slug: "sherweb", email });
      expect(limited.status).toBe(429);
      expect((await limited.json()).error.code).toBe("RATE_LIMITED");

      // Window resets.
      const key = `unit-${run}`;
      expect(await allowRequest(db, key, 1, 1000, 10_000)).toBe(true);
      expect(await allowRequest(db, key, 1, 1000, 10_500)).toBe(false);
      expect(await allowRequest(db, key, 1, 1000, 12_000)).toBe(true);

      // Counts: owners only.
      expect((await counts()).status).toBe(401);
      for (const denied of ["admin", "tech"] as const) {
        role = denied;
        expect((await counts()).status).toBe(403);
      }
      role = "owner";
      const response = await counts();
      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        counts: { slug: string; count: number }[];
      };
      expect(body.counts.map((entry) => entry.slug)).toContain("halopsa");
      expect(
        body.counts.find((entry) => entry.slug === "halopsa")?.count,
      ).toBeGreaterThanOrEqual(1);
    } finally {
      await db
        .delete(integrationWaitlist)
        .where(eq(integrationWaitlist.email, email));
      await db.delete(rateLimit).where(like(rateLimit.key, `%${run}%`));
      await connection.close();
    }
  },
);
