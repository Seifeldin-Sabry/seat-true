import { Button } from "@seattrue/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "../components/app-shell";
import { requireSession } from "../lib/auth-navigation";
import { formatCents } from "../lib/format";
import { mappingsQueryOptions, useSaveMapping } from "../lib/recon-query";
import { useCan } from "../lib/workspace";

export const Route = createFileRoute("/app/mappings")({
  headers: () => ({ "Cache-Control": "private, no-store" }),
  beforeLoad: ({ location }) => requireSession(location.href),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(mappingsQueryOptions),
  component: MappingsPage,
});

function MappingsPage() {
  const { user } = Route.useRouteContext();
  const mappings = useQuery(mappingsQueryOptions);
  const save = useSaveMapping();
  const canEdit = useCan()("mapping", "edit");
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const data = mappings.data;

  async function map(customerKey: string, customerName: string) {
    const clientId = choices[customerKey];
    if (!clientId) return;
    setNotice(null);
    try {
      await save.mutateAsync({ customerKey, clientId });
      const client = data?.clients.find((entry) => entry.id === clientId);
      setNotice(
        `${customerName} now maps to ${client?.name ?? "the client"}. Reconciliation re-ran.`,
      );
    } catch {
      // Shown via save.error.
    }
  }

  return (
    <AppShell userName={user.name}>
      <main className="app-content">
        <section className="page-heading" aria-labelledby="mappings-title">
          <div className="page-heading-copy">
            <div className="eyebrow">Reconciliation / Mappings</div>
            <h1 id="mappings-title">Pax8 customer → PSA client</h1>
            <p>
              Map each distributor customer once. Saving re-runs this month's
              reconciliation and keeps statuses you already set.
            </p>
          </div>
        </section>

        {notice && (
          <div className="notice-banner" role="status">
            <span>{notice}</span>
          </div>
        )}
        {save.error && (
          <div className="error-banner" role="alert">
            <div>
              <strong>Mapping not saved</strong>
              <p>{save.error.message}</p>
            </div>
          </div>
        )}

        <section className="recon-panel" aria-labelledby="unmapped-title">
          <h2 id="unmapped-title">Unmapped customers on this month's bill</h2>
          {!data || data.unmapped.length === 0 ? (
            <p>Every customer on the bill is mapped.</p>
          ) : (
            <div className="recon-table-wrap">
              <table className="recon-table">
                <thead>
                  <tr>
                    <th scope="col">Pax8 customer</th>
                    <th scope="col" className="num">
                      Seats
                    </th>
                    <th scope="col" className="num">
                      Cost / mo
                    </th>
                    <th scope="col">PSA client</th>
                    <th scope="col">
                      <span className="sr-only">Save</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.unmapped.map((customer) => {
                    const selectId = `map-${customer.customerKey}`;
                    return (
                      <tr key={customer.customerKey}>
                        <td>
                          <div>{customer.customerName}</div>
                          <div className="recon-summary">
                            {customer.customerKey}
                          </div>
                        </td>
                        <td className="num">{customer.seats}</td>
                        <td className="num">
                          {formatCents(customer.monthlyCostCents)}
                        </td>
                        <td>
                          <label className="sr-only" htmlFor={selectId}>
                            Client for {customer.customerName}
                          </label>
                          <select
                            id={selectId}
                            className="recon-select"
                            disabled={!canEdit}
                            title={
                              canEdit
                                ? undefined
                                : "Only admins and the owner change mappings"
                            }
                            value={choices[customer.customerKey] ?? ""}
                            onChange={(event) =>
                              setChoices((current) => ({
                                ...current,
                                [customer.customerKey]: event.target.value,
                              }))
                            }
                          >
                            <option value="">Choose a client…</option>
                            {data.clients.map((client) => (
                              <option key={client.id} value={client.id}>
                                {client.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <Button
                            size="sm"
                            type="button"
                            disabled={
                              !canEdit ||
                              !choices[customer.customerKey] ||
                              save.isPending
                            }
                            onClick={() =>
                              map(customer.customerKey, customer.customerName)
                            }
                          >
                            Map
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section
          className="recon-panel"
          aria-labelledby="mapped-title"
          style={{ marginTop: 16 }}
        >
          <h2 id="mapped-title">Mapped</h2>
          {!data || data.mappings.length === 0 ? (
            <p>
              No mappings yet. <Link to="/app">Load the demo</Link> or upload a
              bill.
            </p>
          ) : (
            <div className="recon-table-wrap">
              <table className="recon-table">
                <thead>
                  <tr>
                    <th scope="col">Pax8 customer ID</th>
                    <th scope="col">PSA client</th>
                  </tr>
                </thead>
                <tbody>
                  {data.mappings.map((mapping) => (
                    <tr key={mapping.customerKey}>
                      <td>{mapping.customerKey}</td>
                      <td>
                        <Link
                          to="/app/clients/$clientId"
                          params={{ clientId: mapping.clientId }}
                        >
                          {mapping.clientName}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </AppShell>
  );
}
