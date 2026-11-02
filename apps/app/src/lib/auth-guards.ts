import type { QueryClient } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";
import { getSessionUser } from "./auth-session";
import { normalizeReturnTo } from "./safe-return";
import { workspaceQueryOptions } from "./workspace";

export async function requireSession(locationHref: string) {
  const user = await getSessionUser();
  if (!user) {
    throw redirect({
      to: "/login",
      search: { redirect: normalizeReturnTo(locationHref) },
    });
  }
  return { user };
}

/** App pages: session required, and the member's role is loaded before render so role-gated controls don't flash. */
export async function requireWorkspaceMember(
  locationHref: string,
  queryClient: QueryClient,
) {
  const session = await requireSession(locationHref);
  await queryClient.prefetchQuery(workspaceQueryOptions);
  return session;
}
