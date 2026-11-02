import { treaty } from "@elysia/eden";
import type { App } from "@seattrue/api/contract";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { getServerApi } from "../server/api";
import { appOrigin } from "./http-origin";

/**
 * Eden client for the API under /api on this same origin. On the server it
 * calls Elysia in-process (no HTTP), forwarding the visitor's cookie so SSR
 * reads are authenticated; in the browser it is a same-origin fetch. The
 * TanStack Start compiler drops the server branch and its imports from the
 * browser bundle.
 *
 * Synchronous on purpose: `.api` is a proxy whose `then` would become a
 * request, so it must never be returned from an async function or awaited.
 */
export const getApiClient = createIsomorphicFn()
  .server(() => {
    const incoming = getRequestHeaders();
    const headers: Record<string, string> = { origin: appOrigin() };
    for (const name of ["cookie", "fly-client-ip"]) {
      const value = incoming.get(name);
      if (value) headers[name] = value;
    }
    return treaty<App>(getServerApi().app, { headers }).api;
  })
  .client(
    () => treaty<App>(appOrigin(), { fetch: { credentials: "include" } }).api,
  );

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
