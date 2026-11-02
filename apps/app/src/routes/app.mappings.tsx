import { Button } from "@seattrue/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "../components/app-shell";
import { requireWorkspaceMember } from "../lib/auth-navigation";
import { formatCents } from "../lib/format";
import {
  mappingsQueryOptions,
  useCreateClient,
  useMapBillingClient,
  useSaveMapping,
} from "../lib/recon-query";
import { privateHead } from "../lib/seo";
import { useCan } from "../lib/workspace";

export const Route = createFileRoute("/app/mappings")({
  headers: () => ({ "Cache-Control": "private, no-store" }),
  head: () => privateHead("Mappings"),
  beforeLoad: ({ location, context }) =>
    requireWorkspaceMember(location.href, context.queryClient),
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

        {data && data.unmappedBilling.length > 0 && (
          <UnmatchedBilling
            names={data.unmappedBilling}
            clients={data.clients}
            canEdit={canEdit}
            onNotice={setNotice}
          />
        )}

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

const newClient = "__new__";

/** Client names on the billing CSV that match no client yet. */
function UnmatchedBilling({
  names,
  clients,
  canEdit,
  onNotice,
}: {
  names: {
    clientName: string;
    lineCount: number;
    seats: number;
    monthlyBilledCents: number;
  }[];
  clients: { id: string; name: string }[];
  canEdit: boolean;
  onNotice: (notice: string | null) => void;
}) {
  const mapBilling = useMapBillingClient();
  const create = useCreateClient();
  const canCreate = useCan()("client", "create");
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [markups, setMarkups] = useState<Record<string, string>>({});
  const error = create.error ?? mapBilling.error;
  const busy = create.isPending || mapBilling.isPending;

  async function map(clientName: string) {
    const choice = choices[clientName];
    if (!choice) return;
    onNotice(null);
    try {
      const clientId =
        choice === newClient
          ? (
              await create.mutateAsync({
                name: clientName,
                markupPct: Number(markups[clientName] ?? "20"),
              })
            ).id
          : choice;
      await mapBilling.mutateAsync({ clientName, clientId });
      onNotice(
        `Matched billed lines for ${clientName}. Reconciliation re-ran.`,
      );
    } catch {
      // Shown via error below.
    }
  }

  return (
    <section
      className="recon-panel"
      aria-labelledby="unmatched-billing-title"
      style={{ marginTop: 16 }}
    >
      <h2 id="unmatched-billing-title">
        Unmatched names on the client billing CSV
      </h2>
      <p>
        Match each name once; the next upload remembers it.
        {canCreate
          ? " Or add it as a new client (counts toward your plan)."
          : ""}
      </p>
      {error && (
        <span className="dialog-error" role="alert">
          {error.message}
        </span>
      )}
      <div className="recon-table-wrap">
        <table className="recon-table">
          <thead>
            <tr>
              <th scope="col">Billed client</th>
              <th scope="col" className="num">
                Billed / mo
              </th>
              <th scope="col">SeatTrue client</th>
              <th scope="col">
                <span className="sr-only">Save</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {names.map((entry) => {
              const selectId = `billing-${entry.clientName}`;
              const choice = choices[entry.clientName] ?? "";
              return (
                <tr key={entry.clientName}>
                  <td>
                    <div>{entry.clientName}</div>
                    <div className="recon-summary">
                      {entry.lineCount} line{entry.lineCount === 1 ? "" : "s"} ·{" "}
                      {entry.seats} seats
                    </div>
                  </td>
                  <td className="num">
                    {formatCents(entry.monthlyBilledCents)}
                  </td>
                  <td>
                    <label className="sr-only" htmlFor={selectId}>
                      Client for {entry.clientName}
                    </label>
                    <select
                      id={selectId}
                      className="recon-select"
                      disabled={!canEdit}
                      value={choice}
                      onChange={(event) =>
                        setChoices((current) => ({
                          ...current,
                          [entry.clientName]: event.target.value,
                        }))
                      }
                    >
                      <option value="">Choose a client…</option>
                      {canCreate && (
                        <option value={newClient}>+ Add as new client</option>
                      )}
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.name}
                        </option>
                      ))}
                    </select>
                    {choice === newClient && (
                      <label className="billing-markup">
                        Markup %{" "}
                        <input
                          type="number"
                          min={0}
                          max={500}
                          step="0.01"
                          className="recon-select"
                          value={markups[entry.clientName] ?? "20"}
                          onChange={(event) =>
                            setMarkups((current) => ({
                              ...current,
                              [entry.clientName]: event.target.value,
                            }))
                          }
                        />
                      </label>
                    )}
                  </td>
                  <td>
                    <Button
                      size="sm"
                      type="button"
                      disabled={!canEdit || !choice || busy}
                      onClick={() => map(entry.clientName)}
                    >
                      Match
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
