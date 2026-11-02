import { Badge, Button, Input, Label } from "@seattrue/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { LoaderCircle, UserPlus } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { AppShell } from "../components/app-shell";
import { requireSession } from "../lib/auth-navigation";
import {
  type InvitableRole,
  membersQueryOptions,
  useCan,
  useCancelInvite,
  useChangeRole,
  useInvite,
  useRemoveMember,
} from "../lib/workspace";

export const Route = createFileRoute("/app/members")({
  headers: () => ({ "Cache-Control": "private, no-store" }),
  beforeLoad: ({ location }) => requireSession(location.href),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(membersQueryOptions),
  component: MembersPage,
});

const roleDescriptions: Record<string, string> = {
  owner: "Billing, plan, markups, people and everything else",
  admin: "Resolves exceptions, edits mappings, invites people",
  tech: "Sees everything, imports bills, flags and comments",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function MembersPage() {
  const { user } = Route.useRouteContext();
  const members = useQuery(membersQueryOptions);
  const can = useCan();
  const invite = useInvite();
  const cancelInvite = useCancelInvite();
  const changeRole = useChangeRole();
  const remove = useRemoveMember();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<InvitableRole>("tech");
  const [notice, setNotice] = useState<string | null>(null);
  const data = members.data;
  const seats = data?.seats;
  const full = seats?.limit != null && seats.used >= seats.limit;
  const error =
    invite.error ?? cancelInvite.error ?? changeRole.error ?? remove.error;

  async function sendInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    try {
      await invite.mutateAsync({ email: email.trim(), role });
      setNotice(`Invite sent to ${email.trim()}. It expires in 48 hours.`);
      setEmail("");
    } catch {
      // Shown via invite.error.
    }
  }

  return (
    <AppShell userName={user.name}>
      <main className="app-content">
        <section className="page-heading" aria-labelledby="members-title">
          <div className="page-heading-copy">
            <div className="eyebrow">Workspace / Members</div>
            <h1 id="members-title">Members</h1>
            <p>
              {seats
                ? `${seats.used} of ${seats.limit ?? "unlimited"} seats in use, pending invites included.`
                : "Who can see and change this workspace."}
            </p>
          </div>
        </section>

        {notice && (
          <div className="notice-banner" role="status">
            <span>{notice}</span>
          </div>
        )}
        {error && (
          <div className="error-banner" role="alert">
            <div>
              <strong>That didn't work</strong>
              <p>{error.message}</p>
            </div>
            {error.message.includes("Upgrade") && (
              <Link to="/app/billing">See plans</Link>
            )}
          </div>
        )}

        {can("invitation", "create") && (
          <section className="recon-panel" aria-labelledby="invite-title">
            <h2 id="invite-title">Invite someone</h2>
            <p>Work email only. They sign up or sign in, then accept.</p>
            {full ? (
              <p>
                Every seat on your plan is taken.{" "}
                <Link to="/app/billing">Upgrade to Team</Link> for unlimited
                users.
              </p>
            ) : (
              <form className="inline-form" onSubmit={sendInvite}>
                <div className="field-group">
                  <Label htmlFor="invite-email">Email</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    required
                    autoComplete="off"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>
                <div className="field-group">
                  <Label htmlFor="invite-role">Role</Label>
                  <select
                    id="invite-role"
                    value={role}
                    onChange={(event) =>
                      setRole(event.target.value as InvitableRole)
                    }
                  >
                    <option value="tech">Tech</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <Button type="submit" disabled={invite.isPending}>
                  {invite.isPending ? (
                    <LoaderCircle
                      size={16}
                      className="spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <UserPlus size={16} aria-hidden="true" />
                  )}
                  Send invite
                </Button>
              </form>
            )}
          </section>
        )}

        <div className="recon-table-wrap" style={{ marginTop: 16 }}>
          <table className="recon-table">
            <thead>
              <tr>
                <th scope="col">Person</th>
                <th scope="col">Role</th>
                <th scope="col">Last active</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data?.members.map((entry) => (
                <tr
                  key={entry.id}
                  className={entry.suspended ? "is-resolved" : undefined}
                >
                  <td>
                    <div>
                      {entry.name || entry.email}
                      {entry.isYou && " (you)"}
                    </div>
                    <div className="recon-summary">{entry.email}</div>
                  </td>
                  <td>
                    {can("member", "update") && entry.role !== "owner" ? (
                      <select
                        aria-label={`Role for ${entry.email}`}
                        value={entry.role}
                        disabled={changeRole.isPending}
                        onChange={(event) =>
                          changeRole.mutate({
                            id: entry.id,
                            role: event.target.value as InvitableRole,
                          })
                        }
                      >
                        <option value="tech">Tech</option>
                        <option value="admin">Admin</option>
                      </select>
                    ) : (
                      <Badge variant="secondary">{entry.role}</Badge>
                    )}
                    {entry.suspended && (
                      <Badge variant="destructive">suspended</Badge>
                    )}
                    <div className="recon-summary">
                      {roleDescriptions[entry.role]}
                    </div>
                  </td>
                  <td>{formatDate(entry.lastActiveAt)}</td>
                  <td>
                    {can("member", "delete") && entry.role !== "owner" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        type="button"
                        disabled={remove.isPending}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Remove ${entry.email} from this workspace?`,
                            )
                          )
                            remove.mutate(entry.id);
                        }}
                      >
                        Remove
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {data?.invitations.map((entry) => (
                <tr key={entry.id}>
                  <td>
                    <div>{entry.email}</div>
                    <div className="recon-summary">
                      Invite expires {formatDate(entry.expiresAt)}
                    </div>
                  </td>
                  <td>
                    <Badge variant="outline">{entry.role} · pending</Badge>
                  </td>
                  <td>—</td>
                  <td>
                    {can("invitation", "cancel") && (
                      <Button
                        size="sm"
                        variant="ghost"
                        type="button"
                        disabled={cancelInvite.isPending}
                        onClick={() => cancelInvite.mutate(entry.id)}
                      >
                        Cancel invite
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </AppShell>
  );
}
