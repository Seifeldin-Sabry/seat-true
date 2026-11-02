import {
  createBillingService,
  readBillingEnvironment,
} from "@seattrue/billing";
import { createCache } from "@seattrue/cache";
import { createDatabase } from "@seattrue/db";
import { createEmailService } from "@seattrue/email";
import { createJobQueue } from "@seattrue/jobs";
import { createApp } from "./app";
import { createAuditLog } from "./audit";
import { createAuthService } from "./auth";
import { readApiEnvironment } from "./env";
import { createLogger } from "./logger";
import { createPlanLimits, type PlanLimits } from "./plan-limits";
import { createProjectRepository } from "./projects";
import { createReconService } from "./reconciliation";

export type ServerAppOptions = {
  env: Record<string, string | undefined>;
  /** Socket address of the caller, when the host runtime exposes it. */
  getSocketIp?: (request: Request) => string | null | undefined;
};

/**
 * Wires every service from the environment into the Elysia app. The host
 * (TanStack Start's /api/$ route) calls this once and forwards requests to
 * `app.fetch`.
 */
export function createServerApp({ env, getSocketIp }: ServerAppOptions) {
  const environment = readApiEnvironment(env);
  const logger = createLogger(environment.logLevel);
  const billingEnvironment = readBillingEnvironment(env);
  const cache = createCache({ env });
  const email = createEmailService({ env });
  const jobs = createJobQueue({
    // QStash calls back on the app origin, where /api/jobs/* is served.
    apiOrigin: `${environment.appOrigin}/api`,
    env,
  });
  const connection = createDatabase(environment.databaseUrl);
  const recon = createReconService(connection.db);
  const audit = createAuditLog(connection.db);
  // Billing's webhook hook and plan limits reference each other; wire lazily.
  let planLimits: PlanLimits | undefined;
  const billing = billingEnvironment
    ? createBillingService(connection.db, billingEnvironment, undefined, {
        onSubscriptionState: async (state) => {
          await planLimits?.onSubscriptionState(state);
        },
      })
    : null;
  planLimits = createPlanLimits({
    db: connection.db,
    recon,
    billing,
    email,
    logger,
  });
  // On Fly the socket peer is Fly's proxy, which sets Fly-Client-IP itself.
  const behindFlyProxy = Boolean(env.FLY_APP_NAME);
  const clientIp = (request: Request) =>
    (behindFlyProxy ? request.headers.get("fly-client-ip") : null) ??
    getSocketIp?.(request) ??
    null;
  const auth = createAuthService(connection.db, {
    baseURL: environment.appOrigin,
    secret: environment.authSecret,
    trustedOrigins: environment.allowedOrigins,
    ...(cache.enabled ? { secondaryStorage: cache.secondaryStorage } : {}),
    getClientIp: (request) => request.headers.get("x-real-ip"),
    email,
    logger,
    ...(environment.google ? { google: environment.google } : {}),
    appOrigin: environment.appOrigin,
    seats: {
      assertCanInvite: planLimits.assertCanInvite,
      assertCanJoin: planLimits.assertCanJoin,
    },
  });
  const app = createApp({
    projects: createProjectRepository(connection.db),
    db: connection.db,
    audit,
    recon,
    planLimits,
    billing,
    jobs,
    auth,
    allowedOrigins: environment.allowedOrigins,
    getClientIp: clientIp,
    platformAdminEmails: environment.platformAdminEmails,
    logger,
    ...(jobs.enabled
      ? {
          onProjectCreated: async (event: {
            projectId: string;
            ownerId: string;
          }) => {
            const result = await jobs.publishProjectCreated(event);
            if (result.status === "queued") {
              logger.info({
                event: "project_job_enqueued",
                projectId: event.projectId,
                messageId: result.messageId,
              });
            }
          },
        }
      : {}),
  });

  logger.info({
    event: "api_ready",
    integrations: {
      billing: Boolean(billing),
      cache: cache.enabled,
      email: email.enabled,
      jobs: jobs.enabled,
    },
  });

  return { app, logger, close: () => connection.close() };
}

export type ServerApp = ReturnType<typeof createServerApp>;
