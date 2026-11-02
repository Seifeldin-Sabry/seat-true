import { treaty } from "@elysia/eden";
import type { App } from "@seattrue/api/contract";
import { createIsomorphicFn } from "@tanstack/react-start";
import { httpOrigin } from "./http-origin";

const apiOrigin = createIsomorphicFn()
  .server(() =>
    httpOrigin(
      process.env.API_INTERNAL_ORIGIN || process.env.API_ORIGIN,
      "API_INTERNAL_ORIGIN or API_ORIGIN",
    ),
  )
  .client(() => httpOrigin(import.meta.env.VITE_API_ORIGIN, "VITE_API_ORIGIN"));

const requestHeaders = createIsomorphicFn()
  .server(async () => {
    const { getRequestHeaders } = await import("@tanstack/react-start/server");
    const cookie = getRequestHeaders().get("cookie");
    return {
      origin: httpOrigin(process.env.APP_ORIGIN, "APP_ORIGIN"),
      ...(cookie ? { cookie } : {}),
    };
  })
  .client(async () => ({}));

export async function getApiClient() {
  const headers = await requestHeaders();
  return treaty<App>(apiOrigin(), {
    fetch: { credentials: "include" },
    headers,
  });
}

export function apiErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object") {
    const value = "value" in error ? error.value : error;
    if (value && typeof value === "object") {
      const payload = "error" in value ? value.error : value;
      if (
        payload &&
        typeof payload === "object" &&
        "message" in payload &&
        typeof payload.message === "string"
      ) {
        return payload.message;
      }
    }
  }

  return fallback;
}
