import {
  isWorkEmail,
  WORK_EMAIL_REQUIRED_MESSAGE,
} from "@seattrue/auth-policy";
import { Elysia, t } from "elysia";
import { PlanLimitError } from "./plan-limits";
import {
  ClientLockedError,
  CsvRejectedError,
  type ReconService,
} from "./reconciliation";

type ReconUser = { id: string };

export type ReconRoutesOptions = {
  recon: ReconService;
  /** False when the workspace's subscription has lapsed (read-only, nothing deleted). */
  canWrite?: (userId: string) => Promise<boolean>;
  /** Throws PlanLimitError when another active client would exceed the plan. */
  assertCanAddClient?: (userId: string) => Promise<void>;
  getUser: (headers: Headers) => Promise<ReconUser | null>;
  allowedOrigins: string[];
};

const unauthorized = {
  error: { code: "UNAUTHORIZED" as const, message: "Sign in required." },
};
const invalidOrigin = {
  error: { code: "INVALID_ORIGIN" as const, message: "Origin not allowed." },
};
const readOnly = {
  error: {
    code: "SUBSCRIPTION_INACTIVE" as const,
    message:
      "Your subscription is inactive. Your data is safe; update billing to make changes.",
  },
};
function planLimit(error: PlanLimitError) {
  return {
    error: {
      code: "PLAN_LIMIT" as const,
      message: error.message,
      upgradeUrl: "/app/billing",
    },
  };
}
function clientLocked(error: ClientLockedError) {
  return { error: { code: "CLIENT_LOCKED" as const, message: error.message } };
}
const uuidPattern =
  "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$";
const idParams = t.Object({ id: t.String({ pattern: uuidPattern }) });
/** ~2 MB of CSV covers thousands of subscription lines. */
const maxCsvLength = 2_000_000;

