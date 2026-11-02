import {
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

const ownerId = () =>
  text("owner_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" });
const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).defaultNow().notNull();

/** PSA clients. Markup stored in basis points (2000 = 20%) to stay integer. */
export const clients = pgTable(
  "clients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: ownerId(),
    name: varchar("name", { length: 160 }).notNull(),
    psaId: varchar("psa_id", { length: 64 }),
    status: varchar("status", { length: 16 })
      .$type<"active" | "offboarded">()
      .default("active")
      .notNull(),
    markupBps: integer("markup_bps").default(2000).notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("clients_owner_id_idx").on(table.ownerId)],
);

/** Distributor customer (e.g. Pax8 company ID) → PSA client. */
export const customerMappings = pgTable(
  "customer_mappings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: ownerId(),
    customerKey: varchar("customer_key", { length: 128 }).notNull(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("customer_mappings_owner_key_idx").on(
      table.ownerId,
      table.customerKey,
    ),
  ],
);

/** What the PSA agreement bills a client for one SKU. */
export const agreementLines = pgTable(
  "agreement_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: ownerId(),
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
    index("agreement_lines_owner_id_idx").on(table.ownerId),
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
    ownerId: ownerId(),
    source: varchar("source", { length: 32 }).notNull(),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    vendorLines: jsonb("vendor_lines").$type<StoredVendorLine[]>().notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("reconciliation_runs_owner_id_idx").on(table.ownerId)],
);

export type ExceptionStatus = "open" | "approved" | "billed" | "dismissed";

export const reconciliationExceptions = pgTable(
  "reconciliation_exceptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ownerId: ownerId(),
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
    createdAt: createdAt(),
  },
  (table) => [
    index("reconciliation_exceptions_owner_run_idx").on(
      table.ownerId,
      table.runId,
    ),
  ],
);

/** Landing-page waitlist; not owner scoped. */
export const waitlistEntries = pgTable("waitlist_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 254 }).notNull().unique(),
  company: varchar("company", { length: 160 }),
  seats: integer("seats"),
  createdAt: createdAt(),
});
