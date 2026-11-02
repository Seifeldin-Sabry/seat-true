import { createAuthClient } from "better-auth/react";
import { appOrigin } from "./http-origin";

// Better Auth is served by the API at /api/auth/* on this same origin.
export const authClient = createAuthClient({
  baseURL: appOrigin(),
  fetchOptions: { credentials: "include" },
});
