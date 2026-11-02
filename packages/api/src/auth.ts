import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import {
  ac,
  invitableRoles,
  isWorkEmail,
  type Permissions,
  roles,
  WORK_EMAIL_REQUIRED_MESSAGE,
} from "@seattrue/auth-policy";
import type { BetterAuthSecondaryStorage } from "@seattrue/cache";
import {
  account,
  type Database,
  invitation,
  member,
  organization,
  rateLimit,
  session,
  user,
  verification,
} from "@seattrue/db";
import type { EmailService } from "@seattrue/email";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { organization as organizationPlugin } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import type { Logger } from "./logger";
import {
  ensurePersonalOrganization,
  type Membership,
  membershipsFor,
  pickActiveMembership,
} from "./organizations";
import { PlanLimitError } from "./plan-limits";

export type AuthEnvironment = {
  /** Public app origin; Better Auth serves /api/auth/* on it. */
  baseURL: string;
  secret: string;
  trustedOrigins: string[];
  secondaryStorage?: BetterAuthSecondaryStorage;
  getClientIp?: (request: Request) => string | null;
  email?: EmailService;
  logger?: Logger;
  /** Google sign-in turns on only when both credentials are configured. */
  google?: { clientId: string; clientSecret: string };
  /** Where invitation links point (the app's /accept-invite page). */
  appOrigin?: string;
  /** Seat limits; each throws PlanLimitError when the plan is full. */
  seats?: {
    assertCanInvite(organizationId: string): Promise<void>;
    assertCanJoin(organizationId: string): Promise<void>;
  };
};

export type AuthenticatedSession = {
  user: {
    id: string;
    email: string;
    name: string;
    /** Missing means not verified. */
    emailVerified?: boolean;
  };
  session: { id: string; userId: string };
};

/**
 * SeatTrue staff, from PLATFORM_ADMIN_EMAILS. Only a verified address counts,
 * so nobody can claim an admin email by signing up with it unverified.
 */
export function isPlatformAdmin(
  user: AuthenticatedSession["user"],
  adminEmails: readonly string[],
): boolean {
  return (
    user.emailVerified === true &&
    adminEmails.includes(user.email.trim().toLowerCase())
  );
}

export type { Membership } from "./organizations";

/** The signed-in user plus the workspace (organization) the session acts in. */
export type WorkspaceSession = AuthenticatedSession & {
  memberships: Membership[];
  /** Null when the user belongs to no workspace. May be suspended. */
  active: Membership | null;
};

/** Better Auth organization endpoints the API calls on the user's behalf. */
export type OrganizationApi = {
  createInvitation(
    headers: Headers,
    body: { email: string; role: string; organizationId: string },
  ): Promise<{ id: string; email: string; role: string; expiresAt: Date }>;
  cancelInvitation(headers: Headers, invitationId: string): Promise<void>;
  getInvitation(
    headers: Headers,
    invitationId: string,
  ): Promise<{
    id: string;
    email: string;
    role: string;
    organizationId: string;
    organizationName: string;
    inviterEmail: string;
    expiresAt: Date;
  }>;
  acceptInvitation(
    headers: Headers,
    invitationId: string,
  ): Promise<{ organizationId: string; role: string }>;
  removeMember(
    headers: Headers,
    body: { memberId: string; organizationId: string },
  ): Promise<void>;
  updateMemberRole(
    headers: Headers,
    body: { memberId: string; role: string; organizationId: string },
  ): Promise<void>;
  setActive(headers: Headers, organizationId: string): Promise<void>;
};

export type AuthService = {
  emailEnabled: boolean;
  googleEnabled?: boolean;
  handler(request: Request): Promise<Response>;
  getSession(headers: Headers): Promise<AuthenticatedSession | null>;
  getWorkspaceSession(headers: Headers): Promise<WorkspaceSession | null>;
  /** The organization plugin's hasPermission for the member's role. */
  hasPermission(
    headers: Headers,
    organizationId: string,
    permissions: Permissions,
  ): Promise<boolean>;
  organization?: OrganizationApi;
};

/**
 * Plugin endpoints that change membership are reachable only through the
 * API's /members and /invitations routes, which add the 403 contract and the
 * audit log. Workspaces are created by SeatTrue, never by users.
 */
const serverOnlyOrganizationPaths = new Set(
  [
    "create",
    "update",
    "delete",
    "invite-member",
    "cancel-invitation",
    "accept-invitation",
    "reject-invitation",
    "remove-member",
    "update-member-role",
    "leave",
    "add-member",
    "create-role",
    "update-role",
    "delete-role",
  ].map((path) => `/api/auth/organization/${path}`),
);

function planLimitApiError(error: unknown): never {
  if (error instanceof PlanLimitError) {
    throw new APIError("PAYMENT_REQUIRED", {
      code: "PLAN_LIMIT",
      message: error.message,
    });
  }
  throw error;
}

