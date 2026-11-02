import { roleCan, type WorkspaceRole } from "@seattrue/auth-policy";
import type { AuthService } from "./auth";
import { forbidden, type Workspace, type WorkspaceGuard } from "./workspace";

/** Test-only helpers: a signed-in member without Better Auth or a database. */
export function testWorkspace(
  role: WorkspaceRole = "owner",
  organizationId = "org-test",
  userId = "user-test",
): Workspace {
  return {
    user: { id: userId, email: `${userId}@northbeam-it.com`, name: userId },
    organizationId,
    organizationName: "Test workspace",
    memberId: `mem-${userId}`,
    role,
  };
}

/** Same decisions as the real guard, using the shared role definitions. */
export function testGuard(workspace: Workspace | null): WorkspaceGuard {
  return async (_headers, permissions) => {
    if (!workspace)
      return {
        ok: false,
        status: 401,
        body: { error: { code: "UNAUTHORIZED", message: "Sign in required." } },
      };
    if (permissions && !roleCan(workspace.role, permissions))
      return forbidden(`Your role (${workspace.role}) can't do this.`);
    return { ok: true, workspace };
  };
}

export function testAuthService(workspace: Workspace | null): AuthService {
  const membership = workspace && {
    memberId: workspace.memberId,
    organizationId: workspace.organizationId,
    organizationName: workspace.organizationName,
    role: workspace.role,
    suspendedAt: null,
    createdAt: new Date(0),
  };
  return {
    emailEnabled: false,
    handler: async () => new Response("Not found", { status: 404 }),
    getSession: async () =>
      workspace
        ? {
            user: workspace.user,
            session: { id: "test-session", userId: workspace.user.id },
          }
        : null,
    getWorkspaceSession: async () =>
      workspace && membership
        ? {
            user: workspace.user,
            session: { id: "test-session", userId: workspace.user.id },
            memberships: [membership],
            active: membership,
          }
        : null,
    hasPermission: async (_headers, _organizationId, permissions) =>
      Boolean(workspace && roleCan(workspace.role, permissions)),
  };
}
