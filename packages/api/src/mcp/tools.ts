import { exceptionKinds } from "@seattrue/recon";
import * as z from "zod";
import type { AuditLog } from "../audit";
import type { ReconService } from "../reconciliation";
import type { Workspace } from "../workspace";

const uuid = z.string().uuid();
const exceptionStatus = z.enum(["open", "approved", "billed", "dismissed"]);

/**
 * Read-only MCP tools. Each one runs as the signed-in member against their
 * active workspace, the same data the app shows them, and every call, allowed
 * or refused, is written to the audit log.
 */
export const mcpTools = {
  get_leakage_overview: {
    description:
      "Monthly leakage for the workspace from the latest distributor bill and client billing import: totals, recovered and overbilled amounts, open exceptions by kind, and per-client leakage. Amounts are in cents.",
    input: z.object({}),
  },
  list_exceptions: {
    description:
      "Reconciliation exceptions (unbilled seats, stale prices, ghost licenses, overbilling, unmapped customers), largest monthly impact first. Optional client, kind and status filters.",
    input: z.object({
      clientId: uuid.optional(),
      kind: z.enum(exceptionKinds).optional(),
      status: exceptionStatus.optional(),
      limit: z.number().int().min(1).max(200).optional(),
    }),
  },
  explain_exception: {
    description:
      "One exception in full: vendor versus billed quantity and price, the monthly impact, its status, and the comment thread.",
    input: z.object({ exceptionId: uuid }),
  },
  get_client: {
    description:
      "One client: markup, vendor seats, leakage, the mapped distributor customers, the agreement lines, and its exceptions.",
    input: z.object({ clientId: uuid }),
  },
  list_unmapped: {
    description:
      "Distributor customers and billed client names that aren't mapped to a SeatTrue client yet, so their seats can't be reconciled.",
    input: z.object({}),
  },
} as const;

export type McpToolName = keyof typeof mcpTools;

export class McpToolError extends Error {}

export function createMcpToolRunner(deps: {
  recon: ReconService;
  audit: AuditLog;
}) {
  const { recon, audit } = deps;

  async function execute(
    workspace: Workspace,
    name: McpToolName,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    const organizationId = workspace.organizationId;
    switch (name) {
      case "get_leakage_overview":
        return recon.overview(organizationId);
      case "list_exceptions": {
        const input = mcpTools.list_exceptions.input.parse(args);
        const exceptions = (await recon.exceptions(organizationId))
          .filter(
            (entry) =>
              (!input.clientId || entry.clientId === input.clientId) &&
              (!input.kind || entry.kind === input.kind) &&
              (!input.status || entry.status === input.status),
          )
          .sort(
            (a, b) =>
              Math.abs(b.monthlyImpactCents) - Math.abs(a.monthlyImpactCents),
          );
        return {
          total: exceptions.length,
          exceptions: exceptions.slice(0, input.limit ?? 50),
        };
      }
      case "explain_exception": {
        const { exceptionId } = mcpTools.explain_exception.input.parse(args);
        const exception = (await recon.exceptions(organizationId)).find(
          (entry) => entry.id === exceptionId,
        );
        if (!exception) throw new McpToolError("Exception not found.");
        return {
          exception,
          comments: (await recon.comments(organizationId, exceptionId)) ?? [],
        };
      }
      case "get_client": {
        const { clientId } = mcpTools.get_client.input.parse(args);
        const detail = await recon.client(organizationId, clientId);
        if (!detail) throw new McpToolError("Client not found.");
        return detail;
      }
      case "list_unmapped": {
        const mappings = await recon.mappings(organizationId);
        return {
          unmappedCustomers: mappings.unmapped,
          unmappedBillingClients: mappings.unmappedBilling,
        };
      }
    }
  }

  /** Runs a tool and audits the call, including refusals and errors. */
  return async function run(
    workspace: Workspace,
    name: McpToolName,
    args: Record<string, unknown>,
  ): Promise<{ ok: true; result: unknown } | { ok: false; error: string }> {
    let outcome: { ok: true; result: unknown } | { ok: false; error: string };
    try {
      outcome = { ok: true, result: await execute(workspace, name, args) };
    } catch (error) {
      if (!(error instanceof McpToolError || error instanceof z.ZodError))
        throw error;
      outcome = {
        ok: false,
        error:
          error instanceof z.ZodError
            ? "Invalid tool arguments."
            : error.message,
      };
    }
    await audit.record({
      organizationId: workspace.organizationId,
      actor: { userId: workspace.user.id, email: workspace.user.email },
      action: "mcp.tool_called",
      targetType: "mcp_tool",
      targetId: name,
      after: { args, ok: outcome.ok },
    });
    return outcome;
  };
}

export type McpToolRunner = ReturnType<typeof createMcpToolRunner>;
