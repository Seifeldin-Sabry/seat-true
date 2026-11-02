import { expect, test } from "bun:test";
import { createDatabase, user, waitlistEntries } from "@seattrue/db";
import { eq, inArray } from "drizzle-orm";
import { createApp } from "./app";
import type { AuthService } from "./auth";
import { createProjectRepository } from "./projects";
import { CsvRejectedError, createReconService } from "./reconciliation";

const databaseUrl = process.env.TEST_DATABASE_URL;
const integrationTest = databaseUrl ? test : test.skip;
const appOrigin = "http://localhost:3000";

integrationTest(
  "demo run surfaces leakage, survives mapping fixes and isolates owners",
  async () => {
    if (!databaseUrl) return;
    const connection = createDatabase(databaseUrl);
    const recon = createReconService(connection.db);
    const ownerId = `recon-${crypto.randomUUID()}`;
    const otherId = `recon-${crypto.randomUUID()}`;
    await connection.db.insert(user).values(
      [ownerId, otherId].map((id) => ({
        id,
        name: id,
        email: `${id}@example.test`,
      })),
    );

    try {
      const run = await recon.loadDemo(ownerId);
      expect(run.customerCount).toBe(9);

      const overview = await recon.overview(ownerId);
      expect(overview.leakageCents).toBe(54810);
      expect(overview.overbilledCents).toBe(9760 + 8250);
      expect(overview.byKind.ghost_license.count).toBe(2);
      expect(overview.clients).toHaveLength(8);

      const mappings = await recon.mappings(ownerId);
      expect(mappings.unmapped.map((entry) => entry.customerKey)).toEqual([
        "PX-21777",
      ]);

      // A status set before a mapping fix must survive the recompute.
      const exceptions = await recon.exceptions(ownerId);
      const harbor = exceptions.find(
        (entry) =>
          entry.kind === "unbilled_seats" &&
          entry.clientName === "Harbor Dental Group",
      );
      if (!harbor) throw new Error("Expected Harbor unbilled seats");
      await recon.setExceptionStatus(ownerId, harbor.id, "billed");

      const summit = overview.clients.find((client) =>
        client.name.startsWith("Summit"),
      );
      if (!summit) throw new Error("Expected Summit client");
      expect(await recon.setMapping(ownerId, "PX-21777", summit.id)).toBe(true);

      const fixed = await recon.overview(ownerId);
      // Maple's 9 Standard seats now count as unbilled for Summit at +18%.
      expect(fixed.leakageCents).toBe(54810 - 11250 + 9 * 1475);
      expect(fixed.recoveredCents).toBe(10560);
      expect(fixed.byKind.unmapped_customer.count).toBe(0);

      const detail = await recon.client(ownerId, summit.id);
      expect(detail?.customerKeys.sort()).toEqual(["PX-20377", "PX-21777"]);
      expect(detail?.exceptions.map((entry) => entry.kind)).toEqual([
        "unbilled_seats",
      ]);

      // Owner isolation.
      expect((await recon.overview(otherId)).run).toBeNull();
      expect(await recon.client(otherId, summit.id)).toBeNull();
      expect(await recon.setMapping(otherId, "PX-1", summit.id)).toBe(false);
      expect(
        await recon.setExceptionStatus(otherId, harbor.id, "dismissed"),
      ).toBeNull();

      await expect(
        recon.uploadRun(ownerId, "bad.csv", "nothing,useful\n1,2"),
      ).rejects.toBeInstanceOf(CsvRejectedError);
    } finally {
      await connection.db
        .delete(user)
        .where(inArray(user.id, [ownerId, otherId]));
      await connection.close();
    }
  },
);

integrationTest("routes enforce auth, origin and CSV validation", async () => {
  if (!databaseUrl) return;
  const connection = createDatabase(databaseUrl);
  const ownerId = `recon-${crypto.randomUUID()}`;
  await connection.db
    .insert(user)
    .values({ id: ownerId, name: ownerId, email: `${ownerId}@example.test` });
  let signedIn = false;
  const auth: AuthService = {
    emailEnabled: false,
    handler: async () => new Response("Not found", { status: 404 }),
    getSession: async () =>
      signedIn
        ? {
            user: { id: ownerId, email: "x@example.test", name: "x" },
            session: { id: "s", userId: ownerId },
          }
        : null,
  };
  const app = createApp({
    projects: createProjectRepository(connection.db),
    recon: createReconService(connection.db),
    auth,
    allowedOrigins: [appOrigin],
    logger: { info() {}, warn() {}, error() {} },
  });
  const call = (
    method: string,
    path: string,
    body?: unknown,
    origin = appOrigin,
  ) =>
    app.handle(
      new Request(`http://localhost${path}`, {
        method,
        headers: { Origin: origin, "Content-Type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
    );
  const email = `${crypto.randomUUID()}@example.test`;

  try {
    expect((await call("GET", "/recon/overview")).status).toBe(401);
    signedIn = true;
    expect(
      (await call("POST", "/recon/demo", undefined, "https://evil.test"))
        .status,
    ).toBe(403);

    const bad = await call("POST", "/recon/runs", {
      fileName: "bad.csv",
      csv: "a,b\n1,2",
    });
    expect(bad.status).toBe(422);
    expect((await bad.json()).error.code).toBe("INVALID_CSV");

    expect(
      (
        await call("PATCH", `/recon/exceptions/${crypto.randomUUID()}`, {
          status: "nope",
        })
      ).status,
    ).toBe(422);
    expect(
      (await call("GET", `/recon/clients/${crypto.randomUUID()}`)).status,
    ).toBe(404);

    signedIn = false;
    expect(
      (await call("POST", "/waitlist", { email: "not-an-email" })).status,
    ).toBe(422);
    const personal = await call("POST", "/waitlist", {
      email: "owner@gmail.com",
    });
    expect(personal.status).toBe(422);
    expect((await personal.json()).error.code).toBe("WORK_EMAIL_REQUIRED");
    const joined = await call("POST", "/waitlist", {
      email,
      company: "Acme MSP",
      seats: 400,
    });
    expect(joined.status).toBe(201);
    // Re-joining is idempotent.
    expect((await call("POST", "/waitlist", { email })).status).toBe(201);
  } finally {
    await connection.db
      .delete(waitlistEntries)
      .where(eq(waitlistEntries.email, email));
    await connection.db.delete(user).where(eq(user.id, ownerId));
    await connection.close();
  }
});
