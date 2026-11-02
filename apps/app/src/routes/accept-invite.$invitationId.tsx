import { Button } from "@seattrue/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { LoaderCircle } from "lucide-react";
import { AuthLayout } from "../components/auth-layout";
import { requireSession } from "../lib/auth-navigation";
import { getInvitation, useAcceptInvitation } from "../lib/workspace";

export const Route = createFileRoute("/accept-invite/$invitationId")({
  headers: () => ({ "Cache-Control": "private, no-store" }),
  // Signed-out invitees sign in (or sign up) and come straight back here.
  beforeLoad: ({ location }) => requireSession(location.href),
  head: () => ({
    meta: [
      { title: "Accept invitation · SeatTrue" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AcceptInvitePage,
});

function AcceptInvitePage() {
  const { invitationId } = Route.useParams();
  const { user } = Route.useRouteContext();
  const invitation = useQuery({
    queryKey: ["invitation", invitationId],
    queryFn: () => getInvitation(invitationId),
    retry: false,
  });
  const accept = useAcceptInvitation();

  async function join() {
    try {
      await accept.mutateAsync(invitationId);
      window.location.assign("/app");
    } catch {
      // Shown via accept.error.
    }
  }

  return (
    <AuthLayout>
      <div className="auth-intro auth-intro-standalone">
        <p className="auth-kicker">Invitation</p>
        {invitation.isPending && <p>Checking your invitation…</p>}
        {invitation.error && (
          <>
            <h1>This invitation can't be used</h1>
            <p>{invitation.error.message}</p>
            <p>
              You're signed in as {user.email}. Invitations work only for the
              address they were sent to, and expire after 48 hours. Ask for a
              new one if needed.
            </p>
            <Button asChild variant="outline">
              <Link to="/app">Go to my workspace</Link>
            </Button>
          </>
        )}
        {invitation.data && (
          <>
            <h1>Join {invitation.data.organizationName}</h1>
            <p>
              {invitation.data.inviterEmail} invited {invitation.data.email} as{" "}
              <strong>{invitation.data.role}</strong>.
            </p>
            {accept.error && (
              <p className="auth-form-error" role="alert">
                {accept.error.message}
              </p>
            )}
            <Button type="button" onClick={join} disabled={accept.isPending}>
              {accept.isPending && (
                <LoaderCircle size={16} className="spin" aria-hidden="true" />
              )}
              Accept and open workspace
            </Button>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
