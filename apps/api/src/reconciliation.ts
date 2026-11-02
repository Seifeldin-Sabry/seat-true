import {
  agreementLines,
  clients,
  customerMappings,
  type Database,
  type ExceptionStatus,
  reconciliationExceptions,
  reconciliationRuns,
  type StoredVendorLine,
  waitlistEntries,
} from "@seattrue/db";
import {
  demoAgreements,
  demoClients,
  demoPax8Csv,
  type ExceptionKind,
  exceptionKinds,
  parsePax8Csv,
  reconcile,
  type VendorLine,
} from "@seattrue/recon";
import { and, asc, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";

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
};

export type RunDto = {
  id: string;
  fileName: string;
  createdAt: string;
  lineCount: number;
  customerCount: number;
};

export type OverviewDto = {
  run: RunDto | null;
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

export type MappingsDto = {
  mappings: { customerKey: string; clientId: string; clientName: string }[];
  unmapped: UnmappedCustomerDto[];
  clients: { id: string; name: string }[];
};

export type WaitlistInput = {
  email: string;
  company?: string;
  seats?: number;
};

export class CsvRejectedError extends Error {}

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
  overview(ownerId: string): Promise<OverviewDto>;
  client(ownerId: string, clientId: string): Promise<ClientDetailDto | null>;
  exceptions(ownerId: string): Promise<ExceptionDto[]>;
  setExceptionStatus(
    ownerId: string,
    id: string,
    status: ExceptionStatus,
  ): Promise<ExceptionDto | null>;
  mappings(ownerId: string): Promise<MappingsDto>;
  /** Returns false when the client does not belong to the owner. */
  setMapping(
    ownerId: string,
    customerKey: string,
    clientId: string,
  ): Promise<boolean>;
  /** Throws CsvRejectedError when the file cannot be parsed. */
  uploadRun(ownerId: string, fileName: string, csv: string): Promise<RunDto>;
  loadDemo(ownerId: string): Promise<RunDto>;
  joinWaitlist(input: WaitlistInput): Promise<void>;
  createClient(ownerId: string, input: ClientInput): Promise<ClientSummaryDto>;
  /** Null when the client doesn't belong to the owner. */
  setArchived(
    ownerId: string,
    clientId: string,
    archived: boolean,
  ): Promise<ClientSummaryDto | null>;
  /** Non-archived clients (locked included), for plan-limit decisions. */
  limitClients(ownerId: string): Promise<LimitClient[]>;
  /** Locks and unlocks in one transaction, then re-runs the latest bill. */
  applyLocks(
    ownerId: string,
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

function toExceptionDto(
  row: ExceptionRow,
  clientNames: Map<string, string>,
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
  };
}

/** Headline leakage counts everything except overbilling, which is refund risk. */
function isLeakage(row: { kind: string }) {
  return row.kind !== "overbilled";
}

export function createReconService(db: Database): ReconService {
  async function latestRun(ownerId: string) {
    const [run] = await db
      .select()
      .from(reconciliationRuns)
      .where(eq(reconciliationRuns.ownerId, ownerId))
      .orderBy(desc(reconciliationRuns.createdAt), desc(reconciliationRuns.id))
      .limit(1);
    return run ?? null;
  }

  async function ownerClients(ownerId: string) {
    return db
      .select()
      .from(clients)
      .where(eq(clients.ownerId, ownerId))
      .orderBy(asc(clients.name));
  }

  async function runExceptions(ownerId: string, runId: string) {
    return db
      .select()
      .from(reconciliationExceptions)
      .where(
        and(
          eq(reconciliationExceptions.ownerId, ownerId),
          eq(reconciliationExceptions.runId, runId),
        ),
      )
      .orderBy(desc(reconciliationExceptions.monthlyImpactCents));
  }

  /**
   * Recompute exceptions for a run from current clients, mappings and
   * agreements. Statuses the user already set survive the recompute.
   */
  async function recompute(ownerId: string, run: RunRow) {
    const [clientRows, mappingRows, agreementRows, previous] =
      await Promise.all([
        ownerClients(ownerId),
        db
          .select()
          .from(customerMappings)
          .where(eq(customerMappings.ownerId, ownerId)),
        db
          .select()
          .from(agreementLines)
          .where(eq(agreementLines.ownerId, ownerId)),
        runExceptions(ownerId, run.id),
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
      agreements: agreementRows.filter((line) => !excluded.has(line.clientId)),
    });
    const previousStatus = new Map(
      previous.map((row) => [exceptionKey(row), row]),
    );

    await db.transaction(async (tx) => {
      await tx
        .delete(reconciliationExceptions)
        .where(
          and(
            eq(reconciliationExceptions.ownerId, ownerId),
            eq(reconciliationExceptions.runId, run.id),
          ),
        );
      if (found.length === 0) return;
      await tx.insert(reconciliationExceptions).values(
        found.map((exception) => {
          const kept = previousStatus.get(exceptionKey(exception));
          return {
            ...exception,
            ownerId,
            runId: run.id,
            status: kept?.status ?? ("open" as const),
            resolvedAt: kept?.resolvedAt ?? null,
          };
        }),
      );
    });
  }

  async function storeRun(
    ownerId: string,
    fileName: string,
    lines: VendorLine[],
  ) {
    const [run] = await db
      .insert(reconciliationRuns)
      .values({
        ownerId,
        source: "pax8-csv",
        fileName,
        vendorLines: lines satisfies StoredVendorLine[],
      })
      .returning();
    if (!run) throw new Error("Run insert returned no row");
    await recompute(ownerId, run);
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

  async function writableClient(ownerId: string, clientId: string) {
    const [client] = await db
      .select()
      .from(clients)
      .where(and(eq(clients.ownerId, ownerId), eq(clients.id, clientId)))
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

  async function refresh(ownerId: string) {
    const run = await latestRun(ownerId);
    if (run) await recompute(ownerId, run);
  }

  async function mappingRowsFor(ownerId: string) {
    return db
      .select({
        customerKey: customerMappings.customerKey,
        clientId: customerMappings.clientId,
      })
      .from(customerMappings)
      .where(eq(customerMappings.ownerId, ownerId));
  }

  return {
    async overview(ownerId) {
      const run = await latestRun(ownerId);
      const [clientRows, exceptionRows, mappingRows] = await Promise.all([
        ownerClients(ownerId),
        run ? runExceptions(ownerId, run.id) : Promise.resolve([]),
        mappingRowsFor(ownerId),
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

    async client(ownerId, clientId) {
      const [row] = await db
        .select()
        .from(clients)
        .where(and(eq(clients.ownerId, ownerId), eq(clients.id, clientId)))
        .limit(1);
      if (!row) return null;
      const run = await latestRun(ownerId);
      const [exceptionRows, agreements, mappingRows] = await Promise.all([
        run ? runExceptions(ownerId, run.id) : Promise.resolve([]),
        db
          .select()
          .from(agreementLines)
          .where(
            and(
              eq(agreementLines.ownerId, ownerId),
              eq(agreementLines.clientId, clientId),
            ),
          )
          .orderBy(asc(agreementLines.productName)),
        mappingRowsFor(ownerId),
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
        agreements: agreements.map(
          ({ sku, productName, quantity, unitPriceCents }) => ({
            sku,
            productName,
            quantity,
            unitPriceCents,
          }),
        ),
        exceptions: own.map((entry) => toExceptionDto(entry, names)),
      };
    },

    async exceptions(ownerId) {
      const run = await latestRun(ownerId);
      if (!run) return [];
      const [rows, clientRows] = await Promise.all([
        runExceptions(ownerId, run.id),
        ownerClients(ownerId),
      ]);
      const names = new Map(
        clientRows.map((client) => [client.id, client.name]),
      );
      return rows.map((row) => toExceptionDto(row, names));
    },

    async setExceptionStatus(ownerId, id, status) {
      const [existing] = await db
        .select({ clientId: reconciliationExceptions.clientId })
        .from(reconciliationExceptions)
        .where(
          and(
            eq(reconciliationExceptions.ownerId, ownerId),
            eq(reconciliationExceptions.id, id),
          ),
        )
        .limit(1);
      if (!existing) return null;
      if (existing.clientId) {
        await writableClient(ownerId, existing.clientId);
        await touch(existing.clientId);
      }
      const [row] = await db
        .update(reconciliationExceptions)
        .set({ status, resolvedAt: status === "open" ? null : new Date() })
        .where(
          and(
            eq(reconciliationExceptions.ownerId, ownerId),
            eq(reconciliationExceptions.id, id),
          ),
        )
        .returning();
      if (!row) return null;
      const clientRows = await ownerClients(ownerId);
      return toExceptionDto(
        row,
        new Map(clientRows.map((client) => [client.id, client.name])),
      );
    },

    async mappings(ownerId) {
      const [run, clientRows, mappingRows] = await Promise.all([
        latestRun(ownerId),
        ownerClients(ownerId),
        mappingRowsFor(ownerId),
      ]);
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
        clients: clientRows.map(({ id, name }) => ({ id, name })),
      };
    },

    async setMapping(ownerId, customerKey, clientId) {
      const client = await writableClient(ownerId, clientId);
      if (!client) return false;
      await touch(client.id);
      await db
        .insert(customerMappings)
        .values({ ownerId, customerKey, clientId })
        .onConflictDoUpdate({
          target: [customerMappings.ownerId, customerMappings.customerKey],
          set: { clientId },
        });
      await refresh(ownerId);
      return true;
    },

    async uploadRun(ownerId, fileName, csv) {
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
      return storeRun(ownerId, fileName, lines);
    },

    async loadDemo(ownerId) {
      // ponytail: demo wipes the owner's data; fine while the product is demo-only.
      await db.transaction(async (tx) => {
        await tx
          .delete(reconciliationRuns)
          .where(eq(reconciliationRuns.ownerId, ownerId));
        await tx.delete(clients).where(eq(clients.ownerId, ownerId));
        const inserted = await tx
          .insert(clients)
          .values(
            demoClients.map((demo) => ({
              ownerId,
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
            ownerId,
            customerKey: demo.pax8CompanyId,
            clientId: idByRef.get(demo.ref) ?? "",
          })),
        );
        await tx.insert(agreementLines).values(
          demoAgreements.map(({ clientRef, ...line }) => ({
            ...line,
            ownerId,
            clientId: idByRef.get(clientRef) ?? "",
          })),
        );
      });
      return storeRun(
        ownerId,
        "pax8-billing-2026-11.csv",
        parsePax8Csv(demoPax8Csv),
      );
    },

    async createClient(ownerId, input) {
      const [row] = await db
        .insert(clients)
        .values({
          ownerId,
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

    async setArchived(ownerId, clientId, archived) {
      const [row] = await db
        .update(clients)
        .set({
          archivedAt: archived ? new Date() : null,
          ...(archived ? {} : { lastActiveAt: new Date() }),
        })
        .where(and(eq(clients.ownerId, ownerId), eq(clients.id, clientId)))
        .returning();
      if (!row) return null;
      await refresh(ownerId);
      const [summary] = summarize([row], [], null, []);
      return summary ?? null;
    },

    async limitClients(ownerId) {
      const rows = await ownerClients(ownerId);
      return rows
        .filter((row) => !row.archivedAt)
        .map(({ id, name, lastActiveAt, lockedAt }) => ({
          id,
          name,
          lastActiveAt,
          lockedAt,
        }));
    },

    async applyLocks(ownerId, lockIds, keepIds, at) {
      const result = await db.transaction(async (tx) => {
        const locked = lockIds.length
          ? await tx
              .update(clients)
              .set({ lockedAt: at })
              .where(
                and(
                  eq(clients.ownerId, ownerId),
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
                  eq(clients.ownerId, ownerId),
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
        await refresh(ownerId);
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
