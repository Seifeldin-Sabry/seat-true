import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { user } from "./auth-schema";
import { organization } from "./org-schema";

/** Workspace scope (Better Auth organization). Replaced owner_id in 0006. */
const organizationId = () =>
  text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" });
const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).defaultNow().notNull();

/** PSA clients. Markup stored in basis points (2000 = 20%) to stay integer. */
export const clients = pgTable(
  "clients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: organizationId(),
    name: varchar("name", { length: 160 }).notNull(),
    psaId: varchar("psa_id", { length: 64 }),
    status: varchar("status", { length: 16 })
      .$type<"active" | "offboarded">()
      .default("active")
      .notNull(),
    markupBps: integer("markup_bps").default(2000).notNull(),
    /** Over the plan's client limit: read-only, excluded from reconciliation. */
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    /** Archived by the user: read-only, excluded, and not counted against limits. */
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    /** Drives least-recently-active selection when a downgrade must lock clients. */
    lastActiveAt: timestamp("last_active_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("clients_organization_id_idx").on(table.organizationId)],
);

/** Distributor customer (e.g. Pax8 company ID) → PSA client. */
export const customerMappings = pgTable(
  "customer_mappings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: organizationId(),
    customerKey: varchar("customer_key", { length: 128 }).notNull(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("customer_mappings_organization_key_idx").on(
      table.organizationId,
      table.customerKey,
    ),
  ],
);

/** What the PSA agreement bills a client for one SKU. */
export const agreementLines = pgTable(
  "agreement_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: organizationId(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    sku: varchar("sku", { length: 64 }).notNull(),
    productName: varchar("product_name", { length: 200 }).notNull(),
    quantity: integer("quantity").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index("agreement_lines_organization_id_idx").on(table.organizationId),
    uniqueIndex("agreement_lines_client_sku_idx").on(table.clientId, table.sku),
  ],
);

export type StoredVendorLine = {
  customerKey: string;
  customerName: string;
  sku: string;
  productName: string;
  quantity: number;
  unitCostCents: number;
  billingTerm: string;
};

/** One uploaded distributor bill. Parsed lines kept so mapping fixes can re-run it. */
export const reconciliationRuns = pgTable(
  "reconciliation_runs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: organizationId(),
    source: varchar("source", { length: 32 }).notNull(),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    vendorLines: jsonb("vendor_lines").$type<StoredVendorLine[]>().notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index("reconciliation_runs_organization_id_idx").on(table.organizationId),
  ],
);

/** A client billing row whose client name didn't match a SeatTrue client. */
export type StoredBilledLine = {
  rowNumber: number;
  clientName: string;
  sku: string;
  productName: string;
  quantity: number;
  unitPriceCents: number;
  period: string;
};

/**
 * Latest client billing CSV import per workspace (the billed side). Matched
 * rows become agreement_lines; unmatched rows wait here until mapped.
 */
export const billingImports = pgTable(
  "billing_imports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: organizationId(),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    lineCount: integer("line_count").notNull(),
    unmappedLines: jsonb("unmapped_lines")
      .$type<StoredBilledLine[]>()
      .notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index("billing_imports_organization_id_idx").on(table.organizationId),
  ],
);

export type ExceptionStatus = "open" | "approved" | "billed" | "dismissed";

export const reconciliationExceptions = pgTable(
  "reconciliation_exceptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: organizationId(),
    runId: uuid("run_id")
      .notNull()
      .references(() => reconciliationRuns.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 32 }).notNull(),
    clientId: uuid("client_id").references(() => clients.id, {
      onDelete: "set null",
    }),
    customerKey: varchar("customer_key", { length: 128 }).notNull(),
    customerName: varchar("customer_name", { length: 200 }).notNull(),
    sku: varchar("sku", { length: 64 }).notNull(),
    productName: varchar("product_name", { length: 200 }).notNull(),
    vendorQuantity: integer("vendor_quantity").notNull(),
    billedQuantity: integer("billed_quantity").notNull(),
    unitCostCents: integer("unit_cost_cents").notNull(),
    expectedUnitPriceCents: integer("expected_unit_price_cents").notNull(),
    billedUnitPriceCents: integer("billed_unit_price_cents").notNull(),
    monthlyImpactCents: integer("monthly_impact_cents").notNull(),
    summary: text("summary").notNull(),
    status: varchar("status", { length: 16 })
      .$type<ExceptionStatus>()
      .default("open")
      .notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    /** Raised by anyone for a second look; resolving is a separate permission. */
    flagged: boolean("flagged").default(false).notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    index("reconciliation_exceptions_organization_run_idx").on(
      table.organizationId,
      table.runId,
    ),
  ],
);

/** Discussion on an exception (techs comment, admins resolve). */
export const exceptionComments = pgTable(
  "exception_comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: organizationId(),
    exceptionId: uuid("exception_id")
      .notNull()
      .references(() => reconciliationExceptions.id, { onDelete: "cascade" }),
    authorUserId: text("author_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    authorEmail: text("author_email").notNull(),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("exception_comments_exception_idx").on(table.exceptionId)],
);

/** Landing-page waitlist; not workspace scoped. */
export const waitlistEntries = pgTable("waitlist_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 254 }).notNull().unique(),
  company: varchar("company", { length: 160 }),
  seats: integer("seats"),
  createdAt: createdAt(),
});
