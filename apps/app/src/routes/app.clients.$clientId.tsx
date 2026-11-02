import { Badge } from "@seattrue/ui";
import { useQuery } from "@tanstack/react-query";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "../components/app-shell";
import { requireSession } from "../lib/auth-navigation";
import {
  exceptionKindLabels,
  exceptionStatusLabels,
  formatCents,
} from "../lib/format";
import { clientQueryOptions } from "../lib/recon-query";

export const Route = createFileRoute("/app/clients/$clientId")({
  headers: () => ({ "Cache-Control": "private, no-store" }),
  beforeLoad: ({ location }) => requireSession(location.href),
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(clientQueryOptions(params.clientId)),
  errorComponent: ClientError,
  component: ClientPage,
});

function ClientError({ error }: ErrorComponentProps) {
  return (
    <AppShell>
      <main className="app-content">
        <div className="load-error-panel" role="alert">
          <h2>Client could not be loaded</h2>
          <p>
            {error instanceof Error ? error.message : "Something went wrong."}
          </p>
          <Link to="/app">Back to overview</Link>
        </div>
      </main>
    </AppShell>
  );
}

function ClientPage() {
  const { user } = Route.useRouteContext();
  const { clientId } = Route.useParams();
  const { data } = useQuery(clientQueryOptions(clientId));
  if (!data) return null;
  const { client, agreements, exceptions, customerKeys } = data;

  return (
    <AppShell userName={user.name}>
      <main className="app-content">
        <section className="page-heading" aria-labelledby="client-title">
          <div className="page-heading-copy">
            <div className="eyebrow">
              <Link to="/app">Overview</Link> / Client
            </div>
            <h1 id="client-title">{client.name}</h1>
            <p>
              {client.psaId ?? "No PSA ID"} · markup {client.markupPct}% · Pax8{" "}
              {customerKeys.join(", ") || "not mapped"}
            </p>
          </div>
          <Badge
            variant={client.status === "active" ? "secondary" : "destructive"}
          >
            {client.status}
          </Badge>
        </section>

        <section className="recon-headline" aria-label="Client totals">
          <div className="recon-stat recon-stat-primary">
            <span className="recon-stat-label">Leakage this month</span>
            <strong className="recon-stat-value">
              {formatCents(client.leakageCents)}
            </strong>
          </div>
          <div className="recon-stat">
            <span className="recon-stat-label">Seats on bill</span>
            <strong className="recon-stat-value">{client.vendorSeats}</strong>
          </div>
          <div className="recon-stat">
            <span className="recon-stat-label">Open exceptions</span>
            <strong className="recon-stat-value">{client.openCount}</strong>
          </div>
        </section>

        <section className="recon-grid">
          <div className="recon-panel">
            <h2>Agreement (PSA)</h2>
            {agreements.length === 0 ? (
              <p>No agreement lines.</p>
            ) : (
              <table className="recon-table">
                <thead>
                  <tr>
                    <th scope="col">Product</th>
                    <th scope="col" className="num">
                      Qty
                    </th>
                    <th scope="col" className="num">
                      Unit price
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {agreements.map((line) => (
                    <tr key={line.sku}>
                      <td>{line.productName}</td>
                      <td className="num">{line.quantity}</td>
                      <td className="num">
                        {formatCents(line.unitPriceCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="recon-panel">
            <h2>Exceptions</h2>
            {exceptions.length === 0 ? (
              <p>Clean: the bill matches the agreement at cost + markup.</p>
            ) : (
              <ul className="recon-kinds">
                {exceptions.map((exception) => (
                  <li key={exception.id}>
                    <span>
                      <Badge variant="subtle">
                        {exceptionKindLabels[exception.kind]}
                      </Badge>{" "}
                      {exception.summary}{" "}
                      <Badge variant="outline">
                        {exceptionStatusLabels[exception.status]}
                      </Badge>
                    </span>
                    <strong>{formatCents(exception.monthlyImpactCents)}</strong>
                  </li>
                ))}
              </ul>
            )}
            <div className="recon-actions">
              <Link to="/app/exceptions">Work these in the inbox →</Link>
            </div>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
