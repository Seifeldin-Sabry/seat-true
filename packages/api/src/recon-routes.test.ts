import { expect, test } from "bun:test";
import { PlanLimitError } from "./plan-limits";
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

test("add client: owner only, plan-limited, actor passed for the audit log", async () => {
  const created: unknown[] = [];
  let full = false;
  const recon = {
    createClient: async (_org: string, input: unknown, actor: unknown) => {
      created.push({ input, actor });
      return { id: "c1", name: "Acme" };
    },
  } as unknown as ReconService;
  const routesFor = (role: "owner" | "admin" | "tech") =>
    createReconRoutes({
      recon,
      guard: testGuard(testWorkspace(role)),
      allowedOrigins: [origin],
      assertCanAddClient: async () => {
        if (full) throw new PlanLimitError("Solo covers 150 clients.");
      },
    });
  const body = { name: "Acme", psaId: "CW-1", markupPct: 18 };
  for (const role of ["admin", "tech"] as const)
    expect(
      (
        await routesFor(role).handle(
          billingRequest("/recon/clients", "POST", body),
        )
      ).status,
    ).toBe(403);
  expect(
    (
      await routesFor("owner").handle(
        billingRequest("/recon/clients", "POST", body),
      )
    ).status,
  ).toBe(201);
  expect(created).toEqual([
    {
      input: body,
      actor: { userId: "user-test", email: "user-test@northbeam-it.com" },
    },
  ]);
  full = true;
  const limited = await routesFor("owner").handle(
    billingRequest("/recon/clients", "POST", body),
  );
  expect(limited.status).toBe(402);
  expect((await limited.json()).error.code).toBe("PLAN_LIMIT");
  expect(created).toHaveLength(1);
});
