import { expect, test } from "bun:test";
import { auditLog, createDatabase, organization, user } from "@seattrue/db";
import { and, eq, inArray } from "drizzle-orm";
import { createAuditLog } from "../audit";
import { createReconService } from "../reconciliation";
import { testWorkspace } from "../testing";
import { createMcpEndpoint } from "./server";
import { createMcpToolRunner, mcpTools } from "./tools";

const databaseUrl = process.env.TEST_DATABASE_URL;
const integrationTest = databaseUrl ? test : test.skip;

integrationTest(
  "MCP tools: read the member's own workspace only, with an audit row per call",
  async () => {
    if (!databaseUrl) return;
    const connection = createDatabase(databaseUrl);
    const db = connection.db;
    const recon = createReconService(db);
    const run = createMcpToolRunner({ recon, audit: createAuditLog(db) });
    const orgId = `mcp-${crypto.randomUUID()}`;
    const otherOrgId = `mcp-other-${crypto.randomUUID()}`;
    await db
      .insert(organization)
      .values([orgId, otherOrgId].map((id) => ({ id, name: id, slug: id })));
    const tech = testWorkspace("tech", orgId, `tech-${orgId}`);
    const outsider = testWorkspace("owner", otherOrgId, `owner-${otherOrgId}`);
    const userIds = [tech.user.id, outsider.user.id];
    await db.insert(user).values(
      [tech, outsider].map(({ user: member }) => ({
        id: member.id,
        name: member.name,
        email: member.email,
      })),
    );

    try {
      await recon.loadDemo(orgId);

      const overview = await run(tech, "get_leakage_overview", {});
      if (!overview.ok) throw new Error(overview.error);
      const { clients, leakageCents } = overview.result as {
        clients: { id: string }[];
        leakageCents: number;
      };
      expect(clients.length).toBeGreaterThan(0);
      expect(leakageCents).toBeGreaterThan(0);

      const listed = await run(tech, "list_exceptions", { status: "open" });
      if (!listed.ok) throw new Error(listed.error);
      const { exceptions, total } = listed.result as {
        total: number;
        exceptions: { id: string; monthlyImpactCents: number }[];
      };
      expect(total).toBeGreaterThan(0);
      const impacts = exceptions.map((entry) =>
        Math.abs(entry.monthlyImpactCents),
      );
      expect(impacts).toEqual([...impacts].sort((a, b) => b - a));
      const first = exceptions[0];
      const client = clients[0];
      if (!first || !client) throw new Error("demo data missing");

      expect(
        await run(tech, "explain_exception", { exceptionId: first.id }),
      ).toMatchObject({ ok: true, result: { exception: { id: first.id } } });
      expect(
        await run(tech, "get_client", { clientId: client.id }),
      ).toMatchObject({ ok: true, result: { client: { id: client.id } } });
      expect((await run(tech, "list_unmapped", {})).ok).toBe(true);

      // Another workspace can't reach this one through any tool.
      expect(
        await run(outsider, "explain_exception", { exceptionId: first.id }),
      ).toEqual({ ok: false, error: "Exception not found." });
      expect(
        await run(outsider, "get_client", { clientId: client.id }),
      ).toEqual({ ok: false, error: "Client not found." });
      expect(await run(outsider, "list_exceptions", {})).toMatchObject({
        ok: true,
        result: { total: 0, exceptions: [] },
      });
      expect(await run(tech, "list_exceptions", { limit: 0 })).toEqual({
        ok: false,
        error: "Invalid tool arguments.",
      });

      // Every call above, allowed or refused, left one audit row in the
      // caller's own workspace.
      const rows = await db
        .select({
          organizationId: auditLog.organizationId,
          targetId: auditLog.targetId,
        })
        .from(auditLog)
        .where(
          and(
            inArray(auditLog.organizationId, [orgId, otherOrgId]),
            eq(auditLog.action, "mcp.tool_called"),
          ),
        );
      expect(rows.filter((row) => row.organizationId === orgId)).toHaveLength(
        6,
      );
      expect(
        rows.filter((row) => row.organizationId === otherOrgId),
      ).toHaveLength(3);

      // Over the MCP protocol: the same tools, read-only.
      const serve = createMcpEndpoint(run);
      const rpc = (body: unknown) =>
        serve(
          new Request("http://localhost:4000/api/mcp", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              accept: "application/json, text/event-stream",
              "mcp-protocol-version": "2025-06-18",
            },
            body: JSON.stringify(body),
          }),
          outsider,
        );
      const tools = await (
        await rpc({ jsonrpc: "2.0", id: 1, method: "tools/list" })
      ).text();
      for (const name of Object.keys(mcpTools)) expect(tools).toContain(name);
      expect(tools).toContain('"readOnlyHint":true');
      const called = await rpc({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "get_client", arguments: { clientId: client.id } },
      });
      expect(await called.text()).toContain("Client not found.");
    } finally {
      await db
        .delete(organization)
        .where(inArray(organization.id, [orgId, otherOrgId]));
      await db.delete(user).where(inArray(user.id, userIds));
      await connection.close();
    }
  },
);
