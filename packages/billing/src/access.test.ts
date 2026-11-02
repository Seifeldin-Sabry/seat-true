import { expect, test } from "bun:test";
import { accessFor, canWrite } from "./access";

const now = new Date("2026-11-10T12:00:00Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000);

test("subscription status maps to access with a 7-day past_due grace", () => {
  expect(accessFor(null, now)).toBe("none");
  expect(accessFor({ status: "active", pastDueSince: null }, now)).toBe("full");
  expect(accessFor({ status: "trialing", pastDueSince: null }, now)).toBe(
    "full",
  );
  expect(accessFor({ status: "past_due", pastDueSince: daysAgo(6) }, now)).toBe(
    "grace",
  );
  expect(accessFor({ status: "past_due", pastDueSince: daysAgo(8) }, now)).toBe(
    "read_only",
  );
  for (const status of ["unpaid", "canceled", "incomplete_expired", "paused"]) {
    expect(accessFor({ status, pastDueSince: null }, now)).toBe("read_only");
  }
});

test("only read-only access blocks writes", () => {
  expect(canWrite("none")).toBe(true);
  expect(canWrite("grace")).toBe(true);
  expect(canWrite("read_only")).toBe(false);
});
