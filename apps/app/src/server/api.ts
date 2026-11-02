import { createServerApp, type ServerApp } from "@seattrue/api";
import { getRequestIP } from "@tanstack/react-start/server";

let serverApp: ServerApp | undefined;

/**
 * The Elysia API, built once per server process on first use. Server-only:
 * import it dynamically from isomorphic code so it never reaches the browser.
 */
export function getServerApi(): ServerApp {
  serverApp ??= createServerApp({
    env: process.env,
    getSocketIp: () => {
      try {
        return getRequestIP();
      } catch {
        // Outside a TanStack request context (no socket to read).
        return null;
      }
    },
  });
  return serverApp;
}
