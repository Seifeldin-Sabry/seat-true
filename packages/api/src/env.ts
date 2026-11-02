import type { LogLevel } from "./logger";

export type ApiEnvironment = {
  databaseUrl: string;
  /** Public origin of the app; the API lives under /api on it. */
  appOrigin: string;
  authSecret: string;
  allowedOrigins: string[];
  logLevel: LogLevel;
  google?: { clientId: string; clientSecret: string };
};

export function readApiEnvironment(
  env: Record<string, string | undefined>,
): ApiEnvironment {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");

  let databaseProtocol: string;
  try {
    databaseProtocol = new URL(databaseUrl).protocol;
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL connection URL");
  }
  if (!["postgres:", "postgresql:"].includes(databaseProtocol)) {
    throw new Error("DATABASE_URL must use postgres:// or postgresql://");
  }

  const appOrigin = env.APP_ORIGIN?.trim();
  if (!appOrigin) throw new Error("APP_ORIGIN is required");
  assertOrigin(appOrigin, "APP_ORIGIN");
  const appUrl = new URL(appOrigin);
  if (
    env.NODE_ENV === "production" &&
    appUrl.protocol !== "https:" &&
    !["localhost", "127.0.0.1", "[::1]"].includes(appUrl.hostname)
  ) {
    throw new Error("Production APP_ORIGIN must use HTTPS");
  }

  const authSecret = env.BETTER_AUTH_SECRET;
  if (!authSecret || authSecret.length < 32) {
    throw new Error("BETTER_AUTH_SECRET must contain at least 32 characters");
  }
  if (
    env.NODE_ENV === "production" &&
    authSecret === "local-only-better-auth-secret-1234567890"
  ) {
    throw new Error("Replace local-only BETTER_AUTH_SECRET before production");
  }

  const logLevel = env.LOG_LEVEL || "info";
  if (!isLogLevel(logLevel)) {
    throw new Error(
      "LOG_LEVEL must be trace, debug, info, warn, error, fatal, or silent",
    );
  }

  const googleClientId = env.GOOGLE_CLIENT_ID?.trim();
  const googleClientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  if (Boolean(googleClientId) !== Boolean(googleClientSecret)) {
    throw new Error(
      "Set both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or neither",
    );
  }

  return {
    databaseUrl,
    authSecret,
    // The API is served from the app's own origin, so it is the only one
    // trusted for cookie-carrying writes.
    allowedOrigins: [appOrigin],
    appOrigin,
    logLevel,
    ...(googleClientId && googleClientSecret
      ? {
          google: {
            clientId: googleClientId,
            clientSecret: googleClientSecret,
          },
        }
      : {}),
  };
}

function isLogLevel(value: string): value is ApiEnvironment["logLevel"] {
  return [
    "trace",
    "debug",
    "info",
    "warn",
    "error",
    "fatal",
    "silent",
  ].includes(value);
}

function assertOrigin(origin: string, name: string) {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    throw new Error(`${name} must be an exact HTTP(S) origin: ${origin}`);
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.origin !== origin ||
    url.username ||
    url.password
  ) {
    throw new Error(`${name} must be an exact HTTP(S) origin: ${origin}`);
  }
}
