/**
 * Integrations directory. Strict rule: "live" only when the code ships and
 * tests it. Today that is the one CSV parser in packages/recon/src/pax8-csv.ts
 * (Pax8 billing export, Partner Center reconciliation file), covered by
 * packages/recon/src/reconcile.test.ts. Nothing imports from or writes to a
 * PSA yet, so every PSA entry is "soon". No dates on anything that isn't live.
 */
export type IntegrationCategory = "distributors" | "microsoft" | "psa" | "ai";

export const integrationCategories: {
  id: IntegrationCategory;
  label: string;
}[] = [
  { id: "distributors", label: "Distributors" },
  { id: "microsoft", label: "Microsoft" },
  { id: "psa", label: "PSA and billing" },
  { id: "ai", label: "AI" },
];

export type Integration = {
  slug: string;
  name: string;
  category: IntegrationCategory;
  status: "live" | "soon";
  method: "CSV import" | "API" | "MCP server";
  /** One line for the grid: what SeatTrue pulls. */
  pulls: string;
  /** Meta: title ≤ 60, description ≤ 155 (tested). */
  title: string;
  description: string;
  intro: string;
  /** Fields read (live) or planned (soon). */
  data: string[];
  /** Live only: how to use it today. */
  setup: { title: string; body: string }[];
  /** Soon only: what to do until it ships. */
  meanwhile?: string;
};

