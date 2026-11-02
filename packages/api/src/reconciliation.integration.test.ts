import { expect, test } from "bun:test";
import {
  auditLog,
  createDatabase,
  organization,
  user,
  waitlistEntries,
} from "@seattrue/db";
import { eq, inArray } from "drizzle-orm";
import { createApp } from "./app";
import type { AuthService } from "./auth";
import { createProjectRepository } from "./projects";
import {
  ClientLockedError,
  CsvRejectedError,
  createReconService,
} from "./reconciliation";
import { testAuthService, testWorkspace } from "./testing";

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
    await connection.db
      .insert(organization)
      .values([ownerId, otherId].map((id) => ({ id, name: id, slug: id })));

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
      await recon.setExceptionStatus(ownerId, harbor.id, "billed", null);
      // Flag and comment survive recomputes (exception ids are stable).
      await recon.setExceptionFlag(ownerId, harbor.id, true, null);
      await connection.db.insert(user).values({
        id: ownerId,
        name: "Tech",
        email: `${ownerId}@northbeam-it.com`,
      });
      await recon.addComment(ownerId, harbor.id, "Check the PSA", {
        userId: ownerId,
        email: `${ownerId}@northbeam-it.com`,
      });

      const summit = overview.clients.find((client) =>
        client.name.startsWith("Summit"),
      );
      if (!summit) throw new Error("Expected Summit client");
      expect(await recon.setMapping(ownerId, "PX-21777", summit.id, null)).toBe(
        true,
      );

      const fixed = await recon.overview(ownerId);
      const harborAfter = (await recon.exceptions(ownerId)).find(
        (entry) => entry.id === harbor.id,
      );
      expect(harborAfter).toMatchObject({
        status: "billed",
        flagged: true,
        commentCount: 1,
      });
      expect(
        (await recon.comments(ownerId, harbor.id))?.map((entry) => entry.body),
      ).toEqual(["Check the PSA"]);
      expect(await recon.comments(otherId, harbor.id)).toBeNull();
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
      expect(await recon.setMapping(otherId, "PX-1", summit.id, null)).toBe(
        false,
      );
      expect(
        await recon.setExceptionStatus(otherId, harbor.id, "dismissed", null),
      ).toBeNull();

      await expect(
        recon.uploadRun(ownerId, "bad.csv", "nothing,useful\n1,2"),
      ).rejects.toBeInstanceOf(CsvRejectedError);
    } finally {
      await connection.db
        .delete(organization)
        .where(inArray(organization.id, [ownerId, otherId]));
      await connection.db.delete(user).where(eq(user.id, ownerId));
      await connection.close();
    }
  },
);

