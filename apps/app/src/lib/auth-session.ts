import { createServerFn } from "@tanstack/react-start";
import {
  getRequestHeaders,
  setResponseHeader,
} from "@tanstack/react-start/server";
import { getServerApi } from "../server/api";
import { appOrigin } from "./http-origin";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
};

function isSessionUser(value: unknown): value is SessionUser {
  if (!value || typeof value !== "object") return false;
  const user = value as Record<string, unknown>;
  return (
    typeof user.id === "string" &&
    typeof user.name === "string" &&
    typeof user.email === "string"
  );
}

export const getSessionUser = createServerFn({ method: "GET" }).handler(
  async (): Promise<SessionUser | null> => {
    setResponseHeader("Cache-Control", "private, no-store");
    // In-process call into the API's Better Auth handler; no HTTP hop.
    const cookie = getRequestHeaders().get("cookie");
    const response = await getServerApi().app.fetch(
      new Request(new URL("/api/auth/get-session", appOrigin()), {
        ...(cookie ? { headers: { cookie } } : {}),
      }),
    );

    if (response.status === 401) return null;
    if (!response.ok) {
      throw new Error("Authentication service is unavailable. Try again.");
    }

    const payload: unknown = await response.json();
    if (payload === null) return null;
    if (!payload || typeof payload !== "object" || !("user" in payload)) {
      throw new Error("Authentication service returned an invalid session.");
    }

    return isSessionUser(payload.user) ? payload.user : null;
  },
);
