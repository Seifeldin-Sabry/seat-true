import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import type { WorkspaceRole } from "@seattrue/auth-policy";
import type { Database } from "@seattrue/db";
import { membershipsFor, pickActiveMembership } from "../organizations";
import type { Workspace } from "../workspace";
import { type McpToolName, type McpToolRunner, mcpTools } from "./tools";

/** The member an MCP access token acts as: the token's user, newest workspace. */
export async function workspaceForUser(
  db: Database,
  user: { id: string; email: string; name: string },
): Promise<Workspace | null> {
  const active = pickActiveMembership(await membershipsFor(db, user.id), null);
  return active
    ? {
        user,
        organizationId: active.organizationId,
        organizationName: active.organizationName,
        memberId: active.memberId,
        role: active.role as WorkspaceRole,
      }
    : null;
}

/**
 * Builds a stateless MCP endpoint for one verified member. A fresh server per
 * request carries that member's scope into every tool; nothing writes.
 */
export function createMcpEndpoint(run: McpToolRunner) {
  function serverFor(workspace: Workspace) {
    const server = new McpServer({ name: "seattrue", version: "1.0.0" });
    for (const [name, tool] of Object.entries(mcpTools)) {
      server.registerTool(
        name,
        {
          description: tool.description,
          inputSchema: tool.input,
          annotations: { readOnlyHint: true, openWorldHint: false },
        },
        async (args: unknown) => {
          const outcome = await run(
            workspace,
            name as McpToolName,
            (args ?? {}) as Record<string, unknown>,
          );
          return outcome.ok
            ? {
                content: [
                  {
                    type: "text" as const,
                    text: JSON.stringify(outcome.result),
                  },
                ],
              }
            : {
                isError: true,
                content: [{ type: "text" as const, text: outcome.error }],
              };
        },
      );
    }
    return server;
  }

  return (request: Request, workspace: Workspace) =>
    createMcpHandler(() => serverFor(workspace)).fetch(request);
}
