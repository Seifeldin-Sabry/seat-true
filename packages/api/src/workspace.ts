import type { Permissions, WorkspaceRole } from "@seattrue/auth-policy";
import type { AuthService } from "./auth";

/** The signed-in member and the workspace (organization) they act in. */
export type Workspace = {
  user: { id: string; email: string; name: string };
  organizationId: string;
  organizationName: string;
  memberId: string;
  role: WorkspaceRole;
};

type Denied = {
  ok: false;
  status: 401 | 403;
  body: { error: { code: "UNAUTHORIZED" | "FORBIDDEN"; message: string } };
};

export type GuardResult = { ok: true; workspace: Workspace } | Denied;

/**
 * Every API route goes through this: reads need a membership; writes also
 * pass the organization plugin's hasPermission.
 */
export type WorkspaceGuard = (
  headers: Headers,
  permissions?: Permissions,
) => Promise<GuardResult>;

export function forbidden(message: string): Denied {
  return {
    ok: false,
    status: 403,
    body: { error: { code: "FORBIDDEN", message } },
  };
}

const unauthorized: Denied = {
  ok: false,
  status: 401,
  body: { error: { code: "UNAUTHORIZED", message: "Sign in required." } },
};

export function createWorkspaceGuard(auth: AuthService): WorkspaceGuard {
  return async (headers, permissions) => {
    const current = await auth.getWorkspaceSession(headers);
    if (!current) return unauthorized;
    const active = current.active;
    if (!active) return forbidden("You don't belong to a workspace.");
    if (
      permissions &&
      !(await auth.hasPermission(headers, active.organizationId, permissions))
    ) {
      return forbidden(`Your role (${active.role}) can't do this.`);
    }
    return {
      ok: true,
      workspace: {
        user: current.user,
        organizationId: active.organizationId,
        organizationName: active.organizationName,
        memberId: active.memberId,
        role: active.role as WorkspaceRole,
      },
    };
  };
}
