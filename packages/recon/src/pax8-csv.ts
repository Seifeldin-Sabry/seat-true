import type { VendorLine, VendorSource } from "./types";

/**
 * Pax8 billing export → VendorLine[].
 *
 * Header names are matched case-insensitively against aliases because the
 * real export columns are not verified yet; add the real header to the alias
 * list when a partner shares an export, no other code changes needed.
 */
const columnAliases = {
  customerKey: ["company id", "companyid", "customer id", "client id"],
  customerName: ["company name", "company", "customer name", "client name"],
  sku: ["sku", "product sku", "product id", "offer id"],
  productName: ["product name", "product", "description", "offer name"],
  quantity: ["quantity", "qty", "seats", "licenses"],
  unitCost: [
    "unit price",
    "partner unit price",
    "partner cost",
    "unit cost",
    "price",
  ],
  billingTerm: ["billing term", "term", "commitment term"],
} as const;

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

function parseMoneyToCents(value: string, rowNumber: number): number {
  const amount = Number(value.replace(/[$£€,\s]/g, ""));
  if (!Number.isFinite(amount)) {
    throw new CsvFormatError(`Row ${rowNumber}: "${value}" is not a price.`);
  }
  return Math.round(amount * 100);
}

export function parsePax8Csv(text: string): VendorLine[] {
  const [header, ...body] = parseCsv(text.replace(/^﻿/, ""));
  if (!header) throw new CsvFormatError("The file is empty.");

  const normalized = header.map((cell) => cell.trim().toLowerCase());
  const index = {} as Record<Column, number>;
  for (const column of Object.keys(columnAliases) as Column[]) {
    index[column] = normalized.findIndex((cell) =>
      (columnAliases[column] as readonly string[]).includes(cell),
    );
  }
  const missing = requiredColumns.filter((column) => index[column] === -1);
  if (missing.length > 0) {
    throw new CsvFormatError(
      `Missing columns: ${missing.map((column) => columnAliases[column][0]).join(", ")}.`,
    );
  }

  const cell = (cells: string[], column: Column) =>
    index[column] === -1 ? "" : (cells[index[column]] ?? "").trim();

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
