/**
 * Plans are identified by Stripe lookup keys, not price IDs, so the same code
 * works against a sandbox and the live account. `scripts/stripe-seed.ts`
 * creates these prices; Stripe owns the amounts.
 *
 * Both plans are flat with unlimited users: the only limit is active clients.
 */
export const plans = [
  {
    id: "starter",
    name: "Starter",
    lookupKey: "seattrue_starter_monthly",
    productId: "seattrue_starter",
    description: "Up to 50 active clients, unlimited users",
    unitAmount: 4900,
    rank: 1,
    /** null = unlimited. */
    limits: { clients: 50 },
  },
  {
    id: "pro",
    name: "Pro",
    lookupKey: "seattrue_pro_monthly",
    productId: "seattrue_pro",
    description: "Unlimited clients and users",
    unitAmount: 14900,
    rank: 2,
    limits: { clients: null },
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

/**
 * Free: every workspace without a paid plan. No card, no Stripe customer,
 * no time limit; only active clients are capped.
 */
export const freePlan = {
  id: "free",
  name: "Free",
  description: "Up to 10 active clients, unlimited users, no card",
  limits: { clients: 10 },
} as const;

export const unsubscribedLimits = freePlan.limits;

export type PlanLimits = { clients: number | null };

export function limitsFor(lookupKey: string | null | undefined): PlanLimits {
  return planByLookupKey(lookupKey)?.limits ?? unsubscribedLimits;
}
