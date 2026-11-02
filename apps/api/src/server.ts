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

const environment = readApiEnvironment(process.env);
const logger = createLogger(environment.logLevel);
const billingEnvironment = readBillingEnvironment(process.env);
const cache = createCache({ env: process.env });
const email = createEmailService({ env: process.env });
const jobs = createJobQueue({
  apiOrigin: environment.apiOrigin,
  env: process.env,
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
const behindFlyProxy = Boolean(process.env.FLY_APP_NAME);
let app: ReturnType<typeof createApp> | undefined;
const auth = createAuthService(connection.db, {
  apiOrigin: environment.apiOrigin,
  secret: environment.authSecret,
  trustedOrigins: environment.allowedOrigins,
  ...(environment.authCookieDomain
    ? { cookieDomain: environment.authCookieDomain }
    : {}),
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
app = createApp({
  projects: createProjectRepository(connection.db),
  db: connection.db,
  audit,
  recon,
  planLimits,
  billing,
  jobs,
  auth,
  allowedOrigins: environment.allowedOrigins,
  getClientIp: (request) =>
    (behindFlyProxy ? request.headers.get("fly-client-ip") : null) ??
    app?.server?.requestIP(request)?.address ??
    null,
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

app.listen({ hostname: environment.host, port: environment.port });
logger.info({
  event: "server_started",
  host: environment.host,
  port: environment.port,
  integrations: {
    billing: Boolean(billing),
    cache: cache.enabled,
    email: email.enabled,
    jobs: jobs.enabled,
  },
});

let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info({ event: "server_stopping", signal });
  try {
    await app?.server?.stop();
    await connection.close();
    logger.info({ event: "server_stopped" });
  } catch (error) {
    logger.error({
      event: "shutdown_error",
      err: error,
    });
    process.exitCode = 1;
  }
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
