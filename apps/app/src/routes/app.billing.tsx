import { Badge, Button } from "@seattrue/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, LoaderCircle } from "lucide-react";
import { AppShell } from "../components/app-shell";
import { PlanChange } from "../components/plan-change";
import { requireSession } from "../lib/auth-navigation";
import {
  billingOverviewQueryOptions,
  type PlanId,
  useBillingCheckout,
  useBillingPortal,
} from "../lib/billing";
import { formatCents } from "../lib/format";
import { useCan } from "../lib/workspace";

type BillingSearch = { checkout?: "success" | "cancelled" };

export const Route = createFileRoute("/app/billing")({
  headers: () => ({ "Cache-Control": "private, no-store" }),
  validateSearch: (search: Record<string, unknown>): BillingSearch =>
    search.checkout === "success" || search.checkout === "cancelled"
      ? { checkout: search.checkout }
      : {},
  beforeLoad: ({ location }) => requireSession(location.href),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(billingOverviewQueryOptions),
  component: BillingPage,
});

const statusLabels: Record<string, string> = {
  active: "Active",
  trialing: "Trial",
  past_due: "Payment failed",
  unpaid: "Unpaid",
  canceled: "Canceled",
  incomplete: "Awaiting payment",
  incomplete_expired: "Checkout expired",
  paused: "Paused",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(
    new Date(value),
  );
}

function BillingPage() {
  const { user } = Route.useRouteContext();
  const { checkout: checkoutResult } = Route.useSearch();
  const overview = useQuery(billingOverviewQueryOptions);
  const checkout = useBillingCheckout();
  const portal = useBillingPortal();
  const canManage = useCan()("billing", "manage");
  const data = overview.data;
  const subscription = data?.subscription ?? null;
  const subscribed =
    subscription !== null &&
    !["canceled", "incomplete_expired"].includes(subscription.status);
  const actionError = checkout.error ?? portal.error;

  async function choose(plan: PlanId) {
    try {
      window.location.assign(await checkout.mutateAsync(plan));
    } catch {
      // Shown via checkout.error; 409 means "use the portal".
    }
  }

  async function manage() {
    try {
      window.location.assign(await portal.mutateAsync());
    } catch {
      // Shown via portal.error.
    }
  }

  return (
    <AppShell userName={user.name}>
      <main className="app-content">
        <section className="page-heading" aria-labelledby="billing-title">
          <div className="page-heading-copy">
            <div className="eyebrow">Account / Billing</div>
            <h1 id="billing-title">Billing</h1>
            <p>
              Stripe charges your card automatically and emails every receipt
              and invoice. Cancel any time; access continues to the end of the
              paid period. No refunds.
            </p>
          </div>
          {subscription && canManage && (
            <Button type="button" onClick={manage} disabled={portal.isPending}>
              {portal.isPending ? (
                <LoaderCircle size={16} className="spin" aria-hidden="true" />
              ) : (
                <ExternalLink size={16} aria-hidden="true" />
              )}
              Manage billing
            </Button>
          )}
        </section>

        {!canManage && (
          <div className="notice-banner" role="status">
            <span>Only the workspace owner changes the plan or billing.</span>
          </div>
        )}

        {checkoutResult === "success" && (
          <div className="notice-banner" role="status">
            <span>
              Payment received. Your plan activates as soon as Stripe confirms
              it, usually within seconds.
            </span>
          </div>
        )}
        {actionError && (
          <div className="error-banner" role="alert">
            <div>
              <strong>Billing action failed</strong>
              <p>{actionError.message}</p>
            </div>
          </div>
        )}

        {data && !data.enabled && (
          <div className="empty-state">
            <h3>Billing isn't configured yet</h3>
            <p>
              Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET with `bun run
              secrets:set`, then run scripts/stripe-seed.ts.
            </p>
          </div>
        )}

        {subscription && (
          <section className="recon-panel" aria-labelledby="current-plan">
            <h2 id="current-plan">Current plan</h2>
            <ul className="recon-kinds">
              <li>
                <span>Plan</span>
                <strong>
                  {data?.plans.find((plan) => plan.id === subscription.planId)
                    ?.name ?? "—"}
                </strong>
              </li>
              <li>
                <span>Status</span>
                <Badge
                  variant={
                    subscription.status === "active"
                      ? "secondary"
                      : "destructive"
                  }
                >
                  {statusLabels[subscription.status] ?? subscription.status}
                </Badge>
              </li>
              <li>
                <span>
                  {subscription.cancelAtPeriodEnd ? "Access ends" : "Renews"}
                </span>
                <strong>{formatDate(subscription.currentPeriodEnd)}</strong>
              </li>
            </ul>
            {subscription.actionUrl && (
              <div className="recon-actions">
                <Button asChild>
                  <a href={subscription.actionUrl}>
                    Confirm payment with your bank
                  </a>
                </Button>
              </div>
            )}
          </section>
        )}

        {subscription && subscribed && canManage && (
          <PlanChange
            currentPlanId={subscription.planId}
            scheduledPlanId={subscription.scheduledPlanId}
            periodEnd={subscription.currentPeriodEnd}
          />
        )}

        {data?.enabled && !subscribed && (
          <section aria-labelledby="plans-title" style={{ marginTop: 16 }}>
            <h2 id="plans-title" className="sr-only">
              Plans
            </h2>
            <div className="recon-grid">
              {data.plans.map((plan) => (
                <div className="recon-panel" key={plan.id}>
                  <h2>{plan.name}</h2>
                  <p>{plan.description}</p>
                  <p>
                    <strong style={{ fontSize: "2rem" }}>
                      {plan.amount === null ? "—" : formatCents(plan.amount)}
                    </strong>
                    /{plan.interval ?? "month"}, flat
                  </p>
                  <div className="recon-actions">
                    <Button
                      type="button"
                      onClick={() => choose(plan.id)}
                      disabled={checkout.isPending || !canManage}
                    >
                      Choose {plan.name}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </AppShell>
  );
}