/**
 * Runs before any user row is created, so it covers email sign-up and a
 * first Google sign-in alike. Personal mailboxes never get an account.
 */
export async function requireWorkEmail<T extends { email: string }>(
  user: T,
): Promise<{ data: T }> {
  if (!isWorkEmail(user.email)) {
    throw new APIError("BAD_REQUEST", {
      code: "WORK_EMAIL_REQUIRED",
      message: WORK_EMAIL_REQUIRED_MESSAGE,
    });
  }
  return { data: user };
}

export function createAuth(db: Database, environment: AuthEnvironment) {
  const email = environment.email;
  return betterAuth({
    baseURL: environment.baseURL,
    secret: environment.secret,
    trustedOrigins: environment.trustedOrigins,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user,
        session,
        account,
        verification,
        rateLimit,
        organization,
        member,
        invitation,
      },
    }),
    emailAndPassword: {
      enabled: true,
      ...(email?.enabled
        ? {
            requireEmailVerification: true,
            sendResetPassword: async ({
              user,
              url,
            }: {
              user: { email: string; name: string };
              url: string;
            }) => {
              await deliverAccountEmail(
                () =>
                  email.sendPasswordResetEmail({
                    to: user.email,
                    name: user.name,
                    url,
                  }),
                environment.logger,
                "password_reset_email_failed",
              );
            },
          }
        : {}),
    },
    ...(email?.enabled
      ? {
          emailVerification: {
            sendOnSignUp: true,
            sendOnSignIn: true,
            sendVerificationEmail: async ({
              user,
              url,
            }: {
              user: { email: string; name: string };
              url: string;
            }) => {
              await deliverAccountEmail(
                () =>
                  email.sendVerificationEmail({
                    to: user.email,
                    name: user.name,
                    url,
                  }),
                environment.logger,
                "verification_email_failed",
              );
            },
          },
        }
      : {}),
    advanced: {
      // Auth handler receives a sanitized x-real-ip set by the API's onRequest.
      // Never trust the client's raw forwarding headers for rate-limit keys.
      ipAddress: { ipAddressHeaders: ["x-real-ip"] },
    },
    ...(environment.secondaryStorage
      ? { secondaryStorage: environment.secondaryStorage }
      : {}),
    databaseHooks: {
      user: {
        create: {
          before: (user) => requireWorkEmail(user),
          // Every new account starts with its own workspace.
          after: async (user) => {
            await ensurePersonalOrganization(db, user);
          },
        },
      },
      session: {
        create: {
          // Docs: set the active organization when the session is created.
          before: async (session) => {
            const memberships = await membershipsFor(db, session.userId);
            const active = pickActiveMembership(memberships, null);
            const activeOrganizationId =
              active?.organizationId ??
              (await ensurePersonalOrganizationFor(db, session.userId));
            return { data: { ...session, activeOrganizationId } };
          },
        },
      },
    },
    plugins: [
      organizationPlugin({
        ac,
        roles,
        // Personal workspaces are created on sign-up; nobody adds more.
        allowUserToCreateOrganization: false,
        // Plugin default is already 48h; stated so the contract is visible.
        invitationExpiresIn: 60 * 60 * 48,
        cancelPendingInvitationsOnReInvite: true,
        // Verified email proves the invitee owns the mailbox. Without email
        // delivery nobody can verify, and the link only reaches server logs.
        requireEmailVerificationOnInvitation: Boolean(email?.enabled),
        sendInvitationEmail: async (data) => {
          const url = `${environment.appOrigin ?? environment.trustedOrigins[0]}/accept-invite/${encodeURIComponent(data.id)}`;
          if (!email?.enabled) {
            environment.logger?.warn({
              event: "invitation_link",
              note: "Email is disabled; share this link manually.",
              url,
            });
            return;
          }
          await deliverAccountEmail(
            () =>
              email.sendInvitationEmail({
                to: data.email,
                url,
                organizationName: data.organization.name,
                inviterName: data.inviter.user.name || data.inviter.user.email,
                role: data.role,
              }),
            environment.logger,
            "invitation_email_failed",
          );
        },
        organizationHooks: {
          beforeCreateInvitation: async ({ invitation }) => {
            if (!isWorkEmail(invitation.email)) {
              throw new APIError("BAD_REQUEST", {
                code: "WORK_EMAIL_REQUIRED",
                message: WORK_EMAIL_REQUIRED_MESSAGE,
              });
            }
            if (
              !(invitableRoles as readonly string[]).includes(invitation.role)
            ) {
              throw new APIError("BAD_REQUEST", {
                code: "INVALID_ROLE",
                message: "Invite people as admin or tech.",
              });
            }
            await environment.seats
              ?.assertCanInvite(invitation.organizationId)
              .catch(planLimitApiError);
          },
          beforeAcceptInvitation: async ({ invitation }) => {
            await environment.seats
              ?.assertCanJoin(invitation.organizationId)
              .catch(planLimitApiError);
          },
        },
      }),
    ],
    ...(environment.google
      ? {
          socialProviders: {
            google: {
              clientId: environment.google.clientId,
              clientSecret: environment.google.clientSecret,
              prompt: "select_account" as const,
              // Workspace accounts only; consumer Google accounts carry no hd claim.
              hd: "*",
            },
          },
        }
      : {}),
    session: { storeSessionInDatabase: true },
    rateLimit: {
      enabled: true,
      storage: environment.secondaryStorage ? "secondary-storage" : "database",
    },
  });
}