export function createReconRoutes({
  recon,
  canWrite = async () => true,
  assertCanAddClient = async () => {},
  getUser,
  allowedOrigins,
}: ReconRoutesOptions) {
  const trustedOrigins = new Set(allowedOrigins);
  const isTrusted = (request: Request) =>
    trustedOrigins.has(request.headers.get("origin") ?? "");

  return (
    new Elysia({ name: "recon-routes" })
      .get("/recon/overview", async ({ request, status }) => {
        const user = await getUser(request.headers);
        if (!user) return status(401, unauthorized);
        return recon.overview(user.id);
      })
      .get(
        "/recon/clients/:id",
        async ({ request, params, status }) => {
          const user = await getUser(request.headers);
          if (!user) return status(401, unauthorized);
          const detail = await recon.client(user.id, params.id);
          if (!detail) {
            return status(404, {
              error: {
                code: "CLIENT_NOT_FOUND" as const,
                message: "Client not found.",
              },
            });
          }
          return detail;
        },
        { params: idParams },
      )
      .get("/recon/exceptions", async ({ request, status }) => {
        const user = await getUser(request.headers);
        if (!user) return status(401, unauthorized);
        return { exceptions: await recon.exceptions(user.id) };
      })
      .patch(
        "/recon/exceptions/:id",
        async ({ request, params, body, status }) => {
          if (!isTrusted(request)) return status(403, invalidOrigin);
          const user = await getUser(request.headers);
          if (!user) return status(401, unauthorized);
          if (!(await canWrite(user.id))) return status(402, readOnly);
          let updated: Awaited<ReturnType<ReconService["setExceptionStatus"]>>;
          try {
            updated = await recon.setExceptionStatus(
              user.id,
              params.id,
              body.status,
            );
          } catch (error) {
            if (error instanceof ClientLockedError)
              return status(423, clientLocked(error));
            throw error;
          }
          if (!updated) {
            return status(404, {
              error: {
                code: "EXCEPTION_NOT_FOUND" as const,
                message: "Exception not found.",
              },
            });
          }
          return updated;
        },
        {
          params: idParams,
          body: t.Object(
            {
              status: t.Union([
                t.Literal("open"),
                t.Literal("approved"),
                t.Literal("billed"),
                t.Literal("dismissed"),
              ]),
            },
            { additionalProperties: false },
          ),
        },
      )
      .get("/recon/mappings", async ({ request, status }) => {
        const user = await getUser(request.headers);
        if (!user) return status(401, unauthorized);
        return recon.mappings(user.id);
      })
      .put(
        "/recon/mappings",
        async ({ request, body, status }) => {
          if (!isTrusted(request)) return status(403, invalidOrigin);
          const user = await getUser(request.headers);
          if (!user) return status(401, unauthorized);
          if (!(await canWrite(user.id))) return status(402, readOnly);
          let saved: boolean;
          try {
            saved = await recon.setMapping(
              user.id,
              body.customerKey.trim(),
              body.clientId,
            );
          } catch (error) {
            if (error instanceof ClientLockedError)
              return status(423, clientLocked(error));
            throw error;
          }
          if (!saved) {
            return status(404, {
              error: {
                code: "CLIENT_NOT_FOUND" as const,
                message: "Client not found.",
              },
            });
          }
          return { success: true as const };
        },
        {
          body: t.Object(
            {
              customerKey: t.String({
                minLength: 1,
                maxLength: 128,
                pattern: "\\S",
              }),
              clientId: t.String({ pattern: uuidPattern }),
            },
            { additionalProperties: false },
          ),
        },
      )
      .post(
        "/recon/runs",
        async ({ request, body, status }) => {
          if (!isTrusted(request)) return status(403, invalidOrigin);
          const user = await getUser(request.headers);
          if (!user) return status(401, unauthorized);
          if (!(await canWrite(user.id))) return status(402, readOnly);
          try {
            return status(
              201,
              await recon.uploadRun(user.id, body.fileName.trim(), body.csv),
            );
          } catch (error) {
            if (error instanceof CsvRejectedError) {
              return status(422, {
                error: {
                  code: "INVALID_CSV" as const,
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
              fileName: t.String({
                minLength: 1,
                maxLength: 255,
                pattern: "\\S",
              }),
              csv: t.String({ minLength: 1, maxLength: maxCsvLength }),
            },
            { additionalProperties: false },
          ),
        },
      )
      .post(
        "/recon/clients",
        async ({ request, body, status }) => {
          if (!isTrusted(request)) return status(403, invalidOrigin);
          const user = await getUser(request.headers);
          if (!user) return status(401, unauthorized);
          if (!(await canWrite(user.id))) return status(402, readOnly);
          try {
            await assertCanAddClient(user.id);
          } catch (error) {
            if (error instanceof PlanLimitError)
              return status(402, planLimit(error));
            throw error;
          }
          return status(201, await recon.createClient(user.id, body));
        },
        {
          body: t.Object(
            {
              name: t.String({ minLength: 1, maxLength: 160, pattern: "\\S" }),
              psaId: t.Optional(t.String({ maxLength: 64 })),
              markupPct: t.Number({ minimum: 0, maximum: 500 }),
            },
            { additionalProperties: false },
          ),
        },
      )
      .patch(
        "/recon/clients/:id",
        async ({ request, params, body, status }) => {
          if (!isTrusted(request)) return status(403, invalidOrigin);
          const user = await getUser(request.headers);
          if (!user) return status(401, unauthorized);
          if (!(await canWrite(user.id))) return status(402, readOnly);
          if (!body.archived) {
            try {
              await assertCanAddClient(user.id);
            } catch (error) {
              if (error instanceof PlanLimitError)
                return status(402, planLimit(error));
              throw error;
            }
          }
          const updated = await recon.setArchived(
            user.id,
            params.id,
            body.archived,
          );
          if (!updated) {
            return status(404, {
              error: {
                code: "CLIENT_NOT_FOUND" as const,
                message: "Client not found.",
              },
            });
          }
          return updated;
        },
        {
          params: idParams,
          body: t.Object(
            { archived: t.Boolean() },
            { additionalProperties: false },
          ),
        },
      )
      .post("/recon/demo", async ({ request, status }) => {
        if (!isTrusted(request)) return status(403, invalidOrigin);
        const user = await getUser(request.headers);
        if (!user) return status(401, unauthorized);
        if (!(await canWrite(user.id))) return status(402, readOnly);
        return status(201, await recon.loadDemo(user.id));
      })
      // Public landing-page form. ponytail: no per-IP limit yet; add Upstash ratelimit before launch.
      .post(
        "/waitlist",
        async ({ request, body, status }) => {
          if (!isTrusted(request)) return status(403, invalidOrigin);
          if (!isWorkEmail(body.email)) {
            return status(422, {
              error: {
                code: "WORK_EMAIL_REQUIRED" as const,
                message: WORK_EMAIL_REQUIRED_MESSAGE,
              },
            });
          }
          await recon.joinWaitlist(body);
          return status(201, { joined: true as const });
        },
        {
          body: t.Object(
            {
              email: t.String({ format: "email", maxLength: 254 }),
              company: t.Optional(t.String({ maxLength: 160 })),
              seats: t.Optional(t.Integer({ minimum: 1, maximum: 1_000_000 })),
            },
            { additionalProperties: false },
          ),
        },
      )
  );
}
