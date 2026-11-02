import { expect, test } from "bun:test";
import { readBillingEnvironment } from "./env";

test("billing is optional only when every Stripe value is absent", () => {
  expect(
    readBillingEnvironment({ APP_ORIGIN: "http://localhost:3000" }),
  ).toBeNull();
  expect(() =>
    readBillingEnvironment({ STRIPE_SECRET_KEY: "sk_test_partial" }),
  ).toThrow("Incomplete Stripe configuration");
});

test("billing rejects unsafe redirect origins", () => {
  const values = {
    STRIPE_SECRET_KEY: "sk_test_fake",
    STRIPE_WEBHOOK_SECRET: "whsec_fake",
  };
  expect(() =>
    readBillingEnvironment({
      ...values,
      APP_ORIGIN: "https://example.com/path",
    }),
  ).toThrow("exact HTTP(S) origin");
  expect(
    readBillingEnvironment({ ...values, APP_ORIGIN: "http://localhost:3000" }),
  ).toEqual({
    secretKey: values.STRIPE_SECRET_KEY,
    webhookSecret: values.STRIPE_WEBHOOK_SECRET,
    portalConfigurationId: null,
    appOrigin: "http://localhost:3000",
  });
  expect(
    readBillingEnvironment({
      ...values,
      APP_ORIGIN: "http://localhost:3000",
      STRIPE_PORTAL_CONFIG_ID: "bpc_test",
    })?.portalConfigurationId,
  ).toBe("bpc_test");
});
