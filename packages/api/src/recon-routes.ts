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
import type { Workspace, WorkspaceGuard } from "./workspace";

export type ReconRoutesOptions = {
  recon: ReconService;
  /** False when the workspace's subscription has lapsed (read-only, nothing deleted). */
  canWrite?: (organizationId: string) => Promise<boolean>;
  /** Throws PlanLimitError when another active client would exceed the plan. */
  assertCanAddClient?: (organizationId: string) => Promise<void>;
  guard: WorkspaceGuard;
  allowedOrigins: string[];
};

const actorOf = (workspace: Workspace) => ({
  userId: workspace.user.id,
  email: workspace.user.email,
});
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
function invalidCsv(error: CsvRejectedError) {
  return {
    error: {
      code: "INVALID_CSV" as const,
      message: error.message,
      rows: error.rows,
    },
  };
}
const uuidPattern =
  "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$";
const idParams = t.Object({ id: t.String({ pattern: uuidPattern }) });
/** ~2 MB of CSV covers thousands of subscription lines. */
const maxCsvLength = 2_000_000;
const csvUpload = t.Object(
  {
    fileName: t.String({ minLength: 1, maxLength: 255, pattern: "\\S" }),
    csv: t.String({ minLength: 1, maxLength: maxCsvLength }),
  },
  { additionalProperties: false },
);

