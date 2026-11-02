import {
  agreementLines,
  billingImports,
  clients,
  customerMappings,
  type Database,
  type ExceptionStatus,
  exceptionComments,
  reconciliationExceptions,
  reconciliationRuns,
  type StoredBilledLine,
  type StoredVendorLine,
  skuAliases,
  waitlistEntries,
} from "@seattrue/db";
import {
  applySkuAliases,
  type BillingRowError,
  billedLinesToAgreements,
  CsvFormatError,
  demoAgreements,
  demoClients,
  demoPax8Csv,
  type ExceptionKind,
  exceptionKinds,
  normalizeClientName,
  parseBillingCsv,
  parsePax8Csv,
  reconcile,
  skuAliasKey,
  type VendorLine,
} from "@seattrue/recon";
import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  like,
  not,
} from "drizzle-orm";
import { type Actor, type AuditAction, recordAudit } from "./audit";

export type ClientSummaryDto = {
  id: string;
  name: string;
  psaId: string | null;
  status: "active" | "offboarded";
  markupPct: number;
  vendorSeats: number;
  leakageCents: number;
  openCount: number;
  /** Over the plan limit after a downgrade: read-only until upgrade. */
  lockedAt: string | null;
  archivedAt: string | null;
  lastActiveAt: string;
};

export type ExceptionDto = {
  id: string;
  kind: ExceptionKind;
  clientId: string | null;
  clientName: string;
  customerKey: string;
  sku: string;
  productName: string;
  vendorQuantity: number;
  billedQuantity: number;
  unitCostCents: number;
  expectedUnitPriceCents: number;
  billedUnitPriceCents: number;
  monthlyImpactCents: number;
  summary: string;
  status: ExceptionStatus;
  /** Raised for a second look (techs can flag; resolving needs an admin). */
  flagged: boolean;
  commentCount: number;
};

export type CommentDto = {
  id: string;
  authorEmail: string;
  body: string;
  createdAt: string;
};

export type RunDto = {
  id: string;
  fileName: string;
  createdAt: string;
  lineCount: number;
  customerCount: number;
};

export type BillingImportSummaryDto = {
  fileName: string;
  createdAt: string;
  lineCount: number;
  unmappedCount: number;
};

export type OverviewDto = {
  run: RunDto | null;
  /** Latest client billing CSV import (the billed side), if any. */
  billingImport: BillingImportSummaryDto | null;
  leakageCents: number;
  recoveredCents: number;
  overbilledCents: number;
  openCount: number;
  byKind: Record<ExceptionKind, { count: number; cents: number }>;
  clients: ClientSummaryDto[];
};

export type AgreementDto = {
  sku: string;
  productName: string;
  quantity: number;
  unitPriceCents: number;
};

export type ClientDetailDto = {
  client: ClientSummaryDto;
  customerKeys: string[];
  agreements: AgreementDto[];
  exceptions: ExceptionDto[];
};

export type UnmappedCustomerDto = {
  customerKey: string;
  customerName: string;
  seats: number;
  monthlyCostCents: number;
};

export type UnmappedBillingClientDto = {
  clientName: string;
  lineCount: number;
  seats: number;
  monthlyBilledCents: number;
};

export type BilledSkuDto = {
  /** As billed (PSA SKU / product ID). */
  sku: string;
  productName: string;
  clientCount: number;
  quantity: number;
  /** Distributor SKU it maps to; "" = not a distributor product; null = no alias. */
  aliasSku: string | null;
};

export type MappingsDto = {
  /** Billed SKUs not on the distributor bill, plus every saved alias. */
  billedSkus: BilledSkuDto[];
  /** SKUs on the latest distributor bill, to alias onto. */
  vendorSkus: { sku: string; productName: string }[];
  mappings: { customerKey: string; clientId: string; clientName: string }[];
  unmapped: UnmappedCustomerDto[];
  /** Client names from the billing CSV that match no SeatTrue client. */
  unmappedBilling: UnmappedBillingClientDto[];
  clients: { id: string; name: string }[];
};

export type WaitlistInput = {
  email: string;
  company?: string;
  seats?: number;
};

export class CsvRejectedError extends Error {
  constructor(
    message: string,
    /** Per-row problems; nothing was stored. */
    readonly rows: BillingRowError[] = [],
  ) {
    super(message);
  }
}

export type BillingImportDto = {
  fileName: string;
  /** Billed rows read from the file. */
  lineCount: number;
  /** Agreement lines written (duplicate client + SKU rows are summed). */
  agreementCount: number;
  matchedClients: number;
  unmapped: { clientName: string; lineCount: number }[];
  /** Locked or archived clients whose rows were left out. */
  skippedClients: string[];
};

export type AgreementLineInput = {
  sku: string;
  productName?: string;
  quantity: number;
  unitPriceCents: number;
};

/** Mapping key for a billing CSV client name; never collides with distributor IDs. */
const billingKeyPrefix = "billing:";
const billingKey = (clientName: string) =>
  `${billingKeyPrefix}${normalizeClientName(clientName)}`.slice(0, 128);
const isBillingKey = (customerKey: string) =>
  customerKey.startsWith(billingKeyPrefix);

/** Writes to a locked or archived client are refused; its data stays. */
export class ClientLockedError extends Error {
  constructor(name: string, reason: "locked" | "archived") {
    super(
      reason === "locked"
        ? `${name} is locked because it's over your plan's client limit. Upgrade to unlock it.`
        : `${name} is archived. Restore it to make changes.`,
    );
    this.name = "ClientLockedError";
  }
}

export type ClientInput = { name: string; psaId?: string; markupPct: number };

