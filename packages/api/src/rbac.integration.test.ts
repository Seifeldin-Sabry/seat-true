import { expect, test } from "bun:test";
import type { WorkspaceRole } from "@seattrue/auth-policy";
import type { BillingService } from "@seattrue/billing";
import {
  createDatabase,
  invitation,
  member,
  organization,
  session,
  user,
} from "@seattrue/db";
import { createEmailService } from "@seattrue/email";
import { eq, inArray } from "drizzle-orm";
import { createApp } from "./app";
import { createAuth, createAuthService } from "./auth";
import { createPlanLimits } from "./plan-limits";
import { createProjectRepository } from "./projects";
import { createReconService } from "./reconciliation";

const databaseUrl = process.env.TEST_DATABASE_URL;
const authSecret = process.env.BETTER_AUTH_SECRET;
const integrationTest = databaseUrl && authSecret ? test : test.skip;
const appOrigin = "http://localhost:3000";
const silent = { info() {}, warn() {}, error() {} };

type Allowed = Record<WorkspaceRole, boolean>;
const everyone: Allowed = { owner: true, admin: true, tech: true };
const opsAndUp: Allowed = { owner: true, admin: true, tech: false };
const ownerOnly: Allowed = { owner: true, admin: false, tech: false };
/** Platform-admin routes: no workspace role is enough. */
const nobody: Allowed = { owner: false, admin: false, tech: false };

/** Every API route with the roles allowed to call it. */
function permissionMatrix(): {
  method: string;
  path: string;
  body?: unknown;
  allowed: Allowed;
}[] {
  const id = () => crypto.randomUUID();
  return [
    { method: "GET", path: "/workspace", allowed: everyone },
    { method: "GET", path: "/recon/overview", allowed: everyone },
    { method: "GET", path: "/recon/exceptions", allowed: everyone },
    { method: "GET", path: "/recon/mappings", allowed: everyone },
    { method: "GET", path: `/recon/clients/${id()}`, allowed: everyone },
    {
      method: "GET",
      path: `/recon/exceptions/${id()}/comments`,
      allowed: everyone,
    },
    {
      method: "POST",
      path: `/recon/exceptions/${id()}/comments`,
      body: { body: "Looks like a seat was missed" },
      allowed: everyone,
    },
    {
      method: "PUT",
      path: `/recon/exceptions/${id()}/flag`,
      body: { flagged: true },
      allowed: everyone,
    },
    {
      method: "POST",
      path: "/recon/runs",
      body: { fileName: "bill.csv", csv: "a,b\n1,2" },
      allowed: everyone,
    },
    {
      method: "POST",
      path: "/recon/billing",
      body: { fileName: "billing.csv", csv: "a,b\n1,2" },
      allowed: everyone,
    },
    {
      method: "PUT",
      path: `/recon/clients/${id()}/agreements`,
      body: { lines: [{ sku: "BP", quantity: 1, unitPriceCents: 2640 }] },
      allowed: everyone,
    },
    {
      method: "PATCH",
      path: `/recon/exceptions/${id()}`,
      body: { status: "approved" },
      allowed: opsAndUp,
    },
    {
      method: "PUT",
      path: "/recon/billing/mappings",
      body: { clientName: "Acme", clientId: id() },
      allowed: opsAndUp,
    },
    {
      method: "PUT",
      path: "/recon/mappings",
      body: { customerKey: "PX-1", clientId: id() },
      allowed: opsAndUp,
    },
    {
      method: "POST",
      path: "/recon/clients",
      body: { name: `Matrix ${id()}`, markupPct: 20 },
      allowed: ownerOnly,
    },
    {
      method: "PATCH",
      path: `/recon/clients/${id()}`,
      body: { markupPct: 25 },
      allowed: ownerOnly,
    },
    {
      method: "PATCH",
      path: `/recon/clients/${id()}`,
      body: { archived: true },
      allowed: ownerOnly,
    },
    { method: "POST", path: "/recon/demo", allowed: ownerOnly },
    { method: "GET", path: "/billing/overview", allowed: everyone },
    {
      method: "POST",
      path: "/billing/checkout",
      body: { plan: "solo" },
      allowed: ownerOnly,
    },
    { method: "POST", path: "/billing/portal", allowed: ownerOnly },
    {
      method: "GET",
      path: "/billing/plan-change/preflight?plan=solo",
      allowed: ownerOnly,
    },
    {
      method: "POST",
      path: "/billing/plan-change",
      body: { plan: "solo" },
      allowed: ownerOnly,
    },
    { method: "GET", path: "/members", allowed: everyone },
    {
      method: "POST",
      path: "/members/invitations",
      body: { email: `matrix-${id()}@northbeam-it.com`, role: "tech" },
      allowed: opsAndUp,
    },
    {
      method: "DELETE",
      path: `/members/invitations/${id()}`,
      allowed: opsAndUp,
    },
    {
      method: "PATCH",
      path: `/members/${id()}`,
      body: { role: "admin" },
      allowed: ownerOnly,
    },
    { method: "DELETE", path: `/members/${id()}`, allowed: ownerOnly },
    { method: "GET", path: "/audit", allowed: opsAndUp },
    {
      method: "GET",
      path: "/integrations/waitlist/counts",
      allowed: nobody,
    },
  ];
}