integrationTest("routes enforce auth, origin and CSV validation", async () => {
  if (!databaseUrl) return;
  const connection = createDatabase(databaseUrl);
  const ownerId = `recon-${crypto.randomUUID()}`;
  await connection.db
    .insert(organization)
    .values({ id: ownerId, name: ownerId, slug: ownerId });
  let signedIn = false;
  const signedInAuth = testAuthService(testWorkspace("owner", ownerId));
  const signedOutAuth = testAuthService(null);
  const auth: AuthService = {
    ...signedInAuth,
    getSession: (headers) =>
      (signedIn ? signedInAuth : signedOutAuth).getSession(headers),
    getWorkspaceSession: (headers) =>
      (signedIn ? signedInAuth : signedOutAuth).getWorkspaceSession(headers),
  };
  const app = createApp({
    projects: createProjectRepository(connection.db),
    db: connection.db,
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
      new Request(`http://localhost/api${path}`, {
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
    await connection.db
      .delete(organization)
      .where(eq(organization.id, ownerId));
    await connection.close();
  }
});

integrationTest(
  "client billing CSV fills the billed side, re-runs and keeps statuses",
  async () => {
    if (!databaseUrl) return;
    const connection = createDatabase(databaseUrl);
    const db = connection.db;
    const recon = createReconService(db);
    const orgId = `billing-${crypto.randomUUID()}`;
    await db
      .insert(organization)
      .values({ id: orgId, name: orgId, slug: orgId });
    const actor = { userId: orgId, email: `${orgId}@northbeam-it.com` };
    await db
      .insert(user)
      .values({ id: actor.userId, name: "Ops", email: actor.email });

    try {
      const acme = await recon.createClient(orgId, {
        name: "Acme Corp",
        markupPct: 20,
      });
      const beta = await recon.createClient(orgId, {
        name: "Beta LLC",
        psaId: "CW-42",
        markupPct: 20,
      });
      const frozen = await recon.createClient(orgId, {
        name: "Frozen Inc",
        markupPct: 20,
      });
      await recon.uploadRun(
        orgId,
        "pax8.csv",
        [
          "Company ID,Company Name,SKU,Product Name,Quantity,Cost",
          "PX-1,Acme Pax8 Name,BP,Business Premium,12,$22.00",
          "PX-1,Acme Pax8 Name,E3,Office 365 E3,5,$23.00",
          "PX-2,Beta,BS,Business Standard,4,$12.50",
        ].join("\n"),
      );
      await recon.setMapping(orgId, "PX-1", acme.id, null);
      await recon.setMapping(orgId, "PX-2", beta.id, null);
      // No billed side yet: everything on the bill is unbilled.
      expect(
        (await recon.exceptions(orgId)).every(
          (entry) => entry.kind === "unbilled_seats",
        ),
      ).toBe(true);

      // Lock Frozen Inc the way a downgrade would.
      await recon.applyLocks(orgId, [frozen.id], [], new Date());

      const billing = [
        "Company Name,Product ID,Description,Quantity,Unit Price,Period",
        // Matched by the mapped Pax8 customer's name.
        "Acme Pax8 Name,BP,Business Premium,10,$26.40,2026-11",
        "Acme Corp,E3,Office 365 E3,5,$25.00,2026-11",
        // Matched by PSA ID.
        "CW-42,BS,Business Standard,6,$15.00,2026-11",
        "Frozen Inc,BP,Business Premium,1,$26.40,2026-11",
        "Gamma Dental,BP,Business Premium,3,$26.40,2026-11",
      ].join("\n");
      const imported = await recon.importBilling(
        orgId,
        "psa.csv",
        billing,
        actor,
      );
      expect(imported).toMatchObject({
        lineCount: 5,
        agreementCount: 3,
        matchedClients: 2,
        unmapped: [{ clientName: "Gamma Dental", lineCount: 1 }],
        skippedClients: ["Frozen Inc"],
      });

      const kinds = (await recon.exceptions(orgId))
        .map((entry) => `${entry.kind}:${entry.sku}`)
        .sort();
      expect(kinds).toEqual([
        "overbilled:BS",
        "stale_price:E3",
        "unbilled_seats:BP",
      ]);
      expect((await recon.mappings(orgId)).unmappedBilling).toEqual([
        {
          clientName: "Gamma Dental",
          lineCount: 1,
          seats: 3,
          monthlyBilledCents: 7920,
        },
      ]);
      expect((await recon.overview(orgId)).billingImport).toMatchObject({
        fileName: "psa.csv",
        unmappedCount: 1,
      });

      // Statuses survive a re-upload.
      const stale = (await recon.exceptions(orgId)).find(
        (entry) => entry.kind === "stale_price",
      );
      if (!stale) throw new Error("Expected stale price");
      await recon.setExceptionStatus(orgId, stale.id, "approved", null);
      await recon.importBilling(orgId, "psa.csv", billing, actor);
      expect(
        (await recon.exceptions(orgId)).find((entry) => entry.id === stale.id)
          ?.status,
      ).toBe("approved");

      // Bad rows: nothing stored, every row reported.
      const rejected = await recon
        .importBilling(
          orgId,
          "bad.csv",
          "Client,SKU,Qty,Price\nAcme Corp,BP,x,1\nAcme Corp,BP,1,",
          actor,
        )
        .catch((error: unknown) => error);
      expect(rejected).toBeInstanceOf(CsvRejectedError);
      expect(
        (rejected as CsvRejectedError).rows.map((row) => row.rowNumber),
      ).toEqual([2, 3]);
      expect(
        (await recon.client(orgId, acme.id))?.agreements.map(
          (line) => line.sku,
        ),
      ).toEqual(["BP", "E3"]);

      // Manual edit fixes the price; the stale exception disappears.
      await recon.setAgreementLines(
        orgId,
        acme.id,
        [
          { sku: "BP", quantity: 12, unitPriceCents: 2640 },
          {
            sku: "E3",
            productName: "Office 365 E3",
            quantity: 5,
            unitPriceCents: 2760,
          },
        ],
        actor,
      );
      expect(
        (await recon.exceptions(orgId)).map((entry) => entry.kind),
      ).toEqual(["overbilled"]);
      await expect(
        recon.setAgreementLines(orgId, frozen.id, [], actor),
      ).rejects.toBeInstanceOf(ClientLockedError);

      // Mapping an unmapped billing name moves its rows and is remembered.
      const gamma = await recon.createClient(orgId, {
        name: "Gamma Dental Group",
        markupPct: 20,
      });
      expect(
        await recon.mapBillingClient(orgId, "Gamma Dental", gamma.id, actor),
      ).toBe(true);
      expect((await recon.client(orgId, gamma.id))?.agreements).toMatchObject([
        { sku: "BP", quantity: 3, unitPriceCents: 2640 },
      ]);
      expect((await recon.mappings(orgId)).unmappedBilling).toEqual([]);
      const again = await recon.importBilling(orgId, "psa.csv", billing, actor);
      expect(again.unmapped).toEqual([]);
      // The billing alias never shows up as a distributor mapping.
      expect(
        (await recon.mappings(orgId)).mappings.map(
          (entry) => entry.customerKey,
        ),
      ).toEqual(["PX-1", "PX-2"]);

      const actions = (
        await db
          .select({ action: auditLog.action })
          .from(auditLog)
          .where(eq(auditLog.organizationId, orgId))
      ).map((row) => row.action);
      expect(actions).toContain("billing.import");
      expect(actions).toContain("billing.lines_edit");
    } finally {
      await db.delete(organization).where(eq(organization.id, orgId));
      await db.delete(user).where(eq(user.id, orgId));
      await connection.close();
    }
  },
);

integrationTest(
  "SKU aliases resolve PSA product IDs before comparing",
  async () => {
    if (!databaseUrl) return;
    const connection = createDatabase(databaseUrl);
    const db = connection.db;
    const recon = createReconService(db);
    const orgId = `sku-${crypto.randomUUID()}`;
    await db
      .insert(organization)
      .values({ id: orgId, name: orgId, slug: orgId });
    try {
      const acme = await recon.createClient(orgId, {
        name: "Acme Corp",
        markupPct: 20,
      });
      await recon.uploadRun(
        orgId,
        "pax8.csv",
        "Company ID,Company Name,SKU,Product Name,Quantity,Cost\nPX-1,Acme,CFQ7TTC0LCHC,Business Premium,10,$22.00",
      );
      await recon.setMapping(orgId, "PX-1", acme.id, null);
      await recon.importBilling(
        orgId,
        "psa.csv",
        "Client,Product ID,Description,Qty,Unit Price\nAcme Corp,M365-BP,Business Premium,10,$26.40\nAcme Corp,MSP-GOLD,Managed Services Gold,1,$1500.00",
        null,
      );
      const kinds = async () =>
        (await recon.exceptions(orgId))
          .map((entry) => `${entry.kind}:${entry.sku}`)
          .sort();
      expect(await kinds()).toEqual([
        "overbilled:M365-BP",
        "overbilled:MSP-GOLD",
        "unbilled_seats:CFQ7TTC0LCHC",
      ]);
      const before = await recon.mappings(orgId);
      expect(before.billedSkus).toMatchObject([
        { sku: "M365-BP", clientCount: 1, quantity: 10, aliasSku: null },
        { sku: "MSP-GOLD", aliasSku: null },
      ]);
      expect(before.vendorSkus).toEqual([
        { sku: "CFQ7TTC0LCHC", productName: "Business Premium" },
      ]);

      await recon.setSkuAlias(orgId, "M365-BP", "CFQ7TTC0LCHC", null);
      await recon.setSkuAlias(orgId, "MSP-GOLD", "", null);
      expect(await kinds()).toEqual([]);
      expect(
        (await recon.mappings(orgId)).billedSkus.map((entry) => [
          entry.sku,
          entry.aliasSku,
        ]),
      ).toEqual([
        ["M365-BP", "CFQ7TTC0LCHC"],
        ["MSP-GOLD", ""],
      ]);
    } finally {
      await db.delete(organization).where(eq(organization.id, orgId));
      await connection.close();
    }
  },
);