export const integrations: Integration[] = [
  {
    slug: "pax8-csv",
    name: "Pax8",
    category: "distributors",
    status: "live",
    method: "CSV import",
    pulls:
      "Every subscription line on the month's bill: customer, SKU, seats, your cost.",
    title: "Pax8 billing CSV import · SeatTrue integrations",
    description:
      "Upload the month's Pax8 billing export as a CSV. SeatTrue reads customer, SKU, seats and your unit cost, then checks each line against client invoices.",
    intro:
      "Upload the Pax8 billing export and SeatTrue reads every subscription line on it. No API keys, nothing to approve in Pax8, and SeatTrue never writes back.",
    data: [
      "Company ID and company name (the Pax8 customer)",
      "SKU and product name",
      "Quantity (seats billed)",
      "Your unit cost; when the file has both a cost and a price column, cost wins, because Pax8's price column can be the suggested retail price",
      "Billing term, if the file includes it",
    ],
    setup: [
      {
        title: "Export from Pax8",
        body: "Download the month's billing lines from Pax8 as a CSV. Column names are matched by meaning, ignoring case and spacing, so “Company ID”, “company_id” and “companyId” all work.",
      },
      {
        title: "Upload in SeatTrue",
        body: "Choose Upload Pax8 CSV on the overview. Owners, admins and techs can all upload. If a required column is missing, the upload names it and nothing is stored.",
      },
      {
        title: "Map customers once",
        body: "Link each Pax8 company to one of your clients. Mappings are kept, so next month's upload only shows what changed.",
      },
      {
        title: "Work the exceptions",
        body: "Each line is checked on seats and on cost × that client's markup. Mismatches land in the exceptions inbox with a monthly dollar figure.",
      },
    ],
  },
  {
    slug: "pax8-api",
    name: "Pax8 API",
    category: "distributors",
    status: "soon",
    method: "API",
    pulls: "The same bill lines as the CSV, fetched for you each month.",
    title: "Pax8 API connection (coming soon) · SeatTrue",
    description:
      "A direct Pax8 API connection is coming to SeatTrue so the monthly bill arrives without a CSV export. It isn't live; the Pax8 CSV import is.",
    intro:
      "A direct connection to Pax8, so the month's bill lines arrive without anyone exporting a file. It needs Pax8's approval and isn't live.",
    data: [
      "Invoice lines per customer: company, SKU, product, quantity, unit cost",
      "Billing term per subscription",
    ],
    setup: [],
    meanwhile: "Use the Pax8 CSV import. It reads the same fields today.",
  },
  {
    slug: "giacom",
    name: "Giacom",
    category: "distributors",
    status: "soon",
    method: "API",
    pulls: "Microsoft subscription lines and your cost from Giacom billing.",
    title: "Giacom billing integration (coming soon) · SeatTrue",
    description:
      "Giacom support is coming to SeatTrue: Microsoft 365 subscription lines and cost from your Giacom bill, checked against client invoices. Not live yet.",
    intro:
      "Support for MSPs who buy Microsoft 365 through Giacom: the month's subscription lines and your cost, checked against what each client is invoiced. Not live yet.",
    data: [
      "Customer, product and quantity per subscription",
      "Your unit cost and billing term",
    ],
    setup: [],
    meanwhile:
      "SeatTrue reads Pax8 billing exports and Microsoft Partner Center reconciliation files today. A Giacom export isn't a supported format yet.",
  },
  {
    slug: "sherweb",
    name: "Sherweb",
    category: "distributors",
    status: "soon",
    method: "API",
    pulls: "Microsoft subscription lines and your cost from Sherweb billing.",
    title: "Sherweb billing integration (coming soon) · SeatTrue",
    description:
      "Sherweb support is coming to SeatTrue: Microsoft 365 subscription lines and cost from your Sherweb bill, checked against client invoices. Not live yet.",
    intro:
      "Support for MSPs who buy Microsoft 365 through Sherweb: the month's subscription lines and your cost, checked against what each client is invoiced. Not live yet.",
    data: [
      "Customer, product and quantity per subscription",
      "Your unit cost and billing term",
    ],
    setup: [],
    meanwhile:
      "SeatTrue reads Pax8 billing exports and Microsoft Partner Center reconciliation files today. A Sherweb export isn't a supported format yet.",
  },
  {
    slug: "partner-center-csv",
    name: "Microsoft Partner Center",
    category: "microsoft",
    status: "live",
    method: "CSV import",
    pulls:
      "Reconciliation file lines: customer, SKU, billable quantity, effective unit price.",
    title: "Partner Center reconciliation CSV import · SeatTrue",
    description:
      "Direct CSP partners: upload a Partner Center reconciliation file as CSV. SeatTrue reads billable quantity and effective unit price per customer and SKU.",
    intro:
      "For partners who buy from Microsoft directly. Upload a Partner Center reconciliation file saved as CSV and SeatTrue reads it with the same importer as Pax8 exports.",
    data: [
      "CustomerId and CustomerName",
      "SkuId and SkuName",
      "BillableQuantity (used over Quantity, because it's the billed count)",
      "EffectiveUnitPrice, Microsoft's recommended field for licence-based cost",
      "TermAndBillingCycle",
    ],
    setup: [
      {
        title: "Download the reconciliation file",
        body: "In Partner Center, download the month's invoice reconciliation file and save it as CSV.",
      },
      {
        title: "Upload in SeatTrue",
        body: "Use the same Upload Pax8 CSV button on the overview. The importer recognises Partner Center column names; a leading apostrophe on numbers is ignored.",
      },
      {
        title: "Map customers once",
        body: "Link each Partner Center customer to one of your clients. Mappings are kept for next month.",
      },
      {
        title: "Work the exceptions",
        body: "Lines are checked on billable quantity and on effective unit price × that client's markup.",
      },
    ],
  },
  {
    slug: "partner-center-api",
    name: "Partner Center API",
    category: "microsoft",
    status: "soon",
    method: "API",
    pulls: "Reconciliation line items fetched from Microsoft each month.",
    title: "Partner Center API connection (coming soon) · SeatTrue",
    description:
      "A Partner Center API connection is coming to SeatTrue so reconciliation lines arrive without a file download. Not live; the CSV import is.",
    intro:
      "A direct connection to Microsoft Partner Center, so reconciliation line items arrive without a file download. Not live yet.",
    data: [
      "Customer, SKU and billable quantity per line",
      "Effective unit price and term",
    ],
    setup: [],
    meanwhile:
      "Download the reconciliation file from Partner Center and upload it as CSV.",
  },
  {
    slug: "connectwise",
    name: "ConnectWise PSA",
    category: "psa",
    status: "soon",
    method: "API",
    pulls: "Companies and agreement additions: what each client is billed.",
    title: "ConnectWise PSA sync (coming soon) · SeatTrue",
    description:
      "A ConnectWise PSA sync is coming to SeatTrue: companies and agreement additions read in, so client prices don't need entering by hand. Not live yet.",
    intro:
      "A read-only sync with ConnectWise PSA, so the client side of the check (who you bill, for what, at what price) comes straight from your agreements. Not live yet.",
    data: [
      "Companies, to map against distributor customers",
      "Agreement additions: product, quantity and unit price per client",
    ],
    setup: [],
    meanwhile:
      "Set clients and their markup in SeatTrue. Nothing reads from or writes to ConnectWise today.",
  },
  {
    slug: "autotask",
    name: "Autotask PSA",
    category: "psa",
    status: "soon",
    method: "API",
    pulls: "Companies and contract services: what each client is billed.",
    title: "Autotask PSA sync (coming soon) · SeatTrue",
    description:
      "An Autotask PSA sync is coming to SeatTrue: companies and contract services read in, so client prices don't need entering by hand. Not live yet.",
    intro:
      "A read-only sync with Autotask, so the client side of the check (who you bill, for what, at what price) comes straight from your contracts. Not live yet.",
    data: [
      "Companies, to map against distributor customers",
      "Contract services: product, quantity and unit price per client",
    ],
    setup: [],
    meanwhile:
      "Set clients and their markup in SeatTrue. Nothing reads from or writes to Autotask today.",
  },
  {
    slug: "halopsa",
    name: "HaloPSA",
    category: "psa",
    status: "soon",
    method: "API",
    pulls: "Clients and recurring invoice lines: what each client is billed.",
    title: "HaloPSA sync (coming soon) · SeatTrue integrations",
    description:
      "A HaloPSA sync is coming to SeatTrue: clients and recurring invoice lines read in, so client prices don't need entering by hand. Not live yet.",
    intro:
      "A read-only sync with HaloPSA, so the client side of the check (who you bill, for what, at what price) comes straight from your recurring invoices. Not live yet.",
    data: [
      "Clients, to map against distributor customers",
      "Recurring invoice lines: product, quantity and unit price per client",
    ],
    setup: [],
    meanwhile:
      "Set clients and their markup in SeatTrue. Nothing reads from or writes to HaloPSA today.",
  },
  {
    slug: "mcp-server",
    name: "SeatTrue MCP server",
    category: "ai",
    status: "soon",
    method: "MCP server",
    pulls:
      "Lets your AI assistant read exceptions and leakage totals. Read-only.",
    title: "SeatTrue MCP server (coming soon) · SeatTrue",
    description:
      "An MCP server is coming to SeatTrue so AI assistants can read your exceptions, leakage totals and client detail, read-only. Not live yet.",
    intro:
      "A Model Context Protocol server, so an AI assistant such as Claude can answer “which clients leaked most this month?” from your SeatTrue workspace, read-only. Not live yet.",
    data: [
      "Open exceptions with their monthly dollar figure",
      "Leakage totals per run",
      "Client detail: mappings, markup and exception history",
    ],
    setup: [],
    meanwhile: "Everything is in the SeatTrue app today.",
  },
];

export const integrationBySlug = new Map(
  integrations.map((integration) => [integration.slug, integration]),
);

export function integrationPath(slug: string): string {
  return `/integrations/${slug}`;
}