async function deliverAccountEmail(
  send: () => Promise<unknown>,
  logger: Logger | undefined,
  event: string,
): Promise<void> {
  try {
    await send();
  } catch (err) {
    logger?.error({ event, err });
    throw new Error("Email delivery failed");
  }
}

async function ensurePersonalOrganizationFor(db: Database, userId: string) {
  const [owner] = await db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  return owner ? ensurePersonalOrganization(db, owner) : null;
}

export function createAuthService(
  db: Database,
  environment: AuthEnvironment,
): AuthService {
  const auth = createAuth(db, environment);

  async function getSession(headers: Headers) {
    const current = await auth.api.getSession({ headers });
    if (!current) return null;
    return {
      user: {
        id: current.user.id,
        email: current.user.email,
        name: current.user.name,
        emailVerified: current.user.emailVerified,
      },
      session: {
        id: current.session.id,
        userId: current.session.userId,
        activeOrganizationId: current.session.activeOrganizationId ?? null,
      },
    };
  }

  return {
    emailEnabled: environment.email?.enabled ?? false,
    googleEnabled: Boolean(environment.google),
    handler(request) {
      if (serverOnlyOrganizationPaths.has(new URL(request.url).pathname)) {
        return Promise.resolve(
          Response.json(
            { error: { code: "NOT_FOUND", message: "Route not found." } },
            { status: 404 },
          ),
        );
      }
      const headers = new Headers(request.headers);
      headers.delete("x-real-ip");
      const address = environment.getClientIp?.(request);
      if (address) headers.set("x-real-ip", address);
      return auth.handler(new Request(request, { headers }));
    },
    async getSession(headers) {
      const current = await getSession(headers);
      if (!current) return null;
      return {
        user: current.user,
        session: { id: current.session.id, userId: current.session.userId },
      };
    },
    async getWorkspaceSession(headers) {
      const current = await getSession(headers);
      if (!current) return null;
      const memberships = await membershipsFor(db, current.user.id);
      return {
        user: current.user,
        session: { id: current.session.id, userId: current.session.userId },
        memberships,
        active: pickActiveMembership(
          memberships,
          current.session.activeOrganizationId,
        ),
      };
    },
    async hasPermission(headers, organizationId, permissions) {
      const result = await auth.api.hasPermission({
        headers,
        // The plugin's body type wants mutable arrays; the values are the same.
        body: {
          organizationId,
          permissions: permissions as {
            [K in keyof Permissions]: NonNullable<Permissions[K]>[number][];
          },
        },
      });
      return result.success;
    },
    organization: {
      async createInvitation(headers, body) {
        const created = await auth.api.createInvitation({
          headers,
          body: {
            email: body.email,
            role: body.role as "admin" | "tech",
            organizationId: body.organizationId,
          },
        });
        return {
          id: created.id,
          email: created.email,
          role: created.role,
          expiresAt: new Date(created.expiresAt),
        };
      },
      async cancelInvitation(headers, invitationId) {
        await auth.api.cancelInvitation({ headers, body: { invitationId } });
      },
      async getInvitation(headers, invitationId) {
        const found = await auth.api.getInvitation({
          headers,
          query: { id: invitationId },
        });
        return {
          id: found.id,
          email: found.email,
          role: found.role,
          organizationId: found.organizationId,
          organizationName: found.organizationName,
          inviterEmail: found.inviterEmail,
          expiresAt: new Date(found.expiresAt),
        };
      },
      async acceptInvitation(headers, invitationId) {
        const accepted = await auth.api.acceptInvitation({
          headers,
          body: { invitationId },
        });
        if (!accepted?.member) throw new Error("Invitation was not accepted");
        return {
          organizationId: accepted.member.organizationId,
          role: accepted.member.role,
        };
      },
      async removeMember(headers, body) {
        await auth.api.removeMember({
          headers,
          body: {
            memberIdOrEmail: body.memberId,
            organizationId: body.organizationId,
          },
        });
      },
      async updateMemberRole(headers, body) {
        await auth.api.updateMemberRole({
          headers,
          body: {
            memberId: body.memberId,
            role: body.role as "admin" | "tech",
            organizationId: body.organizationId,
          },
        });
      },
      async setActive(headers, organizationId) {
        await auth.api.setActiveOrganization({
          headers,
          body: { organizationId },
        });
      },
    },
  };
}
