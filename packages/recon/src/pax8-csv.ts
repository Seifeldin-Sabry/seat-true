import type { VendorLine, VendorSource } from "./types";

/**
 * Distributor billing export → VendorLine[].
 *
 * Pax8's portal CSV headers are not publicly documented, so headers are
 * matched against aliases (case, spaces and underscores ignored), in priority
 * order. Covers Pax8's API InvoiceItem field names and Microsoft Partner
 * Center's reconciliation file. Add the real header here when a partner
 * shares an export; no other code changes needed.
 */
const columnAliases = {
  customerKey: ["company id", "customer id", "client id"],
  customerName: ["company name", "customer name", "client name", "company"],
  sku: ["sku", "sku id", "product sku", "offer id", "product id"],
  productName: ["product name", "sku name", "product", "description"],
  // Partner Center: BillableQuantity is the billed count, Quantity is not.
  quantity: ["billable quantity", "quantity", "qty", "seats", "licenses"],
  // MSP buy price first: Pax8 "price" can be SRP when "cost" is present.
  unitCost: [
    "cost",
    "unit cost",
    "partner cost",
    "partner unit price",
    "effective unit price",
    "unit price",
    "price",
  ],
  billingTerm: ["term and billing cycle", "billing term", "term", "commitment"],
} as const;

export const normalizeHeader = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Header row → column index per field (first alias found wins, -1 if none).
 * Throws CsvFormatError naming the first alias of each missing required field.
 */
export function resolveColumns<Field extends string>(
  header: string[],
  aliases: Record<Field, readonly string[]>,
  required: readonly Field[],
): Record<Field, number> {
  const normalized = header.map(normalizeHeader);
  const index = {} as Record<Field, number>;
  for (const field of Object.keys(aliases) as Field[]) {
    const alias = aliases[field]
      .map(normalizeHeader)
      .find((candidate) => normalized.includes(candidate));
    index[field] = alias === undefined ? -1 : normalized.indexOf(alias);
  }
  const missing = required.filter((field) => index[field] === -1);
  if (missing.length > 0) {
    throw new CsvFormatError(
      `Missing columns: ${missing.map((field) => aliases[field][0]).join(", ")}.`,
    );
  }
  return index;
}

type Column = keyof typeof columnAliases;
const requiredColumns: Column[] = [
  "customerKey",
  "customerName",
  "sku",
  "quantity",
  "unitCost",
];

export class CsvFormatError extends Error {}

/** RFC 4180: quoted fields, escaped quotes, commas and newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
}

/** "$1,234.50", "1234.5", "€ 12" → cents. */
export function parseMoneyToCents(value: string, rowNumber: number): number {
  const amount = Number(value.replace(/[$£€,\s]/g, ""));
  if (!Number.isFinite(amount)) {
    throw new CsvFormatError(`Row ${rowNumber}: "${value}" is not a price.`);
  }
  return Math.round(amount * 100);
}

export function parsePax8Csv(text: string): VendorLine[] {
  const [header, ...body] = parseCsv(text.replace(/^﻿/, ""));
  if (!header) throw new CsvFormatError("The file is empty.");

  const index = resolveColumns(header, columnAliases, requiredColumns);

  const cell = (cells: string[], column: Column) =>
    index[column] === -1
      ? ""
      : (cells[index[column]] ?? "").trim().replace(/^'/, "");

  return body.map((cells, offset) => {
    const rowNumber = offset + 2;
    const quantity = Number(cell(cells, "quantity"));
    if (!Number.isInteger(quantity) || quantity < 0) {
      throw new CsvFormatError(
        `Row ${rowNumber}: quantity must be a whole number.`,
      );
    }
    const sku = cell(cells, "sku");
    const customerKey = cell(cells, "customerKey");
    if (!sku || !customerKey) {
      throw new CsvFormatError(
        `Row ${rowNumber}: company ID and SKU are required.`,
      );
    }
    return {
      customerKey,
      customerName: cell(cells, "customerName"),
      sku,
      productName: cell(cells, "productName") || sku,
      quantity,
      unitCostCents: parseMoneyToCents(cell(cells, "unitCost"), rowNumber),
      billingTerm: cell(cells, "billingTerm") || "Monthly",
    };
  });
}

export function pax8CsvSource(csv: string): VendorSource {
  return { name: "pax8-csv", fetchLines: async () => parsePax8Csv(csv) };
}
