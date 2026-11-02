import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { getApiClient } from "./api";

export type PlanId = "solo" | "team";

function billingErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object") {
    const value = "value" in error ? error.value : error;
    if (value && typeof value === "object") {
      const payload = "error" in value ? value.error : value;
      if (
        payload &&
        typeof payload === "object" &&
        "message" in payload &&
        typeof payload.message === "string"
      ) {
        return payload.message;
      }
    }
  }

  return fallback;
}

export async function getBillingOverview() {
  const client = await getApiClient();
  const { data, error } = await client.billing.overview.get();
  if (error) {
    throw new Error(
      billingErrorMessage(error, "Could not load billing details."),
    );
  }
  if (!data) throw new Error("Billing response was empty.");
  return data;
}

async function startCheckout(plan: PlanId): Promise<string> {
  const client = await getApiClient();
  const { data, error } = await client.billing.checkout.post({ plan });
  if (error) {
    throw new Error(billingErrorMessage(error, "Could not start checkout."));
  }
  if (!data?.url) throw new Error("Checkout link was unavailable.");
  return data.url;
}

async function openBillingPortal(): Promise<string> {
  const client = await getApiClient();
  const { data, error } = await client.billing.portal.post();
  if (error) {
    throw new Error(
      billingErrorMessage(error, "Could not open billing portal."),
    );
  }
  if (!data?.url) throw new Error("Billing portal link was unavailable.");
  return data.url;
}

export type BillingOverview = Awaited<ReturnType<typeof getBillingOverview>>;
export type BillingPlan = BillingOverview["plans"][number];

export const billingKeys = {
  overview: () => ["billing", "overview"] as const,
};

export const billingOverviewQueryOptions = queryOptions({
  queryKey: billingKeys.overview(),
  queryFn: getBillingOverview,
});

export function useBillingCheckout() {
  return useMutation({ mutationFn: startCheckout });
}

export function useBillingPortal() {
  return useMutation({ mutationFn: openBillingPortal });
}

export async function getPlanPreflight(plan: PlanId) {
  const client = await getApiClient();
  const { data, error } = await client.billing["plan-change"].preflight.get({
    query: { plan },
  });
  if (error)
    throw new Error(billingErrorMessage(error, "Could not check usage."));
  if (!data) throw new Error("Preflight response was empty.");
  return data;
}

async function changePlan(input: {
  plan: PlanId;
  keepClientIds?: string[];
  confirm?: string;
}) {
  const client = await getApiClient();
  const { data, error } = await client.billing["plan-change"].post(input);
  if (error)
    throw new Error(billingErrorMessage(error, "Could not change plan."));
  if (!data) throw new Error("Plan change response was empty.");
  return data;
}

export type PlanPreflight = Awaited<ReturnType<typeof getPlanPreflight>>;

export function useChangePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: changePlan,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: billingKeys.overview() }),
        queryClient.invalidateQueries({ queryKey: ["recon"] }),
      ]),
  });
}
