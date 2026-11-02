import { queryOptions, useMutation } from "@tanstack/react-query";
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
