import { createFileRoute } from "@tanstack/react-router";

// OAuth discovery for MCP clients lives at the site root:
// /.well-known/oauth-protected-resource[/api/mcp] and
// /.well-known/oauth-authorization-server[/api/auth]. Better Auth's mcp()
// plugin answers them.
async function discovery({ request }: { request: Request }) {
  const { getServerApi } = await import("../server/api");
  return getServerApi().discovery(request);
}

export const Route = createFileRoute("/.well-known/$")({
  server: { handlers: { GET: discovery, HEAD: discovery } },
});
