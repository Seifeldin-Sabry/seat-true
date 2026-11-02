/**
 * What a workspace may do, derived from its Stripe subscription.
 *
 * - none: never subscribed (free audit / demo stage), full use
 * - full: active or trialing
 * - grace: past_due for less than 7 days, full use plus a banner
 * - read_only: unpaid, canceled, expired, paused or past_due beyond grace.
 *   Data is never deleted; writes are refused until billing is fixed.
 */
export type Access = "none" | "full" | "grace" | "read_only";

export const PAST_DUE_GRACE_DAYS = 7;
const graceMs = PAST_DUE_GRACE_DAYS * 24 * 60 * 60 * 1000;

export function accessFor(
  subscription: { status: string; pastDueSince: Date | null } | null,
  now: Date = new Date(),
): Access {
  if (!subscription) return "none";
  switch (subscription.status) {
    case "active":
    case "trialing":
      return "full";
    case "past_due": {
      const since = subscription.pastDueSince ?? now;
      return now.getTime() - since.getTime() < graceMs ? "grace" : "read_only";
    }
    // `incomplete` = first payment still settling (e.g. 3-D Secure pending).
    case "incomplete":
      return "none";
    default:
      return "read_only";
  }
}

export function canWrite(access: Access): boolean {
  return access !== "read_only";
}
