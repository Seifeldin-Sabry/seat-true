import {
  BillingPriceConfigurationError,
  type BillingService,
  ExistingSubscriptionError,
} from "@seattrue/billing";
import { Elysia, t } from "elysia";
import type { WorkspaceGuard } from "./workspace";

export type BillingRoutesOptions = {
  billing?: BillingService | null;
  guard: WorkspaceGuard;
  allowedOrigins: string[];
};

const unavailable = {
  error: {
    code: "BILLING_NOT_CONFIGURED" as const,
    message: "Billing is not configured for this deployment.",
  },
};

const invalidOrigin = {
  error: {
    code: "INVALID_ORIGIN" as const,
    message: "Origin not allowed.",
  },
};

export function createBillingRoutes({
  billing,
  guard,
  allowedOrigins,
}: BillingRoutesOptions) {
  const trustedOrigins = new Set(allowedOrigins);
  return new Elysia({ name: "billing-routes", prefix: "/billing" })
    .get("/overview", async ({ request, status }) => {
      // Every member sees the plan and access state; changing it is owner-only.
      const access = await guard(request.headers);
      if (!access.ok) return status(access.status, access.body);
      if (!billing) {
        return {
          enabled: false as const,
          plans: [],
          subscription: null,
          access: "none" as const,
        };
      }
      try {
        return await billing.overview(access.workspace.organizationId);
      } catch (error) {
        if (error instanceof BillingPriceConfigurationError)
          return status(503, {
            error: {
              code: "BILLING_PRICE_INVALID" as const,
              message: error.message,
            },
          });
        throw error;
      }
    })
    .post(
      "/checkout",
      async ({ request, body, status }) => {
        if (!trustedOrigins.has(request.headers.get("origin") ?? ""))
          return status(403, invalidOrigin);
        const access = await guard(request.headers, { billing: ["manage"] });
        if (!access.ok) return status(access.status, access.body);
        if (!billing) return status(503, unavailable);
        const { workspace } = access;
        try {
          return await billing.checkout(
            { id: workspace.organizationId, email: workspace.user.email },
            body.plan,
          );
        } catch (error) {
          if (error instanceof ExistingSubscriptionError) {
            return status(409, {
              error: {
                code: "SUBSCRIPTION_ALREADY_EXISTS" as const,
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
            plan: t.Union([t.Literal("starter"), t.Literal("pro")]),
          },
          { additionalProperties: false },
        ),
      },
    )
    .post("/portal", async ({ request, status }) => {
      if (!trustedOrigins.has(request.headers.get("origin") ?? ""))
        return status(403, invalidOrigin);
      const access = await guard(request.headers, { billing: ["manage"] });
      if (!access.ok) return status(access.status, access.body);
      if (!billing) return status(503, unavailable);
      const portal = await billing.portal(access.workspace.organizationId);
      if (!portal) {
        return status(404, {
          error: {
            code: "BILLING_CUSTOMER_NOT_FOUND" as const,
            message: "No billing customer exists for this account yet.",
          },
        });
      }
      return portal;
    })
    .post(
      "/webhook",
      async ({ request, status }) => {
        if (!billing) return status(503, unavailable);
        const signature = request.headers.get("stripe-signature");
        if (!signature) {
          return status(400, {
            error: {
              code: "INVALID_WEBHOOK_SIGNATURE" as const,
              message: "Missing Stripe signature.",
            },
          });
        }

        let event: Awaited<ReturnType<BillingService["verifyWebhook"]>>;
        try {
          event = await billing.verifyWebhook(await request.text(), signature);
        } catch {
          return status(400, {
            error: {
              code: "INVALID_WEBHOOK_SIGNATURE" as const,
              message: "Stripe signature verification failed.",
            },
          });
        }

        try {
          await billing.processWebhook(event);
        } catch {
          // 5xx makes Stripe retry; processing is idempotent per event id.
          return status(500, {
            error: {
              code: "WEBHOOK_PROCESSING_FAILED" as const,
              message: "Webhook could not be processed; Stripe will retry.",
            },
          });
        }
        return { received: true as const };
      },
      { parse: "none" },
    );
}
