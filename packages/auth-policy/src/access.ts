import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/organization/access";

/**
 * Workspace permissions for the Better Auth organization plugin. Three fixed
 * roles, no dynamic access control, no teams. The plugin's own statements
 * (organization, member, invitation) stay so its endpoints keep working:
 * invitation:create = invite, member:delete = remove, member:update = change
 * role, organization:delete = delete the workspace.
 */
export const statement = {
  ...defaultStatements,
  exception: ["view", "comment", "flag", "resolve"],
  mapping: ["edit"],
  client: ["create", "archive", "markup"],
  run: ["upload", "demo"],
  billing: ["manage"],
  audit: ["view"],
} as const;

export const ac = createAccessControl(statement);

/** Technicians: see everything, import bills, flag and comment. */
const tech = ac.newRole({
  exception: ["view", "comment", "flag"],
  run: ["upload"],
});

/** Ops / finance: everything a tech does, plus resolving, mapping and invites. */
const admin = ac.newRole({
  invitation: ["create", "cancel"],
  exception: ["view", "comment", "flag", "resolve"],
  mapping: ["edit"],
  run: ["upload"],
  audit: ["view"],
});

/** Billing, plan, markups, people and the workspace itself. */
const owner = ac.newRole({
  organization: ["update", "delete"],
  member: ["create", "update", "delete"],
  invitation: ["create", "cancel"],
  exception: ["view", "comment", "flag", "resolve"],
  mapping: ["edit"],
  client: ["create", "archive", "markup"],
  run: ["upload", "demo"],
  billing: ["manage"],
  audit: ["view"],
});

export const roles = { owner, admin, tech };

export type WorkspaceRole = keyof typeof roles;
export const workspaceRoles = Object.keys(roles) as WorkspaceRole[];
/** Roles an invite may grant; ownership is never handed out by invite. */
export const invitableRoles = ["admin", "tech"] as const;

type Statement = typeof statement;
/** e.g. `{ exception: ["resolve"] }` */
export type Permissions = {
  [Resource in keyof Statement]?: readonly Statement[Resource][number][];
};

export function isWorkspaceRole(role: string): role is WorkspaceRole {
  return role in roles;
}

/**
 * Same check the plugin's hasPermission runs for a member's role; usable in
 * the browser (like checkRolePermission) to hide controls. The API's
 * server-side check is the real gate.
 */
export function roleCan(role: string, permissions: Permissions): boolean {
  if (!isWorkspaceRole(role)) return false;
  return roles[role].authorize(permissions).success;
}

/** Every action a role holds, for UI gating. */
export function rolePermissions(role: string): Permissions {
  return isWorkspaceRole(role) ? (roles[role].statements as Permissions) : {};
}
