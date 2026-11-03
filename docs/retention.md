# Data retention job

`POST /api/jobs/retention` makes the retention promises in `/privacy` (sections 3 and 9), `/terms` (section 17) and `/dpa` (section 10) true. Code: `packages/api/src/retention.ts`; periods live in `RETENTION` there. Change the pages when you change them.

## Schedule

Add a daily QStash schedule (Upstash console, or `qstash schedules create`):

- Destination: `{APP_ORIGIN}/api/jobs/retention`, method `POST`, any body
- Cron: `30 3 * * *` (daily)

The route verifies the `Upstash-Signature` JWT like `/api/jobs/project-created` and returns 401 without it, 503 when QStash is not configured. Every run is idempotent.

## Dry run

`RETENTION_DRY_RUN` defaults to dry run. Anything but exactly `false` only logs and reports what would happen (`retention_workspace_would_warn`, `retention_workspace_would_delete`, row counts per table) and writes nothing. Read the first production run's `retention_job_processed` log line, then `fly secrets set RETENTION_DRY_RUN=false`.

## Rules

Workspaces (an organization) with no subscription in place. `active`, `trialing`, `past_due` (grace or not), `unpaid` and `paused` count as in place and are never touched: the Terms promise no deletion for non-payment while the subscription exists.

| Case | Deleted after | Clock starts |
| --- | --- | --- |
| Subscription ended (`canceled`, `incomplete_expired`) | 30 days read-only | Earlier of the last period end and the last subscription update |
| Never subscribed (no subscription, or only `incomplete`) | 90 days idle | Latest of creation, last sign-in (`organization.last_active_at`) and any member's live session |

- 7 days before, the Owner gets an email with a link to the export on the billing page, and an audit row `workspace.deletion_scheduled` is written. Deletion waits at least 7 days after that warning, so a workspace is never deleted unwarned, even on the first run. A warning older than the latest end or sign-in no longer counts.
- Without `RESEND_API_KEY` the email is skipped (logged as `retention_warning_not_emailed`) but the warning is still recorded. A failed send records nothing and retries next run.
- Deletion, per workspace in one transaction: the organization row goes and everything cascades (members, invitations, audit log, clients, customer and SKU mappings, agreement lines, uploaded distributor bills, billing imports, exceptions and comments, plan changes, billing rows). Users left with no other workspace are deleted with their sessions, accounts, MCP tokens and one-time purchase records. At most 50 workspaces per run.
- Kept: invoices stay in Stripe (7 years, Belgian accounting law) under the Stripe customer, whose ID is in the `retention_workspace_deleted` log line, the platform-level record once the workspace audit log is gone.

Other data, deleted in batches of 500:

| Data | Deleted when |
| --- | --- |
| Sessions, verification tokens, invitations, MCP access and refresh tokens | Expired |
| Rate-limit rows, Stripe webhook processing records | Older than 30 days |
| Audit requests | 24 months after the last update |
| Landing waitlist, integration waitlist | 24 months after sign-up |

## Export

Owners download the whole workspace as JSON from Billing ("Export workspace", `GET /api/workspace/export`), including the parsed lines of every uploaded bill. It works while the workspace is read-only.
