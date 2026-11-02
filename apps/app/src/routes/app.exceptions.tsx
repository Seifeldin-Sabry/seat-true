import { Badge, Button } from "@seattrue/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AppShell } from "../components/app-shell";
import { requireSession } from "../lib/auth-navigation";
import {
  exceptionKindLabels,
  exceptionStatusLabels,
  formatCents,
} from "../lib/format";
import type { ExceptionDto, ExceptionStatus } from "../lib/recon-api";
import {
  exceptionsQueryOptions,
  useSetExceptionStatus,
} from "../lib/recon-query";

export const Route = createFileRoute("/app/exceptions")({
  headers: () => ({ "Cache-Control": "private, no-store" }),
  beforeLoad: ({ location }) => requireSession(location.href),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(exceptionsQueryOptions),
  component: ExceptionsPage,
});

type Filter = "todo" | ExceptionStatus | "all";
const filters: { value: Filter; label: string }[] = [
  { value: "todo", label: "To do" },
  { value: "approved", label: "Approved" },
  { value: "billed", label: "Billed" },
  { value: "dismissed", label: "Dismissed" },
  { value: "all", label: "All" },
];

function matches(exception: ExceptionDto, filter: Filter) {
  if (filter === "all") return true;
  if (filter === "todo") return exception.status === "open";
  return exception.status === filter;
}

function ExceptionsPage() {
  const { user } = Route.useRouteContext();
  const exceptions = useQuery(exceptionsQueryOptions);
  const setStatus = useSetExceptionStatus();
  const [filter, setFilter] = useState<Filter>("todo");
  const rows = exceptions.data ?? [];
  const visible = useMemo(
    () => rows.filter((exception) => matches(exception, filter)),
    [rows, filter],
  );

  function update(id: string, status: ExceptionStatus) {
    setStatus.mutate({ id, status });
  }

  return (
    <AppShell userName={user.name}>
      <main className="app-content">
        <section className="page-heading" aria-labelledby="exceptions-title">
          <div className="page-heading-copy">
            <div className="eyebrow">Reconciliation / Exceptions</div>
            <h1 id="exceptions-title">Exceptions inbox</h1>
            <p>
              Approve what needs adding to the invoice, mark it billed once it
              is, or dismiss false positives.
            </p>
          </div>
        </section>

        {setStatus.error && (
          <div className="error-banner" role="alert">
            <div>
              <strong>Update failed</strong>
              <p>{setStatus.error.message}</p>
            </div>
          </div>
        )}

        <fieldset className="recon-filters" aria-label="Filter by status">
          {filters.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={filter === option.value}
              onClick={() => setFilter(option.value)}
            >
              {option.label} (
              {rows.filter((row) => matches(row, option.value)).length})
            </button>
          ))}
        </fieldset>

        {visible.length === 0 ? (
          <div className="empty-state">
            <h3>Nothing here</h3>
            <p>
              {rows.length === 0 ? (
                <>
                  No reconciliation yet. <Link to="/app">Upload a bill</Link>{" "}
                  first.
                </>
              ) : (
                "No exceptions match this filter."
              )}
            </p>
          </div>
        ) : (
          <div className="recon-table-wrap">
            <table className="recon-table">
              <thead>
                <tr>
                  <th scope="col">Problem</th>
                  <th scope="col">Client</th>
                  <th scope="col">Detail</th>
                  <th scope="col" className="num">
                    Bill / billed
                  </th>
                  <th scope="col" className="num">
                    Impact / mo
                  </th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((exception) => (
                  <tr
                    key={exception.id}
                    className={
                      exception.status === "billed" ||
                      exception.status === "dismissed"
                        ? "is-resolved"
                        : undefined
                    }
                  >
                    <td>
                      <Badge
                        variant={
                          exception.kind === "overbilled" ? "outline" : "subtle"
                        }
                      >
                        {exceptionKindLabels[exception.kind]}
                      </Badge>
                    </td>
                    <td>
                      {exception.clientId ? (
                        <Link
                          to="/app/clients/$clientId"
                          params={{ clientId: exception.clientId }}
                        >
                          {exception.clientName}
                        </Link>
                      ) : (
                        exception.clientName
                      )}
                    </td>
                    <td>
                      <div>{exception.productName}</div>
                      <div className="recon-summary">{exception.summary}</div>
                    </td>
                    <td className="num">
                      {exception.vendorQuantity} / {exception.billedQuantity}
                    </td>
                    <td className="num">
                      <strong>
                        {formatCents(exception.monthlyImpactCents)}
                      </strong>
                    </td>
                    <td>
                      <RowActions
                        exception={exception}
                        disabled={setStatus.isPending}
                        onChange={(status) => update(exception.id, status)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </AppShell>
  );
}

function RowActions({
  exception,
  disabled,
  onChange,
}: {
  exception: ExceptionDto;
  disabled: boolean;
  onChange: (status: ExceptionStatus) => void;
}) {
  if (exception.status !== "open") {
    return (
      <div className="recon-row-actions">
        <Badge variant="secondary">
          {exceptionStatusLabels[exception.status]}
        </Badge>
        {exception.status === "approved" && (
          <Button
            size="sm"
            type="button"
            disabled={disabled}
            onClick={() => onChange("billed")}
          >
            Mark billed
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          type="button"
          disabled={disabled}
          onClick={() => onChange("open")}
        >
          Reopen
        </Button>
      </div>
    );
  }
  return (
    <div className="recon-row-actions">
      {exception.kind === "unmapped_customer" ? (
        <Button size="sm" asChild>
          <Link to="/app/mappings">Fix mapping</Link>
        </Button>
      ) : (
        <Button
          size="sm"
          type="button"
          disabled={disabled}
          onClick={() => onChange("approved")}
        >
          Approve
        </Button>
      )}
      <Button
        size="sm"
        variant="outline"
        type="button"
        disabled={disabled}
        onClick={() => onChange("billed")}
      >
        Mark billed
      </Button>
      <Button
        size="sm"
        variant="ghost"
        type="button"
        disabled={disabled}
        onClick={() => onChange("dismissed")}
      >
        Dismiss
      </Button>
    </div>
  );
}
