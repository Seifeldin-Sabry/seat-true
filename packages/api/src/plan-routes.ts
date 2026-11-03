import {
  BillingPriceConfigurationError,
  type BillingService,
  PlanChangeError,
  planById,
  planByLookupKey,
} from "@seattrue/billing";
import { Elysia, t } from "elysia";
import type { AuditLog } from "./audit";
import type { PlanLimits } from "./plan-limits";
import type { WorkspaceGuard } from "./workspace";

const invalidOrigin = {
  error: { code: "INVALID_ORIGIN" as const, message: "Origin not allowed." },
};
const unavailable = {
  error: {
    code: "BILLING_NOT_CONFIGURED" as const,
    message: "Billing is not configured for this deployment.",
  },
};
const planSchema = t.Union([t.Literal("starter"), t.Literal("pro")]);

/** Typed confirmation required when a downgrade locks clients. */
export const DOWNGRADE_CONFIRMATION = "DOWNGRADE";

/**
 * In-app plan changes. The Stripe portal handles card, invoices and
 * cancellation; plan switching lives here so downgrades can respect usage.
 */
export function createPlanRoutes(options: {
  billing: BillingService | null;
  planLimits: PlanLimits | null;
  audit?: AuditLog;
  guard: WorkspaceGuard;
  allowedOrigins: string[];
}) {
  const { billing, planLimits, guard, audit } = options;
  const trustedOrigins = new Set(options.allowedOrigins);

  return new Elysia({ name: "plan-routes", prefix: "/billing/plan-change" })
    .get(
      "/preflight",
      async ({ request, query, status }) => {
        const access = await guard(request.headers, { billing: ["manage"] });
        if (!access.ok) return status(access.status, access.body);
        if (!planLimits) return status(503, unavailable);
        return planLimits.preflight(
          access.workspace.organizationId,
          query.plan,
        );
      },
      { query: t.Object({ plan: planSchema }) },
    )
    .post(
      "/",
      async ({ request, body, status }) => {
        if (!trustedOrigins.has(request.headers.get("origin") ?? ""))
          return status(403, invalidOrigin);
        const access = await guard(request.headers, { billing: ["manage"] });
        if (!access.ok) return status(access.status, access.body);
        if (!billing || !planLimits) return status(503, unavailable);
        const { workspace } = access;
        const organizationId = workspace.organizationId;

        const current = planByLookupKey(
          await billing.currentPlanLookupKey(organizationId),
        );
        const target = planById(body.plan);
        const preflight = await planLimits.preflight(organizationId, body.plan);
        const isDowngrade = current !== null && target.rank < current.rank;
        let keepClientIds: string[] = [];
        if (isDowngrade && preflight.overages.length > 0) {
          if (body.confirm !== DOWNGRADE_CONFIRMATION) {
            return status(422, {
              error: {
                code: "CONFIRMATION_REQUIRED" as const,
                message: `This downgrade locks ${preflight.defaultLockClientIds.length} clients. Type ${DOWNGRADE_CONFIRMATION} to confirm.`,
              },
            });
          }
          const knownClients = new Set(
            preflight.clients.map((client) => client.id),
          );
          keepClientIds = (
            body.keepClientIds ?? preflight.defaultKeepClientIds
          ).filter((id) => knownClients.has(id));
          if (
            preflight.limit !== null &&
            keepClientIds.length > preflight.limit
          ) {
            return status(422, {
              error: {
                code: "TOO_MANY_KEPT" as const,
                message: `Choose at most ${preflight.limit} clients to keep.`,
              },
            });
          }
        }

        try {
          const result = await billing.changePlan(organizationId, body.plan, {
            keepClientIds,
          });
          // Upgrades take effect now; unlock immediately instead of waiting
          // for the webhook (which will reach the same state).
          if (result.kind === "upgraded") {
            await planLimits.apply(organizationId, target.lookupKey);
          }
          await audit?.record({
            organizationId,
            actor: { userId: workspace.user.id, email: workspace.user.email },
            action: "plan.change",
            targetType: "plan",
            targetId: target.id,
            before: { planId: current?.id ?? null },
            after: result,
          });
          return result;
        } catch (error) {
          if (error instanceof PlanChangeError) {
            return status(409, {
              error: {
                code: "PLAN_CHANGE_REJECTED" as const,
                message: error.message,
              },
            });
          }
          if (error instanceof BillingPriceConfigurationError) {
            return status(503, {
              error: {
                code: "BILLING_PRICE_INVALID" as const,
                message: error.message,
              },
            });
          }
          throw error;
        }
      },
      {
        body: t.Object(
          {
            plan: planSchema,
            keepClientIds: t.Optional(
              t.Array(t.String({ maxLength: 64 }), { maxItems: 1000 }),
            ),
            confirm: t.Optional(t.String({ maxLength: 32 })),
          },
          { additionalProperties: false },
        ),
      },
    );
}
