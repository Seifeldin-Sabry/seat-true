import { Elysia, t } from "elysia";
import { CsvRejectedError, type ReconService } from "./reconciliation";

type ReconUser = { id: string };

export type ReconRoutesOptions = {
  recon: ReconService;
  getUser: (headers: Headers) => Promise<ReconUser | null>;
  allowedOrigins: string[];
};

const unauthorized = {
  error: { code: "UNAUTHORIZED" as const, message: "Sign in required." },
};
const invalidOrigin = {
  error: { code: "INVALID_ORIGIN" as const, message: "Origin not allowed." },
};
const uuidPattern =
  "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$";
const idParams = t.Object({ id: t.String({ pattern: uuidPattern }) });
/** ~2 MB of CSV covers thousands of subscription lines. */
const maxCsvLength = 2_000_000;

export function createReconRoutes({
  recon,
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
          const updated = await recon.setExceptionStatus(
            user.id,
            params.id,
            body.status,
          );
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
          const saved = await recon.setMapping(
            user.id,
            body.customerKey.trim(),
            body.clientId,
          );
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
      .post("/recon/demo", async ({ request, status }) => {
        if (!isTrusted(request)) return status(403, invalidOrigin);
        const user = await getUser(request.headers);
        if (!user) return status(401, unauthorized);
        return status(201, await recon.loadDemo(user.id));
      })
      // Public landing-page form. ponytail: no per-IP limit yet; add Upstash ratelimit before launch.
      .post(
        "/waitlist",
        async ({ request, body, status }) => {
          if (!isTrusted(request)) return status(403, invalidOrigin);
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
