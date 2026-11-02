import type { QueryClient } from "@tanstack/react-query";

// Route guards load their auth, query and workspace code on demand: route
// options sit in the entry bundle that every page (marketing included) loads.

export async function requireSession(locationHref: string) {
  const guards = await import("./auth-guards");
  return guards.requireSession(locationHref);
}

export async function requireWorkspaceMember(
  locationHref: string,
  queryClient: QueryClient,
) {
  const guards = await import("./auth-guards");
  return guards.requireWorkspaceMember(locationHref, queryClient);
}
