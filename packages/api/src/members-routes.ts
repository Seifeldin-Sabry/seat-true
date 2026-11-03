import {
  isWorkEmail,
  rolePermissions,
  WORK_EMAIL_REQUIRED_MESSAGE,
} from "@seattrue/auth-policy";
import type { Database } from "@seattrue/db";
import { APIError } from "better-auth/api";
import { Elysia, t } from "elysia";
import type { AuditLog } from "./audit";
import {
  type AuthService,
  isPlatformAdmin,
  type OrganizationApi,
} from "./auth";
import { listMembers, listPendingInvitations } from "./organizations";
import type { Workspace, WorkspaceGuard } from "./workspace";

export type MemberDto = {
  id: string;
  name: string;
  email: string;
  role: string;
  lastActiveAt: string;
  isYou: boolean;
};

export type InvitationDto = {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
};

export type MembersRoutesOptions = {
  db: Database;
  auth: AuthService;
  guard: WorkspaceGuard;
  audit: AuditLog;
  canWrite?: (organizationId: string) => Promise<boolean>;
  allowedOrigins: string[];
  platformAdminEmails?: readonly string[];
};

const invalidOrigin = {
  error: { code: "INVALID_ORIGIN" as const, message: "Origin not allowed." },
};
const unauthorized = {
  error: { code: "UNAUTHORIZED" as const, message: "Sign in required." },
};
const unavailable = {
  error: {
    code: "MEMBERS_NOT_CONFIGURED" as const,
    message: "Workspace membership is not available.",
  },
};
const readOnly = {
  error: {
    code: "SUBSCRIPTION_INACTIVE" as const,
    message:
      "Your subscription is inactive. Your data is safe; update billing to make changes.",
  },
};
// Ownership is never handed out by invite or role change (see invitableRoles).
const roleSchema = t.Union([t.Literal("admin"), t.Literal("tech")]);

type Refusal = {
  code: 400 | 403 | 404 | 409 | 422;
  body: { error: { code: string; message: string } };
};

/** Better Auth refusals in the API's error shape (403 always FORBIDDEN). */
function pluginRefusal(error: unknown): Refusal {
  if (!(error instanceof APIError)) throw error;
  const body = (error.body ?? {}) as { code?: string; message?: string };
  const message = body.message ?? "Request was refused.";
  // The plugin answers some permission failures with 401; the session is valid here.
  if (error.statusCode === 401 || error.statusCode === 403)
    return { code: 403, body: { error: { code: "FORBIDDEN", message } } };
  const code = ([404, 409, 422] as const).find(
    (candidate) => candidate === error.statusCode,
  );
  return {
    code: code ?? 400,
    body: { error: { code: body.code ?? "BAD_REQUEST", message } },
  };
}

const actorOf = (workspace: Workspace) => ({
  userId: workspace.user.id,
  email: workspace.user.email,
});

/**
 * Workspace, members, invitations and the audit log. Membership changes go
 * through Better Auth's organization API (server-side) so its own checks run;
 * these routes add the 403 contract and the audit trail.
 */