integrationTest(
  "roles, invites, seat limits and the permission matrix against real Better Auth",
  async () => {
    if (!databaseUrl || !authSecret) return;
    const connection = createDatabase(databaseUrl);
    const db = connection.db;
    const recon = createReconService(db);
    let planLookupKey: string | null = "seattrue_solo_monthly";
    const billing = {
      currentPlanLookupKey: async () => planLookupKey,
      access: async () => "full" as const,
      takeScheduledKeepList: async () => null,
    } as unknown as BillingService;
    const planLimits = createPlanLimits({ db, recon, billing });
    const auth = createAuthService(db, {
      baseURL: appOrigin,
      secret: authSecret,
      trustedOrigins: [appOrigin],
      appOrigin,
      logger: silent,
      seats: {
        assertCanInvite: planLimits.assertCanInvite,
        assertCanJoin: planLimits.assertCanJoin,
      },
      // Fresh address per run keeps Better Auth rate limits out of the way.
      getClientIp: () =>
        `10.1.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`,
    });
    const app = createApp({
      projects: createProjectRepository(db),
      db,
      recon,
      planLimits,
      auth,
      allowedOrigins: [appOrigin],
      logger: silent,
    });
    const run = crypto.randomUUID().slice(0, 8);
    const emails = {
      owner: `owner-${run}@northbeam-it.com`,
      admin: `admin-${run}@northbeam-it.com`,
      tech: `tech-${run}@northbeam-it.com`,
    };
    const cookies: Partial<Record<WorkspaceRole, string>> = {};
    const call = (
      role: WorkspaceRole,
      method: string,
      path: string,
      body?: unknown,
    ) =>
      app.handle(
        new Request(`${appOrigin}/api${path}`, {
          method,
          headers: {
            Origin: appOrigin,
            "Content-Type": "application/json",
            cookie: cookies[role] ?? "",
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
        }),
      );
    const signUp = async (role: WorkspaceRole) => {
      const response = await app.handle(
        new Request(`${appOrigin}/api/auth/sign-up/email`, {
          method: "POST",
          headers: { Origin: appOrigin, "Content-Type": "application/json" },
          body: JSON.stringify({
            name: role,
            email: emails[role],
            password: `Password-${crypto.randomUUID()}`,
          }),
        }),
      );
      expect(response.status).toBe(200);
      cookies[role] = response.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ");
      return ((await response.json()) as { user: { id: string } }).user.id;
    };

    const ownerId = await signUp("owner");
    const adminId = await signUp("admin");
    const techId = await signUp("tech");
    const userIds = [ownerId, adminId, techId];
    const workspaceId = `org_${ownerId}`;

    try {
      // Sign-up made a personal workspace and made it the session's active one.
      const [ownerSession] = await db
        .select({ active: session.activeOrganizationId })
        .from(session)
        .where(eq(session.userId, ownerId));
      expect(ownerSession?.active).toBe(workspaceId);
      const ownerView = await (await call("owner", "GET", "/workspace")).json();
      expect(ownerView.role).toBe("owner");
      expect(ownerView.permissions.billing).toEqual(["manage"]);

      // Invites: work email only.
      const personal = await call("owner", "POST", "/members/invitations", {
        email: `someone-${run}@gmail.com`,
        role: "tech",
      });
      expect(personal.status).toBe(422);
      expect((await personal.json()).error).toEqual({
        code: "WORK_EMAIL_REQUIRED",
        message:
          "Use your work email. Gmail and Outlook addresses aren't accepted.",
      });
      // Ownership is never handed out by invite.
      expect(
        (
          await call("owner", "POST", "/members/invitations", {
            email: emails.admin,
            role: "owner",
          })
        ).status,
      ).toBe(422);
      // The plugin's own membership endpoints are not reachable directly.
      expect(
        (
          await call("owner", "POST", "/auth/organization/invite-member", {
            email: emails.admin,
            role: "admin",
          })
        ).status,
      ).toBe(404);

      // Default 48h expiry.
      const invitedAdmin = await call("owner", "POST", "/members/invitations", {
        email: emails.admin,
        role: "admin",
      });
      expect(invitedAdmin.status).toBe(201);
      const adminInvite = await invitedAdmin.json();
      const hours =
        (new Date(adminInvite.expiresAt).getTime() - Date.now()) / 3_600_000;
      expect(hours).toBeGreaterThan(47.9);
      expect(hours).toBeLessThanOrEqual(48);

      // Solo: owner + pending admin invite fill both seats; a third is refused.
      const third = await call("owner", "POST", "/members/invitations", {
        email: emails.tech,
        role: "tech",
      });
      expect(third.status).toBe(402);
      expect((await third.json()).error.code).toBe("PLAN_LIMIT");

      // Only the invitee can accept; accepting switches their workspace.
      expect(
        (await call("tech", "POST", `/invitations/${adminInvite.id}/accept`))
          .status,
      ).toBe(403);
      const accepted = await call(
        "admin",
        "POST",
        `/invitations/${adminInvite.id}/accept`,
      );
      expect(accepted.status).toBe(200);
      expect(
        (await (await call("admin", "GET", "/workspace")).json()).organization
          .id,
      ).toBe(workspaceId);

      // Team: unlimited seats.
      planLookupKey = "seattrue_team_monthly";
      const invitedTech = await call("admin", "POST", "/members/invitations", {
        email: emails.tech,
        role: "tech",
      });
      expect(invitedTech.status).toBe(201);
      const techInvite = await invitedTech.json();
      // Back on Solo before accepting: the seat check runs again on accept.
      planLookupKey = "seattrue_solo_monthly";
      const blocked = await call(
        "tech",
        "POST",
        `/invitations/${techInvite.id}/accept`,
      );
      expect(blocked.status).toBe(402);
      expect((await blocked.json()).error.code).toBe("PLAN_LIMIT");
      planLookupKey = "seattrue_team_monthly";
      expect(
        (await call("tech", "POST", `/invitations/${techInvite.id}/accept`))
          .status,
      ).toBe(200);

      // An expired invitation can't be accepted.
      const late = await call("owner", "POST", "/members/invitations", {
        email: `late-${run}@northbeam-it.com`,
        role: "tech",
      });
      const lateInvite = await late.json();
      await db
        .update(invitation)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(invitation.id, lateInvite.id));
      expect(
        (await call("owner", "GET", `/invitations/${lateInvite.id}`)).status,
      ).toBe(400);
      const members = (await (await call("owner", "GET", "/members")).json())
        .members as { id: string; email: string; role: string }[];
      expect(members.map((entry) => entry.role)).toEqual([
        "owner",
        "tech",
        "admin",
      ]);

      // Permission matrix: allowed calls may still fail for other reasons
      // (404, 422, 503), but only forbidden ones answer 403 FORBIDDEN.
      for (const route of permissionMatrix()) {
        for (const role of ["owner", "admin", "tech"] as const) {
          const response = await call(
            role,
            route.method,
            route.path,
            route.body,
          );
          const label = `${role} ${route.method} ${route.path}`;
          if (route.allowed[role]) {
            expect({ label, status: response.status }).not.toEqual({
              label,
              status: 403,
            });
          } else {
            expect({ label, body: await response.json() }).toMatchObject({
              label,
              body: { error: { code: "FORBIDDEN" } },
            });
            expect(response.status).toBe(403);
          }
        }
      }

      // Role change and removal are owner-only and audited.
      const techMember = members.find((entry) => entry.email === emails.tech);
      if (!techMember) throw new Error("tech member missing");
      expect(
        (
          await call("owner", "PATCH", `/members/${techMember.id}`, {
            role: "admin",
          })
        ).status,
      ).toBe(200);
      const ownerMember = members.find((entry) => entry.role === "owner");
      expect(
        (await call("owner", "DELETE", `/members/${ownerMember?.id}`)).status,
      ).toBe(403);
      const audit = (await (await call("owner", "GET", "/audit")).json())
        .entries as { action: string; actorEmail: string | null }[];
      expect(audit.map((entry) => entry.action)).toContain(
        "member.role_changed",
      );
      expect(audit).toContainEqual(
        expect.objectContaining({
          action: "member.joined",
          actorEmail: emails.admin,
        }),
      );

      // Suspended members can't read the workspace's data.
      await db
        .update(member)
        .set({ suspendedAt: new Date() })
        .where(eq(member.id, techMember.id));
      const suspended = await call("tech", "GET", "/recon/overview");
      expect(suspended.status).toBe(403);
      expect((await suspended.json()).error.code).toBe("FORBIDDEN");
      expect(
        (await (await call("tech", "GET", "/workspace")).json()).suspended,
      ).toBe(true);
    } finally {
      await db.delete(organization).where(
        inArray(
          organization.id,
          userIds.map((id) => `org_${id}`),
        ),
      );
      await db.delete(user).where(inArray(user.id, userIds));
      await connection.close();
    }
  },
);

integrationTest(
  "invites require a verified email when email delivery is on",
  async () => {
    if (!databaseUrl || !authSecret) return;
    const connection = createDatabase(databaseUrl);
    try {
      const pluginOptions = (environmentEmail: boolean) => {
        const email = createEmailService({
          env: environmentEmail
            ? { RESEND_API_KEY: "re_test", EMAIL_FROM: "a@northbeam-it.com" }
            : {},
          sender: async () => ({ data: { id: "x" }, error: null }),
        });
        const auth = createAuth(connection.db, {
          baseURL: appOrigin,
          secret: authSecret,
          trustedOrigins: [appOrigin],
          email,
        });
        const plugin = auth.options.plugins?.find(
          (entry) => entry.id === "organization",
        ) as { options?: Record<string, unknown> } | undefined;
        return plugin?.options;
      };
      expect(pluginOptions(true)).toMatchObject({
        requireEmailVerificationOnInvitation: true,
        invitationExpiresIn: 172_800,
        allowUserToCreateOrganization: false,
      });
      expect(pluginOptions(false)?.requireEmailVerificationOnInvitation).toBe(
        false,
      );
    } finally {
      await connection.close();
    }
  },
);
