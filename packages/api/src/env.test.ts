import { expect, test } from "bun:test";
import { readApiEnvironment } from "./env";

const valid = {
  DATABASE_URL: "postgres://starter:starter@localhost:5432/starter",
  APP_ORIGIN: "http://localhost:3000",
  BETTER_AUTH_SECRET: "local-test-secret-at-least-thirty-two-chars",
};

test("the app origin is the only trusted origin", () => {
  const environment = readApiEnvironment(valid);
  expect(environment.appOrigin).toBe("http://localhost:3000");
  expect(environment.allowedOrigins).toEqual(["http://localhost:3000"]);
});

test("rejects missing, wildcard or path app origin", () => {
  expect(() => readApiEnvironment({ ...valid, APP_ORIGIN: undefined })).toThrow(
    "APP_ORIGIN",
  );
  expect(() => readApiEnvironment({ ...valid, APP_ORIGIN: "*" })).toThrow();
  expect(() =>
    readApiEnvironment({ ...valid, APP_ORIGIN: "https://example.com/path" }),
  ).toThrow();
});

test("rejects invalid database and secret configuration", () => {
  expect(() =>
    readApiEnvironment({ ...valid, DATABASE_URL: "sqlite:example" }),
  ).toThrow();
  expect(() =>
    readApiEnvironment({ ...valid, BETTER_AUTH_SECRET: "short" }),
  ).toThrow();
});

test("rejects insecure public production app origin", () => {
  expect(() =>
    readApiEnvironment({
      ...valid,
      APP_ORIGIN: "http://seattrue.example.com",
      NODE_ENV: "production",
    }),
  ).toThrow();
  expect(() =>
    readApiEnvironment({
      ...valid,
      APP_ORIGIN: "https://seattrue.example.com",
      NODE_ENV: "production",
      BETTER_AUTH_SECRET: "local-only-better-auth-secret-1234567890",
    }),
  ).toThrow();
});

test("validates structured logging level", () => {
  expect(readApiEnvironment(valid).logLevel).toBe("info");
  expect(readApiEnvironment({ ...valid, LOG_LEVEL: "debug" }).logLevel).toBe(
    "debug",
  );
  expect(() => readApiEnvironment({ ...valid, LOG_LEVEL: "verbose" })).toThrow(
    "LOG_LEVEL",
  );
});
test("Google sign-in is optional but needs both credentials", () => {
  expect(readApiEnvironment(valid).google).toBeUndefined();
  expect(() =>
    readApiEnvironment({ ...valid, GOOGLE_CLIENT_ID: "id-only" }),
  ).toThrow("GOOGLE_CLIENT_SECRET");
  expect(
    readApiEnvironment({
      ...valid,
      GOOGLE_CLIENT_ID: "id",
      GOOGLE_CLIENT_SECRET: "secret",
    }).google,
  ).toEqual({ clientId: "id", clientSecret: "secret" });
});
