import { expect, test } from "bun:test";
import {
  type BillingService,
  ExistingSubscriptionError,
} from "@seattrue/billing";
import { createBillingRoutes } from "./billing";
import { testGuard, testWorkspace } from "./testing";

test("unconfigured billing remains readable and disables payment actions", async () => {
  const routes = createBillingRoutes({
    billing: null,
    guard: testGuard(testWorkspace("owner", "user-1")),
    allowedOrigins: ["http://localhost:3000"],
  });

  const overview = await routes.handle(
    new Request("http://localhost/billing/overview"),
  );
  expect(overview.status).toBe(200);
  expect(await overview.json()).toEqual({
    enabled: false,
    plans: [],
    subscription: null,
    access: "none",
  });

  const checkout = await routes.handle(
    new Request("http://localhost/billing/checkout", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
      },
      body: JSON.stringify({ plan: "solo" }),
    }),
  );
  expect(checkout.status).toBe(503);
  expect((await checkout.json()).error.code).toBe("BILLING_NOT_CONFIGURED");

  const missingOrigin = await routes.handle(
    new Request("http://localhost/billing/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ plan: "solo" }),
    }),
  );
  expect(missingOrigin.status).toBe(403);
  expect((await missingOrigin.json()).error.code).toBe("INVALID_ORIGIN");

  const foreignPortal = await routes.handle(
    new Request("http://localhost/billing/portal", {
      method: "POST",
      headers: { origin: "https://foreign.example" },
    }),
  );
  expect(foreignPortal.status).toBe(403);
});

test("billing validates the plan and maps subscription conflict", async () => {
  const service = {
    checkout: async () => {
      throw new ExistingSubscriptionError();
    },
  } as unknown as BillingService;
  const routes = createBillingRoutes({
    billing: service,
    guard: testGuard(testWorkspace("owner", "user-1")),
    allowedOrigins: ["http://localhost:3000"],
  });

  const request = (plan: string) =>
    new Request("http://localhost/billing/checkout", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
      },
      body: JSON.stringify({ plan }),
    });
  expect((await routes.handle(request("price_attacker_selected"))).status).toBe(
    422,
  );
  const duplicate = await routes.handle(request("team"));
  expect(duplicate.status).toBe(409);
  expect((await duplicate.json()).error.code).toBe(
    "SUBSCRIPTION_ALREADY_EXISTS",
  );
});

test("Stripe webhook verifier receives exact raw JSON before processing", async () => {
  const rawBody = '{ "id" : "evt_test", "data": { "object": {} } }';
  let receivedBody = "";
  let processed = false;
  const service = {
    verifyWebhook: (body: string, signature: string) => {
      receivedBody = body;
      if (signature !== "valid") throw new Error("Invalid signature");
      return { id: "evt_test" };
    },
    processWebhook: async () => {
      processed = true;
    },
  } as unknown as BillingService;
  const routes = createBillingRoutes({
    billing: service,
    guard: testGuard(null),
    allowedOrigins: ["http://localhost:3000"],
  });
  const webhook = (signature: string) =>
    new Request("http://localhost/billing/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "stripe-signature": signature,
      },
      body: rawBody,
    });

  const rejected = await routes.handle(webhook("invalid"));
  expect(rejected.status).toBe(400);
  expect(processed).toBe(false);

  const accepted = await routes.handle(webhook("valid"));
  expect(accepted.status).toBe(200);
  expect(receivedBody).toBe(rawBody);
  expect(processed).toBe(true);
});

test("webhook processing failures return 5xx so Stripe retries", async () => {
  const service = {
    verifyWebhook: () => ({ id: "evt_retry" }),
    processWebhook: async () => {
      throw new Error("database unavailable");
    },
  } as unknown as BillingService;
  const routes = createBillingRoutes({
    billing: service,
    guard: testGuard(null),
    allowedOrigins: ["http://localhost:3000"],
  });
  const response = await routes.handle(
    new Request("http://localhost/billing/webhook", {
      method: "POST",
      headers: { "stripe-signature": "valid" },
      body: "{}",
    }),
  );
  expect(response.status).toBe(500);
  expect((await response.json()).error.code).toBe("WEBHOOK_PROCESSING_FAILED");
});
