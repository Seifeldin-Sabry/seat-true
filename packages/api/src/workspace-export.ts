import {
  agreementLines,
  auditLog,
  billingImports,
  clients,
  customerMappings,
  type Database,
  exceptionComments,
  invitation,
  member,
  organization,
  reconciliationExceptions,
  reconciliationRuns,
  skuAliases,
  user,
} from "@seattrue/db";
import { eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { forbidden, type WorkspaceGuard } from "./workspace";

/**
 * Everything the workspace holds as one JSON document: the "full export" the
 * Terms and DPA promise for the 30-day read-only period. Includes the parsed
 * lines of every uploaded distributor bill and the latest billing import.
 */
export async function exportWorkspace(db: Database, organizationId: string) {
  const [org] = await db
    .select({
      id: organization.id,
      name: organization.name,
      createdAt: organization.createdAt,
    })
    .from(organization)
    .where(eq(organization.id, organizationId));

  return {
    exportedAt: new Date().toISOString(),
    organization: org ?? null,
    members: await db
      .select({
        email: user.email,
        name: user.name,
        role: member.role,
        joinedAt: member.createdAt,
      })
      .from(member)
      .innerJoin(user, eq(user.id, member.userId))
      .where(eq(member.organizationId, organizationId)),
    invitations: await db
      .select({
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
      })
      .from(invitation)
      .where(eq(invitation.organizationId, organizationId)),
    clients: await db
      .select()
      .from(clients)
      .where(eq(clients.organizationId, organizationId)),
    customerMappings: await db
      .select()
      .from(customerMappings)
      .where(eq(customerMappings.organizationId, organizationId)),
    skuAliases: await db
      .select()
      .from(skuAliases)
      .where(eq(skuAliases.organizationId, organizationId)),
    agreementLines: await db
      .select()
      .from(agreementLines)
      .where(eq(agreementLines.organizationId, organizationId)),
    distributorBills: await db
      .select()
      .from(reconciliationRuns)
      .where(eq(reconciliationRuns.organizationId, organizationId))
      .orderBy(reconciliationRuns.createdAt),
    billingImports: await db
      .select()
      .from(billingImports)
      .where(eq(billingImports.organizationId, organizationId)),
    exceptions: await db
      .select()
      .from(reconciliationExceptions)
      .where(eq(reconciliationExceptions.organizationId, organizationId)),
    exceptionComments: await db
      .select()
      .from(exceptionComments)
      .where(eq(exceptionComments.organizationId, organizationId)),
    auditLog: await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.organizationId, organizationId))
      .orderBy(auditLog.createdAt),
  };
}

/** GET /workspace/export: Owner only, works while the workspace is read-only. */
export function createWorkspaceExportRoutes(options: {
  db: Database;
  guard: WorkspaceGuard;
}) {
  return new Elysia({ name: "workspace-export-routes" }).get(
    "/workspace/export",
    async ({ request, status }) => {
      const access = await options.guard(request.headers);
      if (!access.ok) return status(access.status, access.body);
      if (access.workspace.role !== "owner") {
        const denied = forbidden("Only the Owner can export the workspace.");
        return status(denied.status, denied.body);
      }
      const data = await exportWorkspace(
        options.db,
        access.workspace.organizationId,
      );
      const day = data.exportedAt.slice(0, 10);
      return new Response(JSON.stringify(data, null, 2), {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "content-disposition": `attachment; filename="seattrue-export-${day}.json"`,
          "cache-control": "no-store",
        },
      });
    },
  );
}
