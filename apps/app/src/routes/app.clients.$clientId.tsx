import { Badge, Button, Input, Label } from "@seattrue/ui";
import { useQuery } from "@tanstack/react-query";
import type { ErrorComponentProps } from "@tanstack/react-router";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "../components/app-shell";
import { requireWorkspaceMember } from "../lib/auth-navigation";
import {
  exceptionKindLabels,
  exceptionStatusLabels,
  formatCents,
} from "../lib/format";
import type { AgreementDto, AgreementLineInput } from "../lib/recon-api";
import {
  clientQueryOptions,
  useSaveAgreementLines,
  useSetClientArchived,
  useSetClientMarkup,
} from "../lib/recon-query";
import { privateHead } from "../lib/seo";
import { useCan } from "../lib/workspace";

export const Route = createFileRoute("/app/clients/$clientId")({
  headers: () => ({ "Cache-Control": "private, no-store" }),
  head: () => privateHead("Client"),
  beforeLoad: ({ location, context }) =>
    requireWorkspaceMember(location.href, context.queryClient),
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
          <h1>Client could not be loaded</h1>
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
  const archive = useSetClientArchived();
  const markup = useSetClientMarkup();
  const can = useCan();
  const [markupDraft, setMarkupDraft] = useState<string | null>(null);
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

        {data.client.lockedAt && (
          <div className="error-banner" role="alert">
            <div>
              <strong>Locked: over your plan's client limit</strong>
              <p>
                Read-only and left out of reconciliation. Nothing was deleted.
              </p>
            </div>
            <Link to="/app/billing">Upgrade to unlock</Link>
          </div>
        )}
        <div className="recon-actions client-actions">
          {can("client", "markup") && (
            <form
              className="inline-form"
              onSubmit={(event) => {
                event.preventDefault();
                const value = Number(markupDraft);
                if (markupDraft === null || !Number.isFinite(value)) return;
                markup.mutate(
                  { id: data.client.id, markupPct: value },
                  { onSuccess: () => setMarkupDraft(null) },
                );
              }}
            >
              <div className="field-group markup-field">
                <Label htmlFor="markup">Markup %</Label>
                <Input
                  id="markup"
                  type="number"
                  min={0}
                  max={500}
                  step="0.01"
                  value={markupDraft ?? String(data.client.markupPct)}
                  onChange={(event) => setMarkupDraft(event.target.value)}
                />
              </div>
              <Button
                type="submit"
                variant="outline"
                disabled={markupDraft === null || markup.isPending}
              >
                Save markup
              </Button>
            </form>
          )}
          {markup.error && (
            <span className="dialog-error" role="alert">
              {markup.error.message}
            </span>
          )}
          {can("client", "archive") && (
            <Button
              type="button"
              variant="outline"
              disabled={archive.isPending}
              onClick={() =>
                archive.mutate({
                  id: data.client.id,
                  archived: !data.client.archivedAt,
                })
              }
            >
              {data.client.archivedAt ? "Restore client" : "Archive client"}
            </Button>
          )}
          {archive.error && (
            <span className="dialog-error" role="alert">
              {archive.error.message}
            </span>
          )}
        </div>
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
            <h2>Billed to client</h2>
            {can("run", "upload") && !client.lockedAt && !client.archivedAt ? (
              <BilledLinesEditor clientId={client.id} lines={agreements} />
            ) : agreements.length === 0 ? (
              <p>No billed lines.</p>
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

type DraftLine = {
  key: number;
  sku: string;
  productName: string;
  quantity: string;
  price: string;
};

let draftKey = 0;
const toDraft = (line: AgreementDto): DraftLine => ({
  key: draftKey++,
  sku: line.sku,
  productName: line.productName === line.sku ? "" : line.productName,
  quantity: String(line.quantity),
  price: (line.unitPriceCents / 100).toFixed(2),
});
const blankDraft = (): DraftLine => ({
  key: draftKey++,
  sku: "",
  productName: "",
  quantity: "1",
  price: "",
});

/** "$1,234.50" → 123450; null when it isn't a price. */
function priceToCents(value: string) {
  const cleaned = value.replace(/[$,\s]/g, "");
  const amount = cleaned === "" ? Number.NaN : Number(cleaned);
  return Number.isFinite(amount) && amount >= 0
    ? Math.round(amount * 100)
    : null;
}

/** What this client is invoiced, per SKU. For MSPs without a billing export. */
function BilledLinesEditor({
  clientId,
  lines,
}: {
  clientId: string;
  lines: AgreementDto[];
}) {
  const save = useSaveAgreementLines();
  const [draft, setDraft] = useState<DraftLine[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  if (!draft)
    return (
      <>
        {lines.length === 0 ? (
          <p>
            No billed lines yet. Upload a client billing CSV on the overview, or
            add them here.
          </p>
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
              {lines.map((line) => (
                <tr key={line.sku}>
                  <td>{line.productName}</td>
                  <td className="num">{line.quantity}</td>
                  <td className="num">{formatCents(line.unitPriceCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="recon-actions">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              save.reset();
              setProblem(null);
              setDraft(lines.length ? lines.map(toDraft) : [blankDraft()]);
            }}
          >
            Edit billed lines
          </Button>
        </div>
      </>
    );

  const update = (key: number, patch: Partial<DraftLine>) =>
    setDraft((current) =>
      (current ?? []).map((line) =>
        line.key === key ? { ...line, ...patch } : line,
      ),
    );

  function onSave() {
    const rows = (draft ?? []).filter(
      (line) => line.sku.trim() || line.price.trim(),
    );
    const parsed: AgreementLineInput[] = [];
    for (const [index, line] of rows.entries()) {
      const quantity = Number(line.quantity);
      const unitPriceCents = priceToCents(line.price);
      if (
        !line.sku.trim() ||
        !Number.isInteger(quantity) ||
        quantity < 0 ||
        unitPriceCents === null
      ) {
        setProblem(
          `Line ${index + 1}: needs a SKU, a whole-number quantity and a price.`,
        );
        return;
      }
      const productName = line.productName.trim();
      parsed.push({
        sku: line.sku.trim(),
        ...(productName ? { productName } : {}),
        quantity,
        unitPriceCents,
      });
    }
    setProblem(null);
    save.mutate(
      { id: clientId, lines: parsed },
      { onSuccess: () => setDraft(null) },
    );
  }

  return (
    <form
      className="billed-lines"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <p>
        SKU must match the distributor SKU on the Pax8 bill. Saving re-runs
        reconciliation; the next billing CSV upload replaces these lines.
      </p>
      {draft.map((line, index) => (
        <fieldset key={line.key} className="billed-line">
          <legend className="sr-only">Line {index + 1}</legend>
          <div className="field-group">
            <Label htmlFor={`sku-${line.key}`}>SKU</Label>
            <Input
              id={`sku-${line.key}`}
              value={line.sku}
              maxLength={64}
              onChange={(event) =>
                update(line.key, { sku: event.target.value })
              }
            />
          </div>
          <div className="field-group">
            <Label htmlFor={`product-${line.key}`}>Product</Label>
            <Input
              id={`product-${line.key}`}
              value={line.productName}
              maxLength={200}
              placeholder="Optional"
              onChange={(event) =>
                update(line.key, { productName: event.target.value })
              }
            />
          </div>
          <div className="field-group">
            <Label htmlFor={`qty-${line.key}`}>Qty</Label>
            <Input
              id={`qty-${line.key}`}
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={line.quantity}
              onChange={(event) =>
                update(line.key, { quantity: event.target.value })
              }
            />
          </div>
          <div className="field-group">
            <Label htmlFor={`price-${line.key}`}>Unit price $</Label>
            <Input
              id={`price-${line.key}`}
              inputMode="decimal"
              value={line.price}
              placeholder="26.40"
              onChange={(event) =>
                update(line.key, { price: event.target.value })
              }
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="billed-line-remove"
            aria-label={`Remove line ${index + 1}`}
            onClick={() =>
              setDraft((current) =>
                (current ?? []).filter((entry) => entry.key !== line.key),
              )
            }
          >
            Remove
          </Button>
        </fieldset>
      ))}
      {(problem ?? save.error) && (
        <span className="dialog-error" role="alert">
          {problem ?? save.error?.message}
        </span>
      )}
      <div className="recon-actions">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            setDraft((current) => [...(current ?? []), blankDraft()])
          }
        >
          Add line
        </Button>
        <Button type="submit" size="sm" disabled={save.isPending}>
          Save billed lines
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setDraft(null)}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