export function createMembersRoutes(options: MembersRoutesOptions) {
  const { db, auth, guard, audit } = options;
  const canWrite = options.canWrite ?? (async () => true);
  const trustedOrigins = new Set(options.allowedOrigins);
  const isTrusted = (request: Request) =>
    trustedOrigins.has(request.headers.get("origin") ?? "");
  const organizationApi = (): OrganizationApi | null =>
    auth.organization ?? null;

  async function membersOf(organizationId: string, userId: string) {
    const members = await listMembers(db, organizationId);
    return members.map(
      (entry): MemberDto => ({
        id: entry.id,
        name: entry.name,
        email: entry.email,
        role: entry.role,
        lastActiveAt: new Date(entry.lastActiveAt).toISOString(),
        isYou: entry.userId === userId,
      }),
    );
  }

  async function memberIn(organizationId: string, memberId: string) {
    const members = await listMembers(db, organizationId);
    return members.find((entry) => entry.id === memberId) ?? null;
  }

  return (
    new Elysia({ name: "members-routes" })
      /** Who am I here: role and permissions drive what the UI shows. */
      .get("/workspace", async ({ request, status }) => {
        const current = await auth.getWorkspaceSession(request.headers);
        if (!current) return status(401, unauthorized);
        const active = current.active;
        return {
          user: current.user,
          organization: active
            ? { id: active.organizationId, name: active.organizationName }
            : null,
          role: active?.role ?? null,
          /** SeatTrue staff (PLATFORM_ADMIN_EMAILS); UI gating only. */
          platformAdmin: isPlatformAdmin(
            current.user,
            options.platformAdminEmails ?? [],
          ),
          permissions: active ? rolePermissions(active.role) : {},
          workspaces: current.memberships.map((entry) => ({
            id: entry.organizationId,
            name: entry.organizationName,
            role: entry.role,
          })),
        };
      })
      .put(
        "/workspace/active",
        async ({ request, body, status }) => {
          if (!isTrusted(request)) return status(403, invalidOrigin);
          const current = await auth.getWorkspaceSession(request.headers);
          if (!current) return status(401, unauthorized);
          const target = current.memberships.find(
            (entry) => entry.organizationId === body.organizationId,
          );
          if (!target)
            return status(403, {
              error: {
                code: "FORBIDDEN" as const,
                message: "You can't open that workspace.",
              },
            });
          const api = organizationApi();
          if (!api) return status(503, unavailable);
          await api.setActive(request.headers, body.organizationId);
          return { success: true as const };
        },
        {
          body: t.Object(
            { organizationId: t.String({ minLength: 1, maxLength: 128 }) },
            { additionalProperties: false },
          ),
        },
      )
      .get("/members", async ({ request, status }) => {
        const access = await guard(request.headers);
        if (!access.ok) return status(access.status, access.body);
        const { workspace } = access;
        const [members, invitations] = await Promise.all([
          membersOf(workspace.organizationId, workspace.user.id),
          listPendingInvitations(db, workspace.organizationId),
        ]);
        return {
          members,
          invitations: invitations.map(
            (entry): InvitationDto => ({
              ...entry,
              expiresAt: entry.expiresAt.toISOString(),
            }),
          ),
        };
      })
      .post(
        "/members/invitations",
        async ({ request, body, status }) => {
          if (!isTrusted(request)) return status(403, invalidOrigin);
          const access = await guard(request.headers, {
            invitation: ["create"],
          });
          if (!access.ok) return status(access.status, access.body);
          const { workspace } = access;
          const email = body.email.trim().toLowerCase();
          if (!isWorkEmail(email)) {
            return status(422, {
              error: {
                code: "WORK_EMAIL_REQUIRED" as const,
                message: WORK_EMAIL_REQUIRED_MESSAGE,
              },
            });
          }
          if (!(await canWrite(workspace.organizationId)))
            return status(402, readOnly);
          const api = organizationApi();
          if (!api) return status(503, unavailable);
          try {
            const created = await api.createInvitation(request.headers, {
              email,
              role: body.role,
              organizationId: workspace.organizationId,
            });
            await audit.record({
              organizationId: workspace.organizationId,
              actor: actorOf(workspace),
              action: "member.invited",
              targetType: "invitation",
              targetId: created.id,
              after: { email: created.email, role: created.role },
            });
            return status(201, {
              id: created.id,
              email: created.email,
              role: created.role,
              expiresAt: created.expiresAt.toISOString(),
            } satisfies InvitationDto);
          } catch (error) {
            const refusal = pluginRefusal(error);
            return status(refusal.code, refusal.body);
          }
        },
        {
          body: t.Object(
            {
              email: t.String({ format: "email", maxLength: 254 }),
              role: roleSchema,
            },
            { additionalProperties: false },
          ),
        },
      )
      .delete(
        "/members/invitations/:id",
        async ({ request, params, status }) => {
          if (!isTrusted(request)) return status(403, invalidOrigin);
          const access = await guard(request.headers, {
            invitation: ["cancel"],
          });
          if (!access.ok) return status(access.status, access.body);
          const { workspace } = access;
          const pending = (
            await listPendingInvitations(db, workspace.organizationId)
          ).find((entry) => entry.id === params.id);
          if (!pending)
            return status(404, {
              error: {
                code: "INVITATION_NOT_FOUND" as const,
                message: "Invitation not found.",
              },
            });
          const api = organizationApi();
          if (!api) return status(503, unavailable);
          try {
            await api.cancelInvitation(request.headers, params.id);
          } catch (error) {
            const refusal = pluginRefusal(error);
            return status(refusal.code, refusal.body);
          }
          await audit.record({
            organizationId: workspace.organizationId,
            actor: actorOf(workspace),
            action: "member.invite_canceled",
            targetType: "invitation",
            targetId: params.id,
            before: { email: pending.email, role: pending.role },
          });
          return { success: true as const };
        },
        {
          params: t.Object({ id: t.String({ minLength: 1, maxLength: 128 }) }),
        },
      )
      .patch(
        "/members/:id",
        async ({ request, params, body, status }) => {
          if (!isTrusted(request)) return status(403, invalidOrigin);
          const access = await guard(request.headers, { member: ["update"] });
          if (!access.ok) return status(access.status, access.body);
          const { workspace } = access;
          const target = await memberIn(workspace.organizationId, params.id);
          if (!target)
            return status(404, {
              error: {
                code: "MEMBER_NOT_FOUND" as const,
                message: "Member not found.",
              },
            });
          if (target.role === "owner")
            return status(403, {
              error: {
                code: "FORBIDDEN" as const,
                message: "The owner's role can't be changed.",
              },
            });
          const api = organizationApi();
          if (!api) return status(503, unavailable);
          try {
            await api.updateMemberRole(request.headers, {
              memberId: target.id,
              role: body.role,
              organizationId: workspace.organizationId,
            });
          } catch (error) {
            const refusal = pluginRefusal(error);
            return status(refusal.code, refusal.body);
          }
          await audit.record({
            organizationId: workspace.organizationId,
            actor: actorOf(workspace),
            action: "member.role_changed",
            targetType: "member",
            targetId: target.id,
            before: { email: target.email, role: target.role },
            after: { email: target.email, role: body.role },
          });
          return { success: true as const };
        },
        {
          params: t.Object({ id: t.String({ minLength: 1, maxLength: 128 }) }),
          body: t.Object({ role: roleSchema }, { additionalProperties: false }),
        },
      )
      .delete(
        "/members/:id",
        async ({ request, params, status }) => {
          if (!isTrusted(request)) return status(403, invalidOrigin);
          const access = await guard(request.headers, { member: ["delete"] });
          if (!access.ok) return status(access.status, access.body);
          const { workspace } = access;
          const target = await memberIn(workspace.organizationId, params.id);
          if (!target)
            return status(404, {
              error: {
                code: "MEMBER_NOT_FOUND" as const,
                message: "Member not found.",
              },
            });
          if (target.role === "owner")
            return status(403, {
              error: {
                code: "FORBIDDEN" as const,
                message: "The owner can't be removed.",
              },
            });
          const api = organizationApi();
          if (!api) return status(503, unavailable);
          try {
            await api.removeMember(request.headers, {
              memberId: target.id,
              organizationId: workspace.organizationId,
            });
          } catch (error) {
            const refusal = pluginRefusal(error);
            return status(refusal.code, refusal.body);
          }
          await audit.record({
            organizationId: workspace.organizationId,
            actor: actorOf(workspace),
            action: "member.removed",
            targetType: "member",
            targetId: target.id,
            before: { email: target.email, role: target.role },
          });
          return { success: true as const };
        },
        {
          params: t.Object({ id: t.String({ minLength: 1, maxLength: 128 }) }),
        },
      )
      /** Invitation details for the accept page; the invitee needs a session. */
      .get(
        "/invitations/:id",
        async ({ request, params, status }) => {
          const current = await auth.getSession(request.headers);
          if (!current) return status(401, unauthorized);
          const api = organizationApi();
          if (!api) return status(503, unavailable);
          try {
            const found = await api.getInvitation(request.headers, params.id);
            return {
              id: found.id,
              email: found.email,
              role: found.role,
              organizationName: found.organizationName,
              inviterEmail: found.inviterEmail,
              expiresAt: found.expiresAt.toISOString(),
            };
          } catch (error) {
            const refusal = pluginRefusal(error);
            return status(refusal.code, refusal.body);
          }
        },
        {
          params: t.Object({ id: t.String({ minLength: 1, maxLength: 128 }) }),
        },
      )
      .post(
        "/invitations/:id/accept",
        async ({ request, params, status }) => {
          if (!isTrusted(request)) return status(403, invalidOrigin);
          const current = await auth.getSession(request.headers);
          if (!current) return status(401, unauthorized);
          const api = organizationApi();
          if (!api) return status(503, unavailable);
          try {
            const accepted = await api.acceptInvitation(
              request.headers,
              params.id,
            );
            await audit.record({
              organizationId: accepted.organizationId,
              actor: { userId: current.user.id, email: current.user.email },
              action: "member.joined",
              targetType: "invitation",
              targetId: params.id,
              after: { email: current.user.email, role: accepted.role },
            });
            return accepted;
          } catch (error) {
            const refusal = pluginRefusal(error);
            return status(refusal.code, refusal.body);
          }
        },
        {
          params: t.Object({ id: t.String({ minLength: 1, maxLength: 128 }) }),
        },
      )
      .get("/audit", async ({ request, status }) => {
        const access = await guard(request.headers, { audit: ["view"] });
        if (!access.ok) return status(access.status, access.body);
        return { entries: await audit.list(access.workspace.organizationId) };
      })
  );
}
