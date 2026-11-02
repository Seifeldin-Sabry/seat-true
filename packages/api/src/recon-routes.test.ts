import { expect, test } from "bun:test";
import { createReconRoutes } from "./recon-routes";
import { CsvRejectedError, type ReconService } from "./reconciliation";
import { testGuard, testWorkspace } from "./testing";

test("lapsed subscriptions are read-only: reads work, writes get 402", async () => {
  const recon = {
    overview: async () => ({ run: null }),
    loadDemo: async () => {
      throw new Error("must not run");
    },
  } as unknown as ReconService;
  const routes = createReconRoutes({
    recon,
    guard: testGuard(testWorkspace("owner")),
    allowedOrigins: ["http://localhost:3000"],
    canWrite: async () => false,
  });
  const read = await routes.handle(
    new Request("http://localhost/recon/overview"),
  );
  expect(read.status).toBe(200);
  const write = await routes.handle(
    new Request("http://localhost/recon/demo", {
      method: "POST",
      headers: { origin: "http://localhost:3000" },
    }),
  );
  expect(write.status).toBe(402);
  expect((await write.json()).error.code).toBe("SUBSCRIPTION_INACTIVE");
});

const origin = "http://localhost:3000";
const billingRequest = (path: string, method: string, body: unknown) =>
  new Request(`http://localhost${path}`, {
    method,
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

test("billing CSV upload: auth, Pax8-upload permission, per-row errors", async () => {
  const calls: string[] = [];
  const recon = {
    importBilling: async (_org: string, _name: string, csv: string) => {
      calls.push(csv);
      if (csv === "bad")
        throw new CsvRejectedError("1 row could not be read", [
          { rowNumber: 3, message: "unit price is required." },
        ]);
      return { fileName: "b.csv", lineCount: 1 };
    },
    mapBillingClient: async () => true,
  } as unknown as ReconService;
  const routesFor = (role: "owner" | "admin" | "tech" | null) =>
    createReconRoutes({
      recon,
      guard: testGuard(role ? testWorkspace(role) : null),
      allowedOrigins: [origin],
    });
  const upload = { fileName: "b.csv", csv: "Client,SKU,Qty,Price\nA,B,1,1" };

  expect(
    (
      await routesFor(null).handle(
        billingRequest("/recon/billing", "POST", upload),
      )
    ).status,
  ).toBe(401);
  // Techs can upload the Pax8 bill, so they can upload client billing too.
  expect(
    (
      await routesFor("tech").handle(
        billingRequest("/recon/billing", "POST", upload),
      )
    ).status,
  ).toBe(201);
  const bad = await routesFor("tech").handle(
    billingRequest("/recon/billing", "POST", { fileName: "b.csv", csv: "bad" }),
  );
  expect(bad.status).toBe(422);
  expect((await bad.json()).error).toMatchObject({
    code: "INVALID_CSV",
    rows: [{ rowNumber: 3, message: "unit price is required." }],
  });
  // Mapping a billing name to a client is a mapping edit: not for techs.
  const mapping = { clientName: "Acme", clientId: crypto.randomUUID() };
  expect(
    (
      await routesFor("tech").handle(
        billingRequest("/recon/billing/mappings", "PUT", mapping),
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await routesFor("admin").handle(
        billingRequest("/recon/billing/mappings", "PUT", mapping),
      )
    ).status,
  ).toBe(200);
  expect(calls).toEqual([upload.csv, "bad"]);
});