/** Minimal client view used by plan limits. */
export type LimitClient = {
  id: string;
  name: string;
  lastActiveAt: Date;
  lockedAt: Date | null;
};

export type ReconService = {
  overview(organizationId: string): Promise<OverviewDto>;
  client(
    organizationId: string,
    clientId: string,
  ): Promise<ClientDetailDto | null>;
  exceptions(organizationId: string): Promise<ExceptionDto[]>;
  setExceptionStatus(
    organizationId: string,
    id: string,
    status: ExceptionStatus,
    actor: Actor,
  ): Promise<ExceptionDto | null>;
  mappings(organizationId: string): Promise<MappingsDto>;
  setExceptionFlag(
    organizationId: string,
    id: string,
    flagged: boolean,
    actor: Actor,
  ): Promise<ExceptionDto | null>;
  /** Null when the exception isn't in this workspace. */
  comments(organizationId: string, id: string): Promise<CommentDto[] | null>;
  addComment(
    organizationId: string,
    id: string,
    body: string,
    actor: NonNullable<Actor>,
  ): Promise<CommentDto | null>;
  /** Returns false when the client is not in the workspace. */
  setMapping(
    organizationId: string,
    customerKey: string,
    clientId: string,
    actor: Actor,
  ): Promise<boolean>;
  /** Null when the client isn't in the workspace. */
  setMarkup(
    organizationId: string,
    clientId: string,
    markupPct: number,
    actor: Actor,
  ): Promise<ClientSummaryDto | null>;
  /**
   * Client billing CSV → agreement lines for every unlocked client, then
   * re-runs the latest bill. Throws CsvRejectedError (with per-row errors)
   * and stores nothing when any row is bad.
   */
  importBilling(
    organizationId: string,
    fileName: string,
    csv: string,
    actor: Actor,
  ): Promise<BillingImportDto>;
  /** Replaces one client's billed lines. Null when the client isn't in the workspace. */
  setAgreementLines(
    organizationId: string,
    clientId: string,
    lines: AgreementLineInput[],
    actor: Actor,
  ): Promise<AgreementDto[] | null>;
  /** PSA SKU or name → distributor SKU ("" = not a distributor product); re-runs. */
  setSkuAlias(
    organizationId: string,
    alias: string,
    sku: string,
    actor: Actor,
  ): Promise<void>;
  /** Billing CSV client name → client; moves its waiting rows. False when the client isn't in the workspace. */
  mapBillingClient(
    organizationId: string,
    clientName: string,
    clientId: string,
    actor: Actor,
  ): Promise<boolean>;
  /** Throws CsvRejectedError when the file cannot be parsed. */
  uploadRun(
    organizationId: string,
    fileName: string,
    csv: string,
  ): Promise<RunDto>;
  loadDemo(organizationId: string): Promise<RunDto>;
  joinWaitlist(input: WaitlistInput): Promise<void>;
  createClient(
    organizationId: string,
    input: ClientInput,
  ): Promise<ClientSummaryDto>;
  /** Null when the client isn't in the workspace. */
  setArchived(
    organizationId: string,
    clientId: string,
    archived: boolean,
  ): Promise<ClientSummaryDto | null>;
  /** Non-archived clients (locked included), for plan-limit decisions. */
  limitClients(organizationId: string): Promise<LimitClient[]>;
  /** Locks and unlocks in one transaction, then re-runs the latest bill. */
  applyLocks(
    organizationId: string,
    lockIds: string[],
    keepIds: string[],
    at: Date,
  ): Promise<{ locked: string[]; unlocked: string[] }>;
};

type ExceptionRow = typeof reconciliationExceptions.$inferSelect;
type RunRow = typeof reconciliationRuns.$inferSelect;
type ClientRow = typeof clients.$inferSelect;

const leakageStatuses = new Set<ExceptionStatus>(["open", "approved"]);

function exceptionKey(row: {
  kind: string;
  customerKey: string;
  sku: string;
  clientId: string | null;
}) {
  return `${row.kind}|${row.customerKey}|${row.sku}|${row.clientId ?? ""}`;
}

function toRunDto(run: RunRow): RunDto {
  return {
    id: run.id,
    fileName: run.fileName,
    createdAt: run.createdAt.toISOString(),
    lineCount: run.vendorLines.length,
    customerCount: new Set(run.vendorLines.map((line) => line.customerKey))
      .size,
  };
}

const statusAction: Record<ExceptionStatus, AuditAction> = {
  open: "exception.reopen",
  approved: "exception.approve",
  billed: "exception.billed",
  dismissed: "exception.dismiss",
};

function toExceptionDto(
  row: ExceptionRow,
  clientNames: Map<string, string>,
  commentCounts: Map<string, number> = new Map(),
): ExceptionDto {
  return {
    id: row.id,
    kind: row.kind as ExceptionKind,
    clientId: row.clientId,
    clientName:
      (row.clientId && clientNames.get(row.clientId)) || row.customerName,
    customerKey: row.customerKey,
    sku: row.sku,
    productName: row.productName,
    vendorQuantity: row.vendorQuantity,
    billedQuantity: row.billedQuantity,
    unitCostCents: row.unitCostCents,
    expectedUnitPriceCents: row.expectedUnitPriceCents,
    billedUnitPriceCents: row.billedUnitPriceCents,
    monthlyImpactCents: row.monthlyImpactCents,
    summary: row.summary,
    status: row.status,
    flagged: row.flagged,
    commentCount: commentCounts.get(row.id) ?? 0,
  };
}

