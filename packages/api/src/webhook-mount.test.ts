import { expect, test } from "bun:test";
import { type BillingService, createBillingService } from "@seattrue/billing";
import { createDatabase, type Database } from "@seattrue/db";
import Stripe from "stripe";
import { createApp } from "./app";
import type { ProjectRepository } from "./projects";
import type { ReconService } from "./reconciliation";
import { testAuthService } from "./testing";

// The app's /api/$ route hands the untouched Request to app.fetch. This drives
// that same call with a real Stripe signature over the raw bytes.
test("POST /api/billing/webhook verifies a Stripe signature on the raw body via app.fetch", async () => {
  const secret = "whsec_test_mount";
  const stripe = new Stripe("sk_test_fake");
  const real = createBillingService(
    {} as Database,
    {
      secretKey: "sk_test_fake",
      webhookSecret: secret,
      portalConfigurationId: null,
      appOrigin: "http://localhost:3000",
    },
    stripe,
  );
  const processed: string[] = [];
  const billing = {
    ...real,
    processWebhook: async (event: Stripe.Event) => {
      processed.push(event.id);
    },
  } as BillingService;
  const app = createApp({
    projects: {} as ProjectRepository,
    db: createDatabase("postgres://unused:unused@127.0.0.1:1/unused").db,
    recon: {} as ReconService,
    auth: testAuthService(null),
    billing,
    allowedOrigins: ["http://localhost:3000"],
    logger: { info() {}, warn() {}, error() {} },
  });
  // Odd spacing and key order: any re-serialization would break the signature.
  const payload =
    '{"id":"evt_mount" ,"object":"event","type":"invoice.paid","data":{"object":{"id":"in_1"}}}';
  const signature = await stripe.webhooks.generateTestHeaderStringAsync({
    payload,
    secret,
  });
  const post = (body: string, headers: Record<string, string>) =>
    app.fetch(
      new Request("http://localhost:3000/api/billing/webhook", {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body,
      }),
    );

  const accepted = await post(payload, { "stripe-signature": signature });
  expect(accepted.status).toBe(200);
  expect(processed).toEqual(["evt_mount"]);

  const tampered = await post(`${payload} `, { "stripe-signature": signature });
  expect(tampered.status).toBe(400);
  const unsigned = await post(payload, {});
  expect(unsigned.status).toBe(400);
  expect(processed).toEqual(["evt_mount"]);
});
