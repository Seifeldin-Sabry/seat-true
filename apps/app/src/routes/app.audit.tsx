import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "../components/app-shell";
import { requireWorkspaceMember } from "../lib/auth-navigation";
import { privateHead } from "../lib/seo";
import { auditQueryOptions } from "../lib/workspace";

export const Route = createFileRoute("/app/audit")({
  headers: () => ({ "Cache-Control": "private, no-store" }),
  head: () => privateHead("Audit log"),
  beforeLoad: ({ location, context }) =>
    requireWorkspaceMember(location.href, context.queryClient),
  loader: ({ context }) => context.queryClient.prefetchQuery(auditQueryOptions),
  component: AuditPage,
});

const actionLabels: Record<string, string> = {
  "exception.approve": "Approved exception",
  "exception.dismiss": "Dismissed exception",
  "exception.billed": "Marked exception billed",
  "exception.reopen": "Reopened exception",
  "exception.flag": "Flagged exception",
  "exception.unflag": "Cleared flag",
  "exception.comment": "Commented",
  "mapping.change": "Changed mapping",
  "client.markup": "Changed markup",
  "client.create": "Added client",
  "billing.import": "Imported client billing CSV",
  "billing.lines_edit": "Edited billed lines",
  "member.invited": "Invited member",
  "member.invite_canceled": "Canceled invite",
  "member.joined": "Joined workspace",
  "member.removed": "Removed member",
  "member.role_changed": "Changed role",
  "plan.change": "Changed plan",
};

function describe(value: unknown) {
  if (value === null || value === undefined) return "—";
  return Object.entries(value as Record<string, unknown>)
    .map(([key, entry]) => `${key}: ${JSON.stringify(entry)}`)
    .join(", ");
}

function AuditPage() {
  const { user } = Route.useRouteContext();
  const audit = useQuery(auditQueryOptions);

  return (
    <AppShell userName={user.name}>
      <main className="app-content">
        <section className="page-heading" aria-labelledby="audit-title">
          <div className="page-heading-copy">
            <div className="eyebrow">Workspace / Audit log</div>
            <h1 id="audit-title">Audit log</h1>
            <p>Who changed what, newest first. Read-only.</p>
          </div>
        </section>

        {audit.error && (
          <div className="error-banner" role="alert">
            <div>
              <strong>Not available</strong>
              <p>{audit.error.message}</p>
            </div>
          </div>
        )}

        {audit.data && audit.data.length === 0 && (
          <div className="empty-state">
            <h2>Nothing logged yet</h2>
            <p>
              Approvals, dismissals, mapping and markup changes, invites and
              plan changes appear here with who made them.
            </p>
          </div>
        )}

        {audit.data && audit.data.length > 0 && (
          <div className="recon-table-wrap">
            <table className="recon-table stack-table">
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Who</th>
                  <th scope="col">What</th>
                  <th scope="col">Before</th>
                  <th scope="col">After</th>
                </tr>
              </thead>
              <tbody>
                {audit.data.map((entry) => (
                  <tr key={entry.id}>
                    <td data-label="When">
                      {new Intl.DateTimeFormat("en-US", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(entry.createdAt))}
                    </td>
                    <td data-label="Who">
                      {entry.actorEmail ?? "SeatTrue (billing)"}
                    </td>
                    <td data-label="What">
                      <div>{actionLabels[entry.action] ?? entry.action}</div>
                      <div className="recon-summary">
                        {entry.targetType} {entry.targetId ?? ""}
                      </div>
                    </td>
                    <td className="recon-summary" data-label="Before">
                      {describe(entry.before)}
                    </td>
                    <td className="recon-summary" data-label="After">
                      {describe(entry.after)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </AppShell>
  );
}
