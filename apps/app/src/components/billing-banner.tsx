import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { billingOverviewQueryOptions } from "../lib/billing";

/** Past-due grace and read-only notices; Stripe's dunning emails do the rest. */
export function BillingBanner() {
  const { data } = useQuery({ ...billingOverviewQueryOptions, retry: false });
  if (!data?.enabled) return null;
  if (data.access === "grace") {
    return (
      <div className="error-banner" role="alert">
        <div>
          <strong>Your last payment failed.</strong>
          <p>
            Stripe will retry automatically. Update your card within 7 days to
            keep editing; your data is safe either way.
          </p>
        </div>
        <Link to="/app/billing">Fix billing</Link>
      </div>
    );
  }
  if (data.access === "read_only") {
    return (
      <div className="error-banner" role="alert">
        <div>
          <strong>Your workspace is read-only.</strong>
          <p>
            The subscription is inactive. Nothing has been deleted; resubscribe
            or update billing to make changes again.
          </p>
        </div>
        <Link to="/app/billing">Open billing</Link>
      </div>
    );
  }
  return null;
}