export function createReconRoutes({
  recon,
  canWrite = async () => true,
  assertCanAddClient = async () => {},
  guard,
  allowedOrigins,
}: ReconRoutesOptions) {
  const trustedOrigins = new Set(allowedOrigins);
  const isTrusted = (request: Request) =>
    trustedOrigins.has(request.headers.get("origin") ?? "");
  const exceptionNotFound = {
    error: {
      code: "EXCEPTION_NOT_FOUND" as const,
      message: "Exception not found.",
    },
  };
  const clientNotFound = {
    error: { code: "CLIENT_NOT_FOUND" as const, message: "Client not found." },
  };

  return (
    new Elysia({ name: "recon-routes" })
      .get("/recon/overview", async ({ request, status }) => {
        const access = await guard(request.headers);
        if (!access.ok) return status(access.status, access.body);
        return recon.overview(access.workspace.organizationId);
      })
      .get(
        "/recon/clients/:id",
        async ({ request, params, status }) => {
          const access = await guard(request.headers);
          if (!access.ok) return status(access.status, access.body);
          const detail = await recon.client(
            access.workspace.organizationId,
            params.id,
          );
          if (!detail) return status(404, clientNotFound);
          return detail;
        },
        { params: idParams },
      )
      .get("/recon/exceptions", async ({ request, status }) => {
        const access = await guard(request.headers);
        if (!access.ok) return status(access.status, access.body);
        return {
          exceptions: await recon.exceptions(access.workspace.organizationId),
        };
      })
      .patch(
        "/recon/exceptions/:id",
        async ({ request, params, body, status }) => {
          if (!isTrusted(request)) return status(403, invalidOrigin);
          const access = await guard(request.headers, {
            exception: ["resolve"],
          });
          if (!access.ok) return status(access.status, access.body);
          const { workspace } = access;
          if (!(await canWrite(workspace.organizationId)))
            return status(402, readOnly);
          let updated: Awaited<ReturnType<ReconService["setExceptionStatus"]>>;
          try {
            updated = await recon.setExceptionStatus(
              workspace.organizationId,
              params.id,
              body.status,
              actorOf(workspace),
            );
          } catch (error) {
            if (error instanceof ClientLockedError)
              return status(423, clientLocked(error));
            throw error;
          }
          if (!updated) return status(404, exceptionNotFound);
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
      .put(
        "/recon/exceptions/:id/flag",
        async ({ request, params, body, status }) => {
          if (!isTrusted(request)) return status(403, invalidOrigin);
          const access = await guard(request.headers, { exception: ["flag"] });
          if (!access.ok) return status(access.status, access.body);
          const { workspace } = access;
          if (!(await canWrite(workspace.organizationId)))
            return status(402, readOnly);
          let updated: Awaited<ReturnType<ReconService["setExceptionFlag"]>>;
          try {
            updated = await recon.setExceptionFlag(
              workspace.organizationId,
              params.id,
              body.flagged,
              actorOf(workspace),
            );
          } catch (error) {
            if (error instanceof ClientLockedError)
              return status(423, clientLocked(error));
            throw error;
          }
          if (!updated) return status(404, exceptionNotFound);
          return updated;
        },
        {
          params: idParams,
          body: t.Object(
            { flagged: t.Boolean() },
            { additionalProperties: false },
          ),
        },
      )
      .get(
        "/recon/exceptions/:id/comments",
        async ({ request, params, status }) => {
          const access = await guard(request.headers);
          if (!access.ok) return status(access.status, access.body);
          const comments = await recon.comments(
            access.workspace.organizationId,
            params.id,
          );
          if (!comments) return status(404, exceptionNotFound);
          return { comments };
        },
        { params: idParams },
      )
      .post(
        "/recon/exceptions/:id/comments",
        async ({ request, params, body, status }) => {
          if (!isTrusted(request)) return status(403, invalidOrigin);
          const access = await guard(request.headers, {
            exception: ["comment"],
          });
          if (!access.ok) return status(access.status, access.body);
          const { workspace } = access;
          if (!(await canWrite(workspace.organizationId)))
            return status(402, readOnly);
          let comment: Awaited<ReturnType<ReconService["addComment"]>>;
          try {
            comment = await recon.addComment(
              workspace.organizationId,
              params.id,
              body.body.trim(),
              actorOf(workspace),
            );
          } catch (error) {
            if (error instanceof ClientLockedError)
              return status(423, clientLocked(error));
            throw error;
          }
          if (!comment) return status(404, exceptionNotFound);
          return status(201, comment);
        },
        {
          params: idParams,
          body: t.Object(
            {
              body: t.String({ minLength: 1, maxLength: 2000, pattern: "\\S" }),
            },
            { additionalProperties: false },
          ),
        },
      )
      .get("/recon/mappings", async ({ request, status }) => {
        const access = await guard(request.headers);
        if (!access.ok) return status(access.status, access.body);
        return recon.mappings(access.workspace.organizationId);
      })
      .put(
        "/recon/mappings",
        async ({ request, body, status }) => {
          if (!isTrusted(request)) return status(403, invalidOrigin);
          const access = await guard(request.headers, { mapping: ["edit"] });
          if (!access.ok) return status(access.status, access.body);
          const { workspace } = access;
          if (!(await canWrite(workspace.organizationId)))
            return status(402, readOnly);
          let saved: boolean;
          try {
            saved = await recon.setMapping(
              workspace.organizationId,
              body.customerKey.trim(),
              body.clientId,
              actorOf(workspace),
            );
          } catch (error) {
            if (error instanceof ClientLockedError)
              return status(423, clientLocked(error));
            throw error;
          }
          if (!saved) return status(404, clientNotFound);
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
          const access = await guard(request.headers, { run: ["upload"] });
          if (!access.ok) return status(access.status, access.body);
          const { organizationId } = access.workspace;
          if (!(await canWrite(organizationId))) return status(402, readOnly);
          try {
            return status(
              201,
              await recon.uploadRun(
                organizationId,
                body.fileName.trim(),
                body.csv,
              ),
            );
          } catch (error) {
            if (error instanceof CsvRejectedError)
              return status(422, invalidCsv(error));
            throw error;
          }
        },
        { body: csvUpload },
      )
      // Client billing CSV (the billed side). Same permission as the Pax8 upload.
      .post(
        "/recon/billing",
        async ({ request, body, status }) => {
          if (!isTrusted(request)) return status(403, invalidOrigin);
          const access = await guard(request.headers, { run: ["upload"] });
          if (!access.ok) return status(access.status, access.body);
          const { workspace } = access;
          if (!(await canWrite(workspace.organizationId)))
            return status(402, readOnly);
          try {
            return status(
              201,
              await recon.importBilling(
                workspace.organizationId,
                body.fileName.trim(),
                body.csv,
                actorOf(workspace),
              ),
            );
          } catch (error) {
            if (error instanceof CsvRejectedError)
              return status(422, invalidCsv(error));
            throw error;
          }
        },
        { body: csvUpload },
      )
      .put(
        "/recon/billing/mappings",
        async ({ request, body, status }) => {
          if (!isTrusted(request)) return status(403, invalidOrigin);
          const access = await guard(request.headers, { mapping: ["edit"] });
          if (!access.ok) return status(access.status, access.body);
          const { workspace } = access;
          if (!(await canWrite(workspace.organizationId)))
            return status(402, readOnly);
          let saved: boolean;
          try {
            saved = await recon.mapBillingClient(
              workspace.organizationId,
              body.clientName.trim(),
              body.clientId,
              actorOf(workspace),
            );
          } catch (error) {
            if (error instanceof ClientLockedError)
              return status(423, clientLocked(error));
            throw error;
          }
          if (!saved) return status(404, clientNotFound);
          return { success: true as const };
        },
        {
          body: t.Object(
            {
              clientName: t.String({
                minLength: 1,
                maxLength: 160,
                pattern: "\\S",
              }),
              clientId: t.String({ pattern: uuidPattern }),
            },
            { additionalProperties: false },
          ),
        },
      )
      .put(
        "/recon/sku-aliases",
        async ({ request, body, status }) => {
          if (!isTrusted(request)) return status(403, invalidOrigin);
          const access = await guard(request.headers, { mapping: ["edit"] });
          if (!access.ok) return status(access.status, access.body);
          const { workspace } = access;
          if (!(await canWrite(workspace.organizationId)))
            return status(402, readOnly);
          await recon.setSkuAlias(
            workspace.organizationId,
            body.alias.trim(),
            body.sku.trim(),
            actorOf(workspace),
          );
          return { success: true as const };
        },
        {
          body: t.Object(
            {
              alias: t.String({
                minLength: 1,
                maxLength: 200,
                pattern: "[A-Za-z0-9]",
              }),
              // "" = not a distributor product: leave those billed lines out.
              sku: t.String({ maxLength: 64 }),
            },
            { additionalProperties: false },
          ),
        },
      )
      .put(
        "/recon/clients/:id/agreements",
        async ({ request, params, body, status }) => {
          if (!isTrusted(request)) return status(403, invalidOrigin);
          const access = await guard(request.headers, { run: ["upload"] });
          if (!access.ok) return status(access.status, access.body);
          const { workspace } = access;
          if (!(await canWrite(workspace.organizationId)))
            return status(402, readOnly);
          const skus = body.lines.map((line) => line.sku.trim());
          if (new Set(skus).size !== skus.length)
            return status(422, {
              error: {
                code: "DUPLICATE_SKU" as const,
                message: "Each SKU can appear once per client.",
              },
            });
          let saved: Awaited<ReturnType<ReconService["setAgreementLines"]>>;
          try {
            saved = await recon.setAgreementLines(
              workspace.organizationId,
              params.id,
              body.lines,
              actorOf(workspace),
            );
          } catch (error) {
            if (error instanceof ClientLockedError)
              return status(423, clientLocked(error));
            throw error;
          }
          if (!saved) return status(404, clientNotFound);
          return { agreements: saved };
        },
        {
          params: idParams,
          body: t.Object(
            {
              lines: t.Array(
                t.Object(
                  {
                    sku: t.String({
                      minLength: 1,
                      maxLength: 64,
                      pattern: "\\S",
                    }),
                    productName: t.Optional(t.String({ maxLength: 200 })),
                    quantity: t.Integer({ minimum: 0, maximum: 1_000_000 }),
                    unitPriceCents: t.Integer({
                      minimum: 0,
                      maximum: 100_000_000,
                    }),
                  },
                  { additionalProperties: false },
                ),
                { maxItems: 500 },
              ),
            },
            { additionalProperties: false },
          ),
        },
      )
      .post(
        "/recon/clients",
        async ({ request, body, status }) => {
          if (!isTrusted(request)) return status(403, invalidOrigin);
          // Creating sets a markup, so it needs the markup permission too.
          const access = await guard(request.headers, {
            client: ["create", "markup"],
          });
          if (!access.ok) return status(access.status, access.body);
          const { organizationId } = access.workspace;
          if (!(await canWrite(organizationId))) return status(402, readOnly);
          try {
            await assertCanAddClient(organizationId);
          } catch (error) {
            if (error instanceof PlanLimitError)
              return status(402, planLimit(error));
            throw error;
          }
          return status(201, await recon.createClient(organizationId, body));
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
          const access = await guard(request.headers, {
            client: [
              ...(body.archived !== undefined ? (["archive"] as const) : []),
              ...(body.markupPct !== undefined ? (["markup"] as const) : []),
            ],
          });
          if (!access.ok) return status(access.status, access.body);
          const { workspace } = access;
          const { organizationId } = workspace;
          if (!(await canWrite(organizationId))) return status(402, readOnly);
          let updated: Awaited<ReturnType<ReconService["setArchived"]>> = null;
          if (body.archived !== undefined) {
            if (!body.archived) {
              try {
                await assertCanAddClient(organizationId);
              } catch (error) {
                if (error instanceof PlanLimitError)
                  return status(402, planLimit(error));
                throw error;
              }
            }
            updated = await recon.setArchived(
              organizationId,
              params.id,
              body.archived,
            );
            if (!updated) return status(404, clientNotFound);
          }
          if (body.markupPct !== undefined) {
            try {
              updated = await recon.setMarkup(
                organizationId,
                params.id,
                body.markupPct,
                actorOf(workspace),
              );
            } catch (error) {
              if (error instanceof ClientLockedError)
                return status(423, clientLocked(error));
              throw error;
            }
          }
          if (!updated) return status(404, clientNotFound);
          return updated;
        },
        {
          params: idParams,
          body: t.Object(
            {
              archived: t.Optional(t.Boolean()),
              markupPct: t.Optional(t.Number({ minimum: 0, maximum: 500 })),
            },
            { additionalProperties: false, minProperties: 1 },
          ),
        },
      )
      .post("/recon/demo", async ({ request, status }) => {
        if (!isTrusted(request)) return status(403, invalidOrigin);
        // The demo replaces the workspace's data, so only the owner may load it.
        const access = await guard(request.headers, { run: ["demo"] });
        if (!access.ok) return status(access.status, access.body);
        const { organizationId } = access.workspace;
        if (!(await canWrite(organizationId))) return status(402, readOnly);
        return status(201, await recon.loadDemo(organizationId));
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
