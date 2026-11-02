/**
 * Plans are identified by Stripe lookup keys, not price IDs, so the same code
 * works against a sandbox and the live account. `scripts/stripe-seed.ts`
 * creates these prices; Stripe owns the amounts.
 */
export const plans = [
  {
    id: "solo",
    name: "Solo",
    lookupKey: "seattrue_solo_monthly",
    productId: "seattrue_solo",
    description: "Up to 150 clients",
    unitAmount: 14900,
    rank: 1,
    /** null = unlimited. `users` is reserved until workspaces have invites. */
    limits: { clients: 150, users: 1 },
  },
  {
    id: "team",
    name: "Team",
    lookupKey: "seattrue_team_monthly",
    productId: "seattrue_team",
    description: "Unlimited clients",
    unitAmount: 24900,
    rank: 2,
    limits: { clients: null, users: null },
  },
] as const;

export type Plan = (typeof plans)[number];
export type PlanId = Plan["id"];

export const planLookupKeys: readonly string[] = plans.map(
  (plan) => plan.lookupKey,
);

export function planById(id: PlanId): Plan {
  const plan = plans.find((candidate) => candidate.id === id);
  if (!plan) throw new Error(`Unknown plan ${id}`);
  return plan;
}

export function planByLookupKey(lookupKey: string | null | undefined) {
  return plans.find((plan) => plan.lookupKey === lookupKey) ?? null;
}

/** Limits when the workspace has never subscribed (free audit stage). */
export const unsubscribedLimits = { clients: null, users: null } as const;

export type PlanLimits = { clients: number | null; users: number | null };

export function limitsFor(lookupKey: string | null | undefined): PlanLimits {
  return planByLookupKey(lookupKey)?.limits ?? unsubscribedLimits;
}
