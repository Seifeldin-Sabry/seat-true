import { type BillingService, canWrite } from "@seattrue/billing";
import { type Database, user } from "@seattrue/db";
import { type JobQueue, projectCreatedPayloadSchema } from "@seattrue/jobs";
import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import { type AuditLog, createAuditLog } from "./audit";
import { createAuditRequestRoutes } from "./audit-requests";
import type { AuthService } from "./auth";
import { createBillingRoutes } from "./billing";
import { createIntegrationWaitlistRoutes } from "./integration-waitlist";
import { jsonLogger, type Logger } from "./logger";
import { createMcpEndpoint, workspaceForUser } from "./mcp/server";
import { createMcpToolRunner } from "./mcp/tools";
import { createMembersRoutes } from "./members-routes";
import type { PlanLimits } from "./plan-limits";
import { createPlanRoutes } from "./plan-routes";
import type { ProjectRepository } from "./projects";
import { createReconRoutes } from "./recon-routes";
import type { ReconService } from "./reconciliation";
import { createRetentionRoutes, type Retention } from "./retention";
import { createWorkspaceGuard } from "./workspace";
import { createWorkspaceExportRoutes } from "./workspace-export";

export type { AuditDto } from "./audit";
export type { AuditRequestDto } from "./audit-requests";
export type { IntegrationWaitlistCountDto } from "./integration-waitlist";
export type { Logger } from "./logger";
export type { InvitationDto, MemberDto } from "./members-routes";
export type { DowngradePreflight } from "./plan-limits";
export type { ProjectDto } from "./projects";
export type {
  AgreementDto,
  AgreementLineInput,
  BilledSkuDto,
  BillingImportDto,
  BillingImportSummaryDto,
  ClientDetailDto,
  ClientSummaryDto,
  CommentDto,
  ExceptionDto,
  MappingsDto,
  OverviewDto,
  RunDto,
  UnmappedBillingClientDto,
  UnmappedCustomerDto,
} from "./reconciliation";

export type AppOptions = {
  projects: ProjectRepository;
  /** Backs /workspace, /members, /invitations and /audit. */
  db: Database;
  audit?: AuditLog;
  recon: ReconService;
  planLimits?: PlanLimits;
  auth: AuthService;
  billing?: BillingService | null;
  /** QStash queue whose signed callbacks land on POST /api/jobs/:name. */
  jobs?: Pick<JobQueue, "enabled" | "verify"> | null;
  /** Daily retention job behind POST /api/jobs/retention. */
  retention?: Retention | null;
  allowedOrigins: string[];
  getClientIp?: (request: Request) => string | null;
  /** SeatTrue staff emails (PLATFORM_ADMIN_EMAILS). Default: nobody. */
  platformAdminEmails?: readonly string[];
  logger?: Logger;
  onProjectCreated?: (event: {
    projectId: string;
    ownerId: string;
  }) => void | Promise<void>;
};

const nameSchema = t.String({ minLength: 1, maxLength: 120, pattern: "\\S" });
const descriptionSchema = t.Union([t.String({ maxLength: 500 }), t.Null()]);
const idSchema = t.Object({
  id: t.String({
    pattern:
      "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
  }),
});