function toCommentDto(row: typeof exceptionComments.$inferSelect): CommentDto {
  return {
    id: row.id,
    authorEmail: row.authorEmail,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Headline leakage counts everything except overbilling, which is refund risk. */
function isLeakage(row: { kind: string }) {
  return row.kind !== "overbilled";
}

export function createReconService(db: Database): ReconService {
  async function latestRun(organizationId: string) {
    const [run] = await db
      .select()
      .from(reconciliationRuns)
      .where(eq(reconciliationRuns.organizationId, organizationId))
      .orderBy(desc(reconciliationRuns.createdAt), desc(reconciliationRuns.id))
      .limit(1);
    return run ?? null;
  }

  async function latestBillingImport(organizationId: string) {
    const [row] = await db
      .select()
      .from(billingImports)
      .where(eq(billingImports.organizationId, organizationId))
      .orderBy(desc(billingImports.createdAt), desc(billingImports.id))
      .limit(1);
    return row ?? null;
  }

  async function agreementsFor(organizationId: string, clientId: string) {
    const rows = await db
      .select()
      .from(agreementLines)
      .where(
        and(
          eq(agreementLines.organizationId, organizationId),
          eq(agreementLines.clientId, clientId),
        ),
      )
      .orderBy(asc(agreementLines.productName));
    return rows.map(({ sku, productName, quantity, unitPriceCents }) => ({
      sku,
      productName,
      quantity,
      unitPriceCents,
    }));
  }

  async function aliasMap(organizationId: string) {
    const rows = await db
      .select({ aliasKey: skuAliases.aliasKey, sku: skuAliases.sku })
      .from(skuAliases)
      .where(eq(skuAliases.organizationId, organizationId));
    return new Map(rows.map((row) => [row.aliasKey, row.sku]));
  }

  async function organizationClients(organizationId: string) {
    return db
      .select()
      .from(clients)
      .where(eq(clients.organizationId, organizationId))
      .orderBy(asc(clients.name));
  }

  async function runExceptions(organizationId: string, runId: string) {
    return db
      .select()
      .from(reconciliationExceptions)
      .where(
        and(
          eq(reconciliationExceptions.organizationId, organizationId),
          eq(reconciliationExceptions.runId, runId),
        ),
      )
      .orderBy(desc(reconciliationExceptions.monthlyImpactCents));
  }

  /**
   * Recompute exceptions for a run from current clients, mappings and
   * agreements. Statuses the user already set survive the recompute.
   */
  async function recompute(organizationId: string, run: RunRow) {
    const [clientRows, mappingRows, agreementRows, previous, aliases] =
      await Promise.all([
        organizationClients(organizationId),
        db
          .select()
          .from(customerMappings)
          .where(eq(customerMappings.organizationId, organizationId)),
        db
          .select()
          .from(agreementLines)
          .where(eq(agreementLines.organizationId, organizationId)),
        runExceptions(organizationId, run.id),
        aliasMap(organizationId),
      ]);

    // Locked and archived clients sit out reconciliation entirely: their bill
    // lines are skipped rather than reported as unmapped.
    const excluded = new Set(
      clientRows
        .filter((client) => client.lockedAt || client.archivedAt)
        .map((client) => client.id),
    );
    const excludedCustomers = new Set(
      mappingRows
        .filter((mapping) => excluded.has(mapping.clientId))
        .map((mapping) => mapping.customerKey),
    );
    const found = reconcile({
      vendorLines: run.vendorLines.filter(
        (line) => !excludedCustomers.has(line.customerKey),
      ),
      clients: clientRows
        .filter((client) => !excluded.has(client.id))
        .map((client) => ({
          id: client.id,
          name: client.name,
          status: client.status,
          markupPct: client.markupBps / 100,
        })),
      mappings: mappingRows.filter(
        (mapping) => !excluded.has(mapping.clientId),
      ),
      // PSA product IDs and names resolve to distributor SKUs first.
      agreements: applySkuAliases(
        agreementRows.filter((line) => !excluded.has(line.clientId)),
        aliases,
      ),
    });
    // Rows that are still found keep their id, so status, flag and comments
    // survive the recompute; rows no longer found are removed.
    const previousByKey = new Map<string, ExceptionRow[]>();
    for (const row of previous) {
      const key = exceptionKey(row);
      previousByKey.set(key, [...(previousByKey.get(key) ?? []), row]);
    }
    const updates: { id: string; values: (typeof found)[number] }[] = [];
    const inserts: (typeof found)[number][] = [];
    for (const exception of found) {
      const kept = previousByKey.get(exceptionKey(exception))?.shift();
      if (kept) updates.push({ id: kept.id, values: exception });
      else inserts.push(exception);
    }
    const stale = [...previousByKey.values()].flat().map((row) => row.id);

    await db.transaction(async (tx) => {
      if (stale.length)
        await tx
          .delete(reconciliationExceptions)
          .where(inArray(reconciliationExceptions.id, stale));
      // ponytail: one UPDATE per surviving row; batch it if runs reach thousands of exceptions.
      for (const update of updates)
        await tx
          .update(reconciliationExceptions)
          .set(update.values)
          .where(eq(reconciliationExceptions.id, update.id));
      if (inserts.length)
        await tx.insert(reconciliationExceptions).values(
          inserts.map((exception) => ({
            ...exception,
            organizationId,
            runId: run.id,
          })),
        );
    });
  }

  async function storeRun(
    organizationId: string,
    fileName: string,
    lines: VendorLine[],
  ) {
    const [run] = await db
      .insert(reconciliationRuns)
      .values({
        organizationId,
        source: "pax8-csv",
        fileName,
        vendorLines: lines satisfies StoredVendorLine[],
      })
      .returning();
    if (!run) throw new Error("Run insert returned no row");
    await recompute(organizationId, run);
    return toRunDto(run);
  }

  function summarize(
    clientRows: ClientRow[],
    exceptionRows: ExceptionRow[],
    run: RunRow | null,
    mappingRows: { customerKey: string; clientId: string }[],
  ): ClientSummaryDto[] {
    const seatsByCustomer = new Map<string, number>();
    for (const line of run?.vendorLines ?? []) {
      seatsByCustomer.set(
        line.customerKey,
        (seatsByCustomer.get(line.customerKey) ?? 0) + line.quantity,
      );
    }
    return clientRows.map((client) => {
      const own = exceptionRows.filter((row) => row.clientId === client.id);
      const open = own.filter((row) => leakageStatuses.has(row.status));
      return {
        id: client.id,
        name: client.name,
        psaId: client.psaId,
        status: client.status,
        markupPct: client.markupBps / 100,
        vendorSeats: mappingRows
          .filter((mapping) => mapping.clientId === client.id)
          .reduce(
            (sum, mapping) =>
              sum + (seatsByCustomer.get(mapping.customerKey) ?? 0),
            0,
          ),
        leakageCents: open
          .filter(isLeakage)
          .reduce((sum, row) => sum + row.monthlyImpactCents, 0),
        openCount: open.length,
        lockedAt: client.lockedAt?.toISOString() ?? null,
        archivedAt: client.archivedAt?.toISOString() ?? null,
        lastActiveAt: client.lastActiveAt.toISOString(),
      };
    });
  }

  async function writableClient(organizationId: string, clientId: string) {
    const [client] = await db
      .select()
      .from(clients)
      .where(
        and(
          eq(clients.organizationId, organizationId),
          eq(clients.id, clientId),
        ),
      )
      .limit(1);
    if (!client) return null;
    if (client.lockedAt) throw new ClientLockedError(client.name, "locked");
    if (client.archivedAt) throw new ClientLockedError(client.name, "archived");
    return client;
  }

  async function touch(clientId: string) {
    await db
      .update(clients)
      .set({ lastActiveAt: new Date() })
      .where(eq(clients.id, clientId));
  }

  async function refresh(organizationId: string) {
    const run = await latestRun(organizationId);
    if (run) await recompute(organizationId, run);
  }

  async function mappingRowsFor(organizationId: string) {
    return db
      .select({
        customerKey: customerMappings.customerKey,
        clientId: customerMappings.clientId,
      })
      .from(customerMappings)
      .where(
        and(
          eq(customerMappings.organizationId, organizationId),
          not(like(customerMappings.customerKey, `${billingKeyPrefix}%`)),
        ),
      );
  }

  async function exceptionInWorkspace(organizationId: string, id: string) {
    const [row] = await db
      .select({
        clientId: reconciliationExceptions.clientId,
        status: reconciliationExceptions.status,
        flagged: reconciliationExceptions.flagged,
      })
      .from(reconciliationExceptions)
      .where(
        and(
          eq(reconciliationExceptions.organizationId, organizationId),
          eq(reconciliationExceptions.id, id),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async function exceptionDto(organizationId: string, row: ExceptionRow) {
    const [clientRows, [comments]] = await Promise.all([
      organizationClients(organizationId),
      db
        .select({ total: count() })
        .from(exceptionComments)
        .where(eq(exceptionComments.exceptionId, row.id)),
    ]);
    return toExceptionDto(
      row,
      new Map(clientRows.map((client) => [client.id, client.name])),
      new Map([[row.id, comments?.total ?? 0]]),
    );
  }

  return {
    async overview(organizationId) {
      const run = await latestRun(organizationId);
      const [clientRows, exceptionRows, mappingRows, billing] =
        await Promise.all([
          organizationClients(organizationId),
          run ? runExceptions(organizationId, run.id) : Promise.resolve([]),
          mappingRowsFor(organizationId),
          latestBillingImport(organizationId),
        ]);
      const byKind = Object.fromEntries(
        exceptionKinds.map((kind) => [kind, { count: 0, cents: 0 }]),
      ) as OverviewDto["byKind"];
      for (const row of exceptionRows) {
        const bucket = byKind[row.kind as ExceptionKind];
        if (!bucket) continue;
        bucket.count += 1;
        bucket.cents += row.monthlyImpactCents;
      }
      return {
        run: run ? toRunDto(run) : null,
        billingImport: billing && {
          fileName: billing.fileName,
          createdAt: billing.createdAt.toISOString(),
          lineCount: billing.lineCount,
          unmappedCount: billing.unmappedLines.length,
        },
        // Dismissed = false positive; everything else was real leakage this month.
        leakageCents: exceptionRows
          .filter((row) => isLeakage(row) && row.status !== "dismissed")
          .reduce((sum, row) => sum + row.monthlyImpactCents, 0),
        recoveredCents: exceptionRows
          .filter((row) => row.status === "billed" && isLeakage(row))
          .reduce((sum, row) => sum + row.monthlyImpactCents, 0),
        overbilledCents: byKind.overbilled.cents,
        openCount: exceptionRows.filter((row) => row.status === "open").length,
        byKind,
        clients: summarize(clientRows, exceptionRows, run, mappingRows),
      };
    },

    async client(organizationId, clientId) {
      const [row] = await db
        .select()
        .from(clients)
        .where(
          and(
            eq(clients.organizationId, organizationId),
            eq(clients.id, clientId),
          ),
        )
        .limit(1);
      if (!row) return null;
      const run = await latestRun(organizationId);
      const [exceptionRows, agreements, mappingRows] = await Promise.all([
        run ? runExceptions(organizationId, run.id) : Promise.resolve([]),
        agreementsFor(organizationId, clientId),
        mappingRowsFor(organizationId),
      ]);
      const own = exceptionRows.filter((entry) => entry.clientId === clientId);
      const [summary] = summarize([row], own, run, mappingRows);
      if (!summary) return null;
      const names = new Map([[row.id, row.name]]);
      return {
        client: summary,
        customerKeys: mappingRows
          .filter((mapping) => mapping.clientId === clientId)
          .map((mapping) => mapping.customerKey),
        agreements,
        exceptions: own.map((entry) => toExceptionDto(entry, names)),
      };
    },

    async exceptions(organizationId) {
      const run = await latestRun(organizationId);
      if (!run) return [];
      const [rows, clientRows, counts] = await Promise.all([
        runExceptions(organizationId, run.id),
        organizationClients(organizationId),
        db
          .select({ id: exceptionComments.exceptionId, total: count() })
          .from(exceptionComments)
          .where(eq(exceptionComments.organizationId, organizationId))
          .groupBy(exceptionComments.exceptionId),
      ]);
      const names = new Map(
        clientRows.map((client) => [client.id, client.name]),
      );
      const commentCounts = new Map(counts.map((row) => [row.id, row.total]));
      return rows.map((row) => toExceptionDto(row, names, commentCounts));
    },

    async setExceptionStatus(organizationId, id, status, actor) {
      const existing = await exceptionInWorkspace(organizationId, id);
      if (!existing) return null;
      if (existing.clientId) {
        await writableClient(organizationId, existing.clientId);
        await touch(existing.clientId);
      }
      const row = await db.transaction(async (tx) => {
        const [updated] = await tx
          .update(reconciliationExceptions)
          .set({ status, resolvedAt: status === "open" ? null : new Date() })
          .where(
            and(
              eq(reconciliationExceptions.organizationId, organizationId),
              eq(reconciliationExceptions.id, id),
            ),
          )
          .returning();
        if (!updated) return null;
        await recordAudit(tx, {
          organizationId,
          actor,
          action: statusAction[status],
          targetType: "exception",
          targetId: id,
          before: { status: existing.status },
          after: { status },
        });
        return updated;
      });
      return row ? exceptionDto(organizationId, row) : null;
    },

    async setExceptionFlag(organizationId, id, flagged, actor) {
      const existing = await exceptionInWorkspace(organizationId, id);
      if (!existing) return null;
      if (existing.clientId)
        await writableClient(organizationId, existing.clientId);
      const row = await db.transaction(async (tx) => {
        const [updated] = await tx
          .update(reconciliationExceptions)
          .set({ flagged })
          .where(eq(reconciliationExceptions.id, id))
          .returning();
        if (updated && existing.flagged !== flagged)
          await recordAudit(tx, {
            organizationId,
            actor,
            action: flagged ? "exception.flag" : "exception.unflag",
            targetType: "exception",
            targetId: id,
            before: { flagged: existing.flagged },
            after: { flagged },
          });
        return updated ?? null;
      });
      return row ? exceptionDto(organizationId, row) : null;
    },

    async comments(organizationId, id) {
      if (!(await exceptionInWorkspace(organizationId, id))) return null;
      const rows = await db
        .select()
        .from(exceptionComments)
        .where(
          and(
            eq(exceptionComments.organizationId, organizationId),
            eq(exceptionComments.exceptionId, id),
          ),
        )
        .orderBy(asc(exceptionComments.createdAt));
      return rows.map(toCommentDto);
    },

    async addComment(organizationId, id, body, actor) {
      const existing = await exceptionInWorkspace(organizationId, id);
      if (!existing) return null;
      if (existing.clientId)
        await writableClient(organizationId, existing.clientId);
      return db.transaction(async (tx) => {
        const [row] = await tx
          .insert(exceptionComments)
          .values({
            organizationId,
            exceptionId: id,
            authorUserId: actor.userId,
            authorEmail: actor.email,
            body,
          })
          .returning();
        if (!row) throw new Error("Comment insert returned no row");
        await recordAudit(tx, {
          organizationId,
          actor,
          action: "exception.comment",
          targetType: "exception",
          targetId: id,
          after: { commentId: row.id, body },
        });
        return toCommentDto(row);
      });
    },

    async mappings(organizationId) {
      const [run, clientRows, mappingRows, billing, aliasRows, billedRows] =
        await Promise.all([
          latestRun(organizationId),
          organizationClients(organizationId),
          mappingRowsFor(organizationId),
          latestBillingImport(organizationId),
          db
            .select()
            .from(skuAliases)
            .where(eq(skuAliases.organizationId, organizationId))
            .orderBy(asc(skuAliases.label)),
          db
            .select()
            .from(agreementLines)
            .where(eq(agreementLines.organizationId, organizationId)),
        ]);
      const vendorSkus = new Map<string, string>();
      for (const line of run?.vendorLines ?? [])
        vendorSkus.set(line.sku, line.productName);
      const aliasByKey = new Map(aliasRows.map((row) => [row.aliasKey, row]));
      const billedSkus = new Map<
        string,
        BilledSkuDto & { clients: Set<string> }
      >();
      for (const row of aliasRows)
        billedSkus.set(row.aliasKey, {
          sku: row.label,
          productName: row.label,
          clientCount: 0,
          quantity: 0,
          aliasSku: row.sku,
          clients: new Set(),
        });
      // Billed SKUs that aren't on the bill and have no alias need one.
      for (const line of run ? billedRows : []) {
        const key = skuAliasKey(line.sku);
        const alias =
          aliasByKey.get(key) ?? aliasByKey.get(skuAliasKey(line.productName));
        if (!alias && vendorSkus.has(line.sku)) continue;
        const entryKey = alias?.aliasKey ?? key;
        const entry = billedSkus.get(entryKey) ?? {
          sku: line.sku,
          productName: line.productName,
          clientCount: 0,
          quantity: 0,
          aliasSku: null,
          clients: new Set<string>(),
        };
        entry.clients.add(line.clientId);
        entry.clientCount = entry.clients.size;
        entry.quantity += line.quantity;
        billedSkus.set(entryKey, entry);
      }
      const unmappedBilling = new Map<string, UnmappedBillingClientDto>();
      for (const line of billing?.unmappedLines ?? []) {
        const key = normalizeClientName(line.clientName);
        const entry = unmappedBilling.get(key) ?? {
          clientName: line.clientName,
          lineCount: 0,
          seats: 0,
          monthlyBilledCents: 0,
        };
        entry.lineCount += 1;
        entry.seats += line.quantity;
        entry.monthlyBilledCents += line.quantity * line.unitPriceCents;
        unmappedBilling.set(key, entry);
      }
      const names = new Map(
        clientRows.map((client) => [client.id, client.name]),
      );
      const mapped = new Set(mappingRows.map((mapping) => mapping.customerKey));
      const unmapped = new Map<string, UnmappedCustomerDto>();
      for (const line of run?.vendorLines ?? []) {
        if (mapped.has(line.customerKey)) continue;
        const entry = unmapped.get(line.customerKey) ?? {
          customerKey: line.customerKey,
          customerName: line.customerName,
          seats: 0,
          monthlyCostCents: 0,
        };
        entry.seats += line.quantity;
        entry.monthlyCostCents += line.quantity * line.unitCostCents;
        unmapped.set(line.customerKey, entry);
      }
      return {
        mappings: mappingRows
          .map((mapping) => ({
            ...mapping,
            clientName: names.get(mapping.clientId) ?? "Unknown client",
          }))
          .sort((a, b) => a.clientName.localeCompare(b.clientName)),
        unmapped: [...unmapped.values()],
        unmappedBilling: [...unmappedBilling.values()],
        billedSkus: [...billedSkus.values()]
          .map(({ clients: _, ...entry }) => entry)
          // Unaliased first: they're the ones to act on.
          .sort(
            (a, b) => Number(a.aliasSku !== null) - Number(b.aliasSku !== null),
          ),
        vendorSkus: [...vendorSkus].map(([sku, productName]) => ({
          sku,
          productName,
        })),
        clients: clientRows.map(({ id, name }) => ({ id, name })),
      };
    },

    async setMapping(organizationId, customerKey, clientId, actor) {
      const client = await writableClient(organizationId, clientId);
      if (!client) return false;
      await touch(client.id);
      await db.transaction(async (tx) => {
        const [before] = await tx
          .select({ clientId: customerMappings.clientId })
          .from(customerMappings)
          .where(
            and(
              eq(customerMappings.organizationId, organizationId),
              eq(customerMappings.customerKey, customerKey),
            ),
          )
          .limit(1);
        await tx
          .insert(customerMappings)
          .values({ organizationId, customerKey, clientId })
          .onConflictDoUpdate({
            target: [
              customerMappings.organizationId,
              customerMappings.customerKey,
            ],
            set: { clientId },
          });
        await recordAudit(tx, {
          organizationId,
          actor,
          action: "mapping.change",
          targetType: "customer",
          targetId: customerKey,
          before: before ? { clientId: before.clientId } : null,
          after: { clientId, clientName: client.name },
        });
      });
      await refresh(organizationId);
      return true;
    },

    async setMarkup(organizationId, clientId, markupPct, actor) {
      const client = await writableClient(organizationId, clientId);
      if (!client) return null;
      const markupBps = Math.round(markupPct * 100);
      const row = await db.transaction(async (tx) => {
        const [updated] = await tx
          .update(clients)
          .set({ markupBps, lastActiveAt: new Date() })
          .where(
            and(
              eq(clients.organizationId, organizationId),
              eq(clients.id, clientId),
            ),
          )
          .returning();
        await recordAudit(tx, {
          organizationId,
          actor,
          action: "client.markup",
          targetType: "client",
          targetId: clientId,
          before: { markupPct: client.markupBps / 100 },
          after: { markupPct: markupBps / 100 },
        });
        return updated ?? null;
      });
      if (!row) return null;
      await refresh(organizationId);
      const [summary] = summarize([row], [], null, []);
      return summary ?? null;
    },

    async importBilling(organizationId, fileName, csv, actor) {
      let parsed: ReturnType<typeof parseBillingCsv>;
      try {
        parsed = parseBillingCsv(csv);
      } catch (error) {
        throw new CsvRejectedError(
          error instanceof CsvFormatError
            ? error.message
            : "File could not be read.",
        );
      }
      if (parsed.errors.length > 0) {
        const shown = parsed.errors
          .slice(0, 5)
          .map((row) => `Row ${row.rowNumber}: ${row.message}`)
          .join(" ");
        throw new CsvRejectedError(
          `${parsed.errors.length} row${parsed.errors.length === 1 ? "" : "s"} could not be read, so nothing was imported. ${shown}`,
          parsed.errors,
        );
      }
      if (parsed.lines.length === 0)
        throw new CsvRejectedError("The file has a header but no rows.");

      const [clientRows, aliasRows, run] = await Promise.all([
        organizationClients(organizationId),
        db
          .select()
          .from(customerMappings)
          .where(eq(customerMappings.organizationId, organizationId)),
        latestRun(organizationId),
      ]);
      // Resolution order: a saved mapping for this billing name, PSA ID,
      // client name, then the name of a mapped distributor customer.
      const byName = new Map<string, string>();
      for (const line of run?.vendorLines ?? []) {
        const mapping = aliasRows.find(
          (row) => row.customerKey === line.customerKey,
        );
        if (mapping)
          byName.set(normalizeClientName(line.customerName), mapping.clientId);
      }
      for (const client of clientRows)
        byName.set(normalizeClientName(client.name), client.id);
      for (const client of clientRows)
        if (client.psaId)
          byName.set(normalizeClientName(client.psaId), client.id);
      const aliases = new Map(
        aliasRows
          .filter((row) => isBillingKey(row.customerKey))
          .map((row) => [row.customerKey, row.clientId]),
      );
      const resolve = (name: string) =>
        aliases.get(billingKey(name)) ?? byName.get(normalizeClientName(name));

      const { agreements, unmatched } = billedLinesToAgreements(
        parsed.lines,
        resolve,
      );
      // Locked and archived clients are read-only: their rows are left out
      // and their existing lines stay as they were.
      const frozen = new Map(
        clientRows
          .filter((client) => client.lockedAt || client.archivedAt)
          .map((client) => [client.id, client.name]),
      );
      const writable = agreements.filter((line) => !frozen.has(line.clientId));
      const skippedClients = [
        ...new Set(
          agreements
            .map((line) => frozen.get(line.clientId))
            .filter((name): name is string => Boolean(name)),
        ),
      ];
      const writableIds = clientRows
        .filter((client) => !frozen.has(client.id))
        .map((client) => client.id);
      const unmapped = new Map<
        string,
        { clientName: string; lineCount: number }
      >();
      for (const line of unmatched) {
        const key = normalizeClientName(line.clientName);
        const entry = unmapped.get(key) ?? {
          clientName: line.clientName,
          lineCount: 0,
        };
        entry.lineCount += 1;
        unmapped.set(key, entry);
      }
      const result: BillingImportDto = {
        fileName,
        lineCount: parsed.lines.length,
        agreementCount: writable.length,
        matchedClients: new Set(writable.map((line) => line.clientId)).size,
        unmapped: [...unmapped.values()],
        skippedClients,
      };

      await db.transaction(async (tx) => {
        // The file is the billed side for every unlocked client: a client
        // missing from it is billed nothing.
        if (writableIds.length)
          await tx
            .delete(agreementLines)
            .where(
              and(
                eq(agreementLines.organizationId, organizationId),
                inArray(agreementLines.clientId, writableIds),
              ),
            );
        if (writable.length)
          await tx
            .insert(agreementLines)
            .values(writable.map((line) => ({ ...line, organizationId })));
        await tx
          .delete(billingImports)
          .where(eq(billingImports.organizationId, organizationId));
        await tx.insert(billingImports).values({
          organizationId,
          fileName,
          lineCount: parsed.lines.length,
          unmappedLines: unmatched satisfies StoredBilledLine[],
        });
        await recordAudit(tx, {
          organizationId,
          actor,
          action: "billing.import",
          targetType: "billing_import",
          targetId: fileName,
          after: {
            lineCount: result.lineCount,
            agreementCount: result.agreementCount,
            matchedClients: result.matchedClients,
            unmappedClients: result.unmapped.map((entry) => entry.clientName),
            skippedClients,
          },
        });
      });
      await refresh(organizationId);
      return result;
    },

    async setAgreementLines(organizationId, clientId, lines, actor) {
      const client = await writableClient(organizationId, clientId);
      if (!client) return null;
      const before = await agreementsFor(organizationId, clientId);
      await db.transaction(async (tx) => {
        await tx
          .delete(agreementLines)
          .where(
            and(
              eq(agreementLines.organizationId, organizationId),
              eq(agreementLines.clientId, clientId),
            ),
          );
        if (lines.length)
          await tx.insert(agreementLines).values(
            lines.map((line) => ({
              organizationId,
              clientId,
              sku: line.sku.trim(),
              productName: line.productName?.trim() || line.sku.trim(),
              quantity: line.quantity,
              unitPriceCents: line.unitPriceCents,
            })),
          );
        await recordAudit(tx, {
          organizationId,
          actor,
          action: "billing.lines_edit",
          targetType: "client",
          targetId: clientId,
          before: { lines: before },
          after: { lines },
        });
      });
      await touch(clientId);
      await refresh(organizationId);
      return agreementsFor(organizationId, clientId);
    },

    async setSkuAlias(organizationId, alias, sku, actor) {
      const aliasKey = skuAliasKey(alias);
      await db.transaction(async (tx) => {
        const [before] = await tx
          .select({ sku: skuAliases.sku })
          .from(skuAliases)
          .where(
            and(
              eq(skuAliases.organizationId, organizationId),
              eq(skuAliases.aliasKey, aliasKey),
            ),
          )
          .limit(1);
        await tx
          .insert(skuAliases)
          .values({ organizationId, aliasKey, label: alias, sku })
          .onConflictDoUpdate({
            target: [skuAliases.organizationId, skuAliases.aliasKey],
            set: { sku, label: alias },
          });
        await recordAudit(tx, {
          organizationId,
          actor,
          action: "mapping.change",
          targetType: "sku",
          targetId: alias,
          before: before ? { sku: before.sku } : null,
          after: { sku },
        });
      });
      await refresh(organizationId);
    },

    async mapBillingClient(organizationId, clientName, clientId, actor) {
      const client = await writableClient(organizationId, clientId);
      if (!client) return false;
      const billing = await latestBillingImport(organizationId);
      const name = normalizeClientName(clientName);
      const moving = (billing?.unmappedLines ?? []).filter(
        (line) => normalizeClientName(line.clientName) === name,
      );
      const { agreements } = billedLinesToAgreements(moving, () => clientId);
      await db.transaction(async (tx) => {
        await tx
          .insert(customerMappings)
          .values({
            organizationId,
            customerKey: billingKey(clientName),
            clientId,
          })
          .onConflictDoUpdate({
            target: [
              customerMappings.organizationId,
              customerMappings.customerKey,
            ],
            set: { clientId },
          });
        for (const line of agreements)
          await tx
            .insert(agreementLines)
            .values({ ...line, organizationId })
            .onConflictDoUpdate({
              target: [agreementLines.clientId, agreementLines.sku],
              set: {
                productName: line.productName,
                quantity: line.quantity,
                unitPriceCents: line.unitPriceCents,
              },
            });
        if (billing && moving.length)
          await tx
            .update(billingImports)
            .set({
              unmappedLines: billing.unmappedLines.filter(
                (line) => normalizeClientName(line.clientName) !== name,
              ),
            })
            .where(eq(billingImports.id, billing.id));
        await recordAudit(tx, {
          organizationId,
          actor,
          action: "mapping.change",
          targetType: "billing_client",
          targetId: clientName,
          after: {
            clientId,
            clientName: client.name,
            linesMoved: moving.length,
          },
        });
      });
      await touch(clientId);
      await refresh(organizationId);
      return true;
    },

    async uploadRun(organizationId, fileName, csv) {
      let lines: VendorLine[];
      try {
        lines = parsePax8Csv(csv);
      } catch (error) {
        throw new CsvRejectedError(
          error instanceof Error ? error.message : "File could not be read.",
        );
      }
      if (lines.length === 0) {
        throw new CsvRejectedError("The file has a header but no rows.");
      }
      return storeRun(organizationId, fileName, lines);
    },

    async loadDemo(organizationId) {
      // ponytail: demo wipes the workspace's data; owner-only while the product is demo-only.
      await db.transaction(async (tx) => {
        await tx
          .delete(reconciliationRuns)
          .where(eq(reconciliationRuns.organizationId, organizationId));
        await tx
          .delete(clients)
          .where(eq(clients.organizationId, organizationId));
        await tx
          .delete(billingImports)
          .where(eq(billingImports.organizationId, organizationId));
        const inserted = await tx
          .insert(clients)
          .values(
            demoClients.map((demo) => ({
              organizationId,
              name: demo.name,
              psaId: demo.psaId,
              status: demo.status,
              markupBps: Math.round(demo.markupPct * 100),
            })),
          )
          .returning({ id: clients.id, psaId: clients.psaId });
        const idByRef = new Map(
          demoClients.map((demo) => [
            demo.ref,
            inserted.find((row) => row.psaId === demo.psaId)?.id ?? "",
          ]),
        );
        await tx.insert(customerMappings).values(
          demoClients.map((demo) => ({
            organizationId,
            customerKey: demo.pax8CompanyId,
            clientId: idByRef.get(demo.ref) ?? "",
          })),
        );
        await tx.insert(agreementLines).values(
          demoAgreements.map(({ clientRef, ...line }) => ({
            ...line,
            organizationId,
            clientId: idByRef.get(clientRef) ?? "",
          })),
        );
      });
      return storeRun(
        organizationId,
        "pax8-billing-2026-11.csv",
        parsePax8Csv(demoPax8Csv),
      );
    },

    async createClient(organizationId, input) {
      const [row] = await db
        .insert(clients)
        .values({
          organizationId,
          name: input.name.trim(),
          psaId: input.psaId?.trim() || null,
          markupBps: Math.round(input.markupPct * 100),
        })
        .returning();
      if (!row) throw new Error("Client insert returned no row");
      const [summary] = summarize([row], [], null, []);
      if (!summary) throw new Error("Client summary missing");
      return summary;
    },

    async setArchived(organizationId, clientId, archived) {
      const [row] = await db
        .update(clients)
        .set({
          archivedAt: archived ? new Date() : null,
          ...(archived ? {} : { lastActiveAt: new Date() }),
        })
        .where(
          and(
            eq(clients.organizationId, organizationId),
            eq(clients.id, clientId),
          ),
        )
        .returning();
      if (!row) return null;
      await refresh(organizationId);
      const [summary] = summarize([row], [], null, []);
      return summary ?? null;
    },

    async limitClients(organizationId) {
      const rows = await organizationClients(organizationId);
      return rows
        .filter((row) => !row.archivedAt)
        .map(({ id, name, lastActiveAt, lockedAt }) => ({
          id,
          name,
          lastActiveAt,
          lockedAt,
        }));
    },

    async applyLocks(organizationId, lockIds, keepIds, at) {
      const result = await db.transaction(async (tx) => {
        const locked = lockIds.length
          ? await tx
              .update(clients)
              .set({ lockedAt: at })
              .where(
                and(
                  eq(clients.organizationId, organizationId),
                  inArray(clients.id, lockIds),
                  isNull(clients.lockedAt),
                ),
              )
              .returning({ id: clients.id })
          : [];
        const unlocked = keepIds.length
          ? await tx
              .update(clients)
              .set({ lockedAt: null })
              .where(
                and(
                  eq(clients.organizationId, organizationId),
                  inArray(clients.id, keepIds),
                  isNotNull(clients.lockedAt),
                ),
              )
              .returning({ id: clients.id })
          : [];
        return {
          locked: locked.map((row) => row.id),
          unlocked: unlocked.map((row) => row.id),
        };
      });
      if (result.locked.length || result.unlocked.length)
        await refresh(organizationId);
      return result;
    },

    async joinWaitlist(input) {
      await db
        .insert(waitlistEntries)
        .values({
          email: input.email.trim().toLowerCase(),
          company: input.company?.trim() || null,
          seats: input.seats ?? null,
        })
        .onConflictDoNothing();
    },
  };
}
