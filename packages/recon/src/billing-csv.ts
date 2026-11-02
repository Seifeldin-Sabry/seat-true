import {
  CsvFormatError,
  normalizeHeader,
  parseCsv,
  parseMoneyToCents,
  resolveColumns,
} from "./pax8-csv";
import type { AgreementLine } from "./types";

/**
 * Client billing export (the "billed" side) → BilledLine[].
 *
 * Generic CSV: client, product/SKU, quantity, unit price, optional period.
 *
 * ASSUMED column names: the ConnectWise (agreement additions), Autotask
 * (contract services) and HaloPSA (recurring invoice lines) aliases below are
 * taken from those products' UI and API field names, not from real export
 * files; we have no samples yet. Matching ignores case, spaces and
 * punctuation. When a partner shares a real export, add its header here.
 */
const columnAliases = {
  client: [
    "client",
    "client name", // ASSUMED: HaloPSA recurring invoice lines
    "customer",
    "customer name",
    "company",
    "company name", // ASSUMED: ConnectWise agreement additions
    "account",
    "account name", // ASSUMED: Autotask contract services
  ],
  sku: [
    "sku",
    "product id", // ASSUMED: ConnectWise agreement additions
    "item id",
    "product sku",
    "item code", // ASSUMED: HaloPSA recurring invoice lines
    "product code",
    "service code", // ASSUMED: Autotask contract services
    "part number",
  ],
  productName: [
    "product name",
    "product",
    "item name",
    "service name", // ASSUMED: Autotask contract services
    "service",
    "description", // ASSUMED: ConnectWise / HaloPSA line description
    "item description",
  ],
  quantity: ["quantity", "qty", "units", "seats", "licenses", "count"],
  unitPrice: [
    "unit price",
    "price",
    "unit rate",
    "rate",
    "sell price",
    "unit charge", // ASSUMED: Autotask contract services
    "billed price",
    "customer price",
  ],
  period: [
    "period",
    "billing period",
    "invoice period",
    "month",
    "invoice date",
    "billing date",
  ],
} as const;

type Column = keyof typeof columnAliases;
const requiredColumns: Column[] = ["client", "sku", "quantity", "unitPrice"];

/** Column limits match the agreement_lines / clients tables. */
const maxSkuLength = 64;
const maxNameLength = 160;
const maxProductLength = 200;

export type BilledLine = {
  rowNumber: number;
  clientName: string;
  sku: string;
  productName: string;
  quantity: number;
  unitPriceCents: number;
  period: string;
};

export type BillingRowError = { rowNumber: number; message: string };

/**
 * Throws CsvFormatError for file-level problems (empty, missing columns, more
 * than one billing period). Row-level problems come back in `errors`, one per
 * row, so the caller can show them all at once.
 */
export function parseBillingCsv(text: string): {
  lines: BilledLine[];
  errors: BillingRowError[];
} {
  const [header, ...body] = parseCsv(text.replace(/^﻿/, ""));
  if (!header) throw new CsvFormatError("The file is empty.");
  const index = resolveColumns(header, columnAliases, requiredColumns);
  const cell = (cells: string[], column: Column) =>
    index[column] === -1
      ? ""
      : (cells[index[column]] ?? "").trim().replace(/^'/, "");

  /** A billed line, an error message, or null for a totals row. */
  function readRow(
    cells: string[],
    rowNumber: number,
  ): BilledLine | string | null {
    const clientName = cell(cells, "client");
    const sku = cell(cells, "sku");
    // Totals and subtotals in PSA exports carry an amount but no client or SKU.
    if (!clientName && !sku) return null;
    if (!clientName) return "client is required.";
    if (!sku) return "SKU / product ID is required.";
    if (sku.length > maxSkuLength)
      return `SKU is longer than ${maxSkuLength} characters.`;
    const rawQuantity = cell(cells, "quantity");
    const quantity = Number(rawQuantity.replace(/,/g, ""));
    if (rawQuantity === "" || !Number.isInteger(quantity) || quantity < 0)
      return `quantity "${rawQuantity}" must be a whole number, 0 or more.`;
    const rawPrice = cell(cells, "unitPrice");
    if (rawPrice === "") return "unit price is required.";
    let unitPriceCents: number;
    try {
      unitPriceCents = parseMoneyToCents(rawPrice, rowNumber);
    } catch {
      return `unit price "${rawPrice}" is not a price.`;
    }
    if (unitPriceCents < 0)
      return `unit price "${rawPrice}" is negative; credits aren't supported.`;
    return {
      rowNumber,
      clientName: clientName.slice(0, maxNameLength),
      sku,
      productName: (cell(cells, "productName") || sku).slice(
        0,
        maxProductLength,
      ),
      quantity,
      unitPriceCents,
      period: cell(cells, "period"),
    };
  }

  const lines: BilledLine[] = [];
  const errors: BillingRowError[] = [];
  for (const [offset, cells] of body.entries()) {
    const rowNumber = offset + 2;
    const row = readRow(cells, rowNumber);
    if (typeof row === "string") errors.push({ rowNumber, message: row });
    else if (row) lines.push(row);
  }

  const periods = new Set(lines.map((line) => line.period).filter(Boolean));
  if (periods.size > 1) {
    throw new CsvFormatError(
      `The file covers ${periods.size} billing periods (${[...periods].slice(0, 3).join(", ")}…). Export one month at a time.`,
    );
  }
  return { lines, errors };
}

/** Case, spacing and punctuation-insensitive client name, for matching. */
export const normalizeClientName = normalizeHeader;

export type BilledAgreementLine = AgreementLine & { productName: string };

/**
 * Billed lines → one agreement line per client + SKU. Lines whose client
 * can't be resolved come back in `unmatched`. Duplicate client + SKU lines
 * (several agreement additions for one product) are summed; the unit price
 * becomes the quantity-weighted average.
 */
export function billedLinesToAgreements(
  lines: BilledLine[],
  resolveClientId: (clientName: string) => string | undefined,
): { agreements: BilledAgreementLine[]; unmatched: BilledLine[] } {
  const groups = new Map<
    string,
    BilledAgreementLine & { totalCents: number }
  >();
  const unmatched: BilledLine[] = [];
  for (const line of lines) {
    const clientId = resolveClientId(line.clientName);
    if (!clientId) {
      unmatched.push(line);
      continue;
    }
    const key = `${clientId}\u0000${line.sku}`;
    const group = groups.get(key) ?? {
      clientId,
      sku: line.sku,
      productName: line.productName,
      quantity: 0,
      unitPriceCents: 0,
      totalCents: 0,
    };
    group.quantity += line.quantity;
    group.totalCents += line.quantity * line.unitPriceCents;
    // A zero-quantity line still states the price.
    group.unitPriceCents =
      group.quantity > 0
        ? Math.round(group.totalCents / group.quantity)
        : line.unitPriceCents;
    groups.set(key, group);
  }
  return {
    agreements: [...groups.values()].map(({ totalCents: _, ...line }) => line),
    unmatched,
  };
}