export function createApp({
  projects,
  db,
  audit = createAuditLog(db),
  recon,
  planLimits,
  auth,
  billing,
  jobs,
  retention,
  allowedOrigins,
  getClientIp,
  platformAdminEmails = [],
  logger = jsonLogger,
  onProjectCreated,
}: AppOptions) {
  const guard = createWorkspaceGuard(auth);
  const serveMcp = createMcpEndpoint(createMcpToolRunner({ recon, audit }));
  const mcpRoute = auth.protectMcp?.(async (request, userId) => {
    const [member] = await db
      .select({ id: user.id, email: user.email, name: user.name })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    const workspace = member ? await workspaceForUser(db, member) : null;
    if (!workspace)
      return Response.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "This account has no SeatTrue workspace.",
          },
        },
        { status: 403 },
      );
    return serveMcp(request, workspace);
  });
  const canWriteWorkspace = billing
    ? async (organizationId: string) =>
        canWrite(await billing.access(organizationId))
    : undefined;
  const requestDetails = new WeakMap<
    Request,
    { id: string; startedAt: number }
  >();

  // Served by the app's /api/$ route on the same origin, so no CORS.
  return (
    new Elysia({ name: "seattrue-api", prefix: "/api" })
      .onRequest(({ request, set }) => {
        // Only Bun's socket address may populate the header consumed by Better Auth.
        request.headers.delete("x-real-ip");
        const clientIp = getClientIp?.(request);
        if (clientIp) request.headers.set("x-real-ip", clientIp);
        const id = crypto.randomUUID();
        requestDetails.set(request, { id, startedAt: performance.now() });
        set.headers["x-request-id"] = id;
      })
      .onError(({ code, error, request, status }) => {
        const requestId = requestDetails.get(request)?.id;

        if (code === "VALIDATION") {
          return status(422, {
            error: {
              code: "VALIDATION_ERROR",
              message: "Request failed validation.",
            },
          });
        }

        if (code === "PARSE") {
          return status(400, {
            error: {
              code: "INVALID_JSON",
              message: "Request body could not be parsed.",
            },
          });
        }

        if (code === "NOT_FOUND") {
          return status(404, {
            error: { code: "NOT_FOUND", message: "Route not found." },
          });
        }

        logger.error({
          event: "request_error",
          requestId,
          method: request.method,
          path: new URL(request.url).pathname,
          err: error,
        });
        return status(500, {
          error: {
            code: "INTERNAL_ERROR",
            message: "Unexpected server error.",
          },
        });
      })
      .onAfterResponse(({ request, set, responseValue }) => {
        const details = requestDetails.get(request);
        const status =
          responseValue instanceof Response
            ? responseValue.status
            : typeof set.status === "number"
              ? set.status
              : 200;
        logger.info({
          event: "request_complete",
          requestId: details?.id,
          method: request.method,
          path: new URL(request.url).pathname,
          status,
          durationMs: details
            ? Math.round(performance.now() - details.startedAt)
            : undefined,
        });
        requestDetails.delete(request);
      })
      .get("/auth/capabilities", () => ({
        emailEnabled: auth.emailEnabled,
        googleEnabled: auth.googleEnabled ?? false,
      }))
      .mount(auth.handler)
      .macro({
        auth: {
          async resolve({ status, request: { headers } }) {
            const current = await auth.getSession(headers);
            if (!current) {
              return status(401, {
                error: { code: "UNAUTHORIZED", message: "Sign in required." },
              });
            }
            return current;
          },
        },
      })
      .macro({
        mutationOrigin: {
          beforeHandle({ request, status }) {
            const origin = request.headers.get("origin");
            if (!origin || !allowedOrigins.includes(origin)) {
              return status(403, {
                error: {
                  code: "INVALID_ORIGIN",
                  message: "Origin not allowed.",
                },
              });
            }
          },
        },
      })
      .use(
        createBillingRoutes({
          billing: billing ?? null,
          allowedOrigins,
          guard,
        }),
      )
      .use(
        createReconRoutes({
          recon,
          allowedOrigins,
          ...(canWriteWorkspace ? { canWrite: canWriteWorkspace } : {}),
          ...(planLimits
            ? { assertCanAddClient: planLimits.assertCanAddClient }
            : {}),
          guard,
        }),
      )
      .use(
        createIntegrationWaitlistRoutes({
          db,
          auth,
          platformAdminEmails,
          allowedOrigins,
        }),
      )
      .use(
        createAuditRequestRoutes({
          db,
          auth,
          platformAdminEmails,
          allowedOrigins,
        }),
      )
      .use(
        createPlanRoutes({
          billing: billing ?? null,
          planLimits: planLimits ?? null,
          audit,
          allowedOrigins,
          guard,
        }),
      )
      .use(
        createMembersRoutes({
          db,
          auth,
          guard,
          audit,
          ...(canWriteWorkspace ? { canWrite: canWriteWorkspace } : {}),
          allowedOrigins,
          platformAdminEmails,
        }),
      )
      // Read-only MCP server (OAuth bearer tokens from the mcp() plugin).
      .post(
        "/mcp",
        ({ request, status }) =>
          mcpRoute
            ? mcpRoute(request)
            : status(503, {
                error: {
                  code: "MCP_NOT_CONFIGURED" as const,
                  message: "The MCP server is not available.",
                },
              }),
        { parse: "none" },
      )
      .get("/health", () => ({ status: "ok" as const }))
      .use(createRetentionRoutes({ jobs, retention }))
      .use(createWorkspaceExportRoutes({ db, guard }))
      .post(
        "/jobs/project-created",
        async ({ request, status }) => {
          if (!jobs?.enabled) {
            return status(503, {
              error: {
                code: "JOBS_NOT_CONFIGURED",
                message: "Jobs are not configured for this deployment.",
              },
            });
          }
          const body = await request.text();
          const signature = request.headers.get("upstash-signature");
          if (
            !signature ||
            !(await jobs.verify("project-created", signature, body))
          ) {
            return status(401, {
              error: {
                code: "INVALID_JOB_SIGNATURE",
                message: "Job signature verification failed.",
              },
            });
          }
          const payload = projectCreatedPayloadSchema.safeParse(
            parseJson(body),
          );
          if (!payload.success) {
            // Non-2xx makes QStash retry, then park the message in its DLQ.
            return status(422, {
              error: {
                code: "INVALID_JOB_PAYLOAD",
                message: "Job payload failed validation.",
              },
            });
          }
          // Re-read committed state: the project may have changed or been deleted.
          const project = await projects.find(
            payload.data.ownerId,
            payload.data.projectId,
          );
          logger.info({
            event: project
              ? "project_job_processed"
              : "project_job_target_missing",
            projectId: payload.data.projectId,
          });
          return { received: true as const };
        },
        { parse: "none" },
      )
      .get(
        "/projects",
        async ({ user }) => ({ projects: await projects.list(user.id) }),
        { auth: true },
      )
      .get(
        "/projects/:id",
        async ({ params, status, user }) => {
          const project = await projects.find(user.id, params.id);
          if (!project) {
            return status(404, {
              error: {
                code: "PROJECT_NOT_FOUND",
                message: "Project not found.",
              },
            });
          }
          return project;
        },
        { params: idSchema, auth: true },
      )
      .post(
        "/projects",
        async ({ body, status, user }) => {
          const project = await projects.create(user.id, body);
          try {
            await onProjectCreated?.({
              projectId: project.id,
              ownerId: user.id,
            });
          } catch (err) {
            logger.warn({
              event: "project_job_enqueue_failed",
              projectId: project.id,
              err,
            });
          }
          return status(201, project);
        },
        {
          body: t.Object(
            {
              name: nameSchema,
              description: t.Optional(descriptionSchema),
            },
            { additionalProperties: false },
          ),
          auth: true,
          mutationOrigin: true,
        },
      )
      .patch(
        "/projects/:id",
        async ({ params, body, status, user }) => {
          const project = await projects.update(user.id, params.id, body);
          if (!project) {
            return status(404, {
              error: {
                code: "PROJECT_NOT_FOUND",
                message: "Project not found.",
              },
            });
          }
          return project;
        },
        {
          params: idSchema,
          body: t.Object(
            {
              name: t.Optional(nameSchema),
              description: t.Optional(descriptionSchema),
            },
            { minProperties: 1, additionalProperties: false },
          ),
          auth: true,
          mutationOrigin: true,
        },
      )
      .delete(
        "/projects/:id",
        async ({ params, status, user }) => {
          const removed = await projects.remove(user.id, params.id);
          if (!removed) {
            return status(404, {
              error: {
                code: "PROJECT_NOT_FOUND",
                message: "Project not found.",
              },
            });
          }
          return { success: true as const };
        },
        { params: idSchema, auth: true, mutationOrigin: true },
      )
  );
}

function parseJson(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

export type App = ReturnType<typeof createApp>;
