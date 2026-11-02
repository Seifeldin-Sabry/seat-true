import { Badge, Button } from "@seattrue/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { FileUp, LoaderCircle, Sparkles } from "lucide-react";
import type { ChangeEvent } from "react";
import { useRef, useState } from "react";
import { AppShell } from "../components/app-shell";
import { requireSession } from "../lib/auth-navigation";
import { exceptionKindLabels, formatCents } from "../lib/format";
import {
  overviewQueryOptions,
  useLoadDemo,
  useUploadRun,
} from "../lib/recon-query";

export const Route = createFileRoute("/app/")({
  headers: () => ({ "Cache-Control": "private, no-store" }),
  beforeLoad: ({ location }) => requireSession(location.href),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(overviewQueryOptions),
  component: OverviewPage,
});

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function OverviewPage() {
  const { user } = Route.useRouteContext();
  const overview = useQuery(overviewQueryOptions);
  const upload = useUploadRun();
  const demo = useLoadDemo();
  const fileInput = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const data = overview.data;
  const busy = upload.isPending || demo.isPending;
  const actionError = upload.error ?? demo.error;

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setNotice(null);
    try {
      const run = await upload.mutateAsync({
        fileName: file.name,
        csv: await file.text(),
      });
      setNotice(
        `Reconciled ${run.lineCount} lines across ${run.customerCount} customers.`,
      );
    } catch {
      // Shown via upload.error.
    }
  }

  async function onDemo() {
    setNotice(null);
    try {
      await demo.mutateAsync();
      setNotice("Loaded the Northbeam IT demo: 8 clients, November bill.");
    } catch {
      // Shown via demo.error.
    }
  }

  return (
    <AppShell userName={user.name}>
      <main className="app-content">
        <section className="page-heading" aria-labelledby="overview-title">
          <div className="page-heading-copy">
            <div className="eyebrow">Reconciliation / Overview</div>
            <h1 id="overview-title">This month's license leak</h1>
            <p>
              {data?.run
                ? `From ${data.run.fileName} · ${data.run.lineCount} lines · ${data.run.customerCount} customers`
                : "Upload a Pax8 billing export to reconcile it against your client agreements."}
            </p>
          </div>
          <div className="recon-actions">
            <input
              ref={fileInput}
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={onFile}
            />
            <Button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={busy}
            >
              {upload.isPending ? (
                <LoaderCircle size={16} className="spin" aria-hidden="true" />
              ) : (
                <FileUp size={16} aria-hidden="true" />
              )}
              Upload Pax8 CSV
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onDemo}
              disabled={busy}
            >
              {demo.isPending ? (
                <LoaderCircle size={16} className="spin" aria-hidden="true" />
              ) : (
                <Sparkles size={16} aria-hidden="true" />
              )}
              Load demo data
            </Button>
          </div>
        </section>

        {notice && (
          <div className="notice-banner" role="status">
            <span>{notice}</span>
          </div>
        )}
        {actionError && (
          <div className="error-banner" role="alert">
            <div>
              <strong>That didn't work</strong>
              <p>{errorMessage(actionError)}</p>
            </div>
          </div>
        )}
        {overview.error && (
          <div className="error-banner" role="alert">
            <div>
              <strong>Overview could not be loaded</strong>
              <p>{errorMessage(overview.error)}</p>
            </div>
          </div>
        )}

        {data && !data.run && (
          <div className="empty-state">
            <h3>No bill reconciled yet</h3>
            <p>
              Upload last month's Pax8 export, or load the demo MSP to see what
              SeatTrue finds.
            </p>
          </div>
        )}

        {data?.run && (
          <>
            <section className="recon-headline" aria-label="Totals">
              <div className="recon-stat recon-stat-primary">
                <span className="recon-stat-label">
                  Leakage found this month
                </span>
                <strong className="recon-stat-value">
                  {formatCents(data.leakageCents)}
                </strong>
                <p className="recon-stat-note">
                  {formatCents(data.leakageCents * 12)} a year if nothing
                  changes · {data.openCount} open exceptions
                </p>
              </div>
              <div className="recon-stat">
                <span className="recon-stat-label">Recovered</span>
                <strong className="recon-stat-value">
                  {formatCents(data.recoveredCents)}
                </strong>
                <p className="recon-stat-note">Marked billed this month</p>
              </div>
              <div className="recon-stat">
                <span className="recon-stat-label">Overbilling risk</span>
                <strong className="recon-stat-value">
                  {formatCents(data.overbilledCents)}
                </strong>
                <p className="recon-stat-note">
                  Billed with no licence behind it
                </p>
              </div>
            </section>

            <section className="recon-grid">
              <div className="recon-panel">
                <h2>By problem</h2>
                <ul className="recon-kinds">
                  {Object.entries(data.byKind).map(([kind, bucket]) => (
                    <li key={kind}>
                      <span>
                        {
                          exceptionKindLabels[
                            kind as keyof typeof exceptionKindLabels
                          ]
                        }{" "}
                        <Badge variant="secondary">{bucket.count}</Badge>
                      </span>
                      <strong>{formatCents(bucket.cents)}</strong>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="recon-panel">
                <h2>Next steps</h2>
                <p>
                  Work the exceptions before this month's invoices go out.
                  Unmapped Pax8 customers need a client before they can be
                  checked.
                </p>
                <div className="recon-actions">
                  <Button asChild>
                    <Link to="/app/exceptions">Open exceptions inbox</Link>
                  </Button>
                  {data.byKind.unmapped_customer.count > 0 && (
                    <Button asChild variant="outline">
                      <Link to="/app/mappings">
                        Map {data.byKind.unmapped_customer.count} customer
                        {data.byKind.unmapped_customer.count === 1 ? "" : "s"}
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            </section>

            <section aria-labelledby="clients-title">
              <div className="section-heading">
                <div>
                  <span className="section-kicker">Clients</span>
                  <h2 id="clients-title">Leakage by client</h2>
                </div>
              </div>
              <div className="recon-table-wrap">
                <table className="recon-table">
                  <thead>
                    <tr>
                      <th scope="col">Client</th>
                      <th scope="col">Status</th>
                      <th scope="col" className="num">
                        Markup
                      </th>
                      <th scope="col" className="num">
                        Seats on bill
                      </th>
                      <th scope="col" className="num">
                        Open
                      </th>
                      <th scope="col" className="num">
                        Leakage / mo
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...data.clients]
                      .sort((a, b) => b.leakageCents - a.leakageCents)
                      .map((client) => (
                        <tr key={client.id}>
                          <td>
                            <Link
                              to="/app/clients/$clientId"
                              params={{ clientId: client.id }}
                            >
                              {client.name}
                            </Link>
                          </td>
                          <td>
                            <Badge
                              variant={
                                client.status === "active"
                                  ? "secondary"
                                  : "destructive"
                              }
                            >
                              {client.status}
                            </Badge>{" "}
                            {client.lockedAt && (
                              <Badge variant="outline">locked</Badge>
                            )}
                            {client.archivedAt && (
                              <Badge variant="outline">archived</Badge>
                            )}
                          </td>
                          <td className="num">{client.markupPct}%</td>
                          <td className="num">{client.vendorSeats}</td>
                          <td className="num">{client.openCount}</td>
                          <td className="num">
                            {formatCents(client.leakageCents)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>
    </AppShell>
  );
}
