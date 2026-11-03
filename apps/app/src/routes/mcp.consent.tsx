import { Button } from "@seattrue/ui";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AuthLayout } from "../components/auth-layout";
import { authClient } from "../lib/auth-client";
import { requireSession } from "../lib/auth-navigation";

/**
 * OAuth consent for MCP clients (Claude, Cursor, ...). Better Auth's mcp()
 * plugin sends the user here with a signed query; the auth client plugin
 * forwards it with the decision.
 */
export const Route = createFileRoute("/mcp/consent")({
  headers: () => ({ "Cache-Control": "private, no-store" }),
  validateSearch: (search: Record<string, unknown>) => ({
    client_id: typeof search.client_id === "string" ? search.client_id : "",
    scope: typeof search.scope === "string" ? search.scope : "",
  }),
  beforeLoad: ({ location }) => requireSession(location.href),
  head: () => ({
    meta: [
      { title: "Allow access · SeatTrue" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ConsentPage,
});

function ConsentPage() {
  const { user } = Route.useRouteContext();
  const { client_id: clientId } = Route.useSearch();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(accept: boolean) {
    setPending(true);
    setError(null);
    const { data, error: failure } = await authClient.$fetch<{
      url?: string;
      redirect_uri?: string;
    }>("/oauth2/consent", { method: "POST", body: { accept } });
    setPending(false);
    if (failure) {
      setError(failure.message ?? "Could not record your decision.");
      return;
    }
    const target = data?.url ?? data?.redirect_uri;
    if (target) window.location.assign(target);
  }

  let clientLabel = clientId;
  try {
    clientLabel = new URL(clientId).host;
  } catch {
    // Not a URL client id; show it as is.
  }

  return (
    <AuthLayout>
      <div className="auth-intro auth-intro-standalone">
        <p className="auth-kicker">Connect an AI assistant</p>
        <h1 id="auth-title">
          Allow {clientLabel || "this app"} to read your reconciliation?
        </h1>
        <p>
          Signed in as {user.email}. It gets read-only access to the leakage
          overview, exceptions, comments and client agreements your workspace
          already shows you. It can't change anything, and every request is in
          your audit log.
        </p>
        {error && (
          <p className="auth-form-error" role="alert">
            {error}
          </p>
        )}
        <div className="auth-actions">
          <Button
            type="button"
            size="lg"
            className="auth-submit"
            disabled={pending}
            onClick={() => decide(true)}
          >
            Allow read-only access
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => decide(false)}
          >
            Deny
          </Button>
        </div>
      </div>
    </AuthLayout>
  );
}
