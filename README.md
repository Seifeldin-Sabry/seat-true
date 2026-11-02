# SeatTrue

**Find the license leak before the invoice goes out.** SeatTrue reconciles each month's distributor bill (Pax8 today) against what the PSA invoices every client, and checks quantities *and* price against cost × the agreed markup.

## Demo status (saved 2 Nov 2026)

| Area | State |
| --- | --- |
| Reconciliation engine (`packages/recon`) | **Done, unit tested.** Pure TypeScript. Detects unbilled seats, stale price/markup, ghost licences (offboarded client), overbilling (more billed than exists, or billed with no licence) and unmapped distributor customers, each with a monthly $ impact in cents. |
| Distributor import | **Done for CSV.** Header aliases cover Pax8 API `InvoiceItem` field names and Microsoft Partner Center reconciliation columns (`BillableQuantity`, `EffectiveUnitPrice`). Real Pax8 *portal* CSV headers are unverified. |
| Client billing import (billed side) | **Done for CSV + manual entry.** `packages/recon/src/billing-csv.ts`: generic CSV with client, SKU / product ID, quantity, unit price, optional period (one period per file). Header aliases for ConnectWise agreement additions (`Company Name`, `Product ID`, `Description`), Autotask contract services (`Account Name`, `Service Code`, `Unit Charge`) and HaloPSA recurring invoice lines (`Client Name`, `Item Code`) are **ASSUMED column names**: taken from UI/API field names, no real export samples yet. Currency strings (`$1,234.50`) parse; any bad row rejects the file with every bad row listed. Client names resolve by saved billing mapping → PSA ID → client name → mapped Pax8 customer name; the rest wait in `billing_imports.unmapped_lines` until matched on `/app/mappings`. An upload replaces the billed lines of every unlocked client (locked/archived clients are left out and keep theirs), re-runs the latest bill keeping statuses, and is audit-logged (`billing.import`). Per-client manual edit on `/app/clients/:id` (`billing.lines_edit`). SKU aliases (`sku_aliases`, `0009`; `PUT /recon/sku-aliases`, `mapping:edit`): a billed PSA product ID or name → Pax8 SKU, or "" for non-distributor lines (managed services) that are left out; applied in every recompute. Billed SKUs not on the bill are listed on `/app/mappings`. |
| Adapters | `VendorSource` / `PsaSource` interfaces exist in `packages/recon/src/types.ts`; only the CSV sources are implemented. No Pax8 API, ConnectWise, HaloPSA or Autotask API calls yet. |
| Database | **Workspace-scoped** (Better Auth organization, `organization_id`): `clients`, `customer_mappings`, `agreement_lines`, `reconciliation_runs`, `billing_imports` (`0007`), `reconciliation_exceptions`, `exception_comments`, `audit_log`, billing tables. Plugin tables `organization`, `member` (+ `suspended_at`), `invitation`. `waitlist_entries` is global. Migrations `0004`–`0006` moved from owner ids to organizations. |
| API (`packages/api/src/recon-routes.ts`, `members-routes.ts`) | **Done, integration tested, role-checked.** Served by the app under `/api` (one Fly app, no separate API machine). `GET /recon/overview`, `GET /recon/clients/:id`, `PATCH /recon/clients/:id` (archive, markup), `GET /recon/exceptions`, `PATCH /recon/exceptions/:id` (open / approved / billed / dismissed), `PUT /recon/exceptions/:id/flag`, `GET`/`POST /recon/exceptions/:id/comments`, `GET`/`PUT /recon/mappings` (re-runs reconciliation and keeps statuses, flags and comments), `POST /recon/runs` (CSV upload), `POST /recon/billing` (client billing CSV, `run:upload`), `PUT /recon/clients/:id/agreements` (manual billed lines, `run:upload`), `PUT /recon/billing/mappings` (billing client name → client, `mapping:edit`), `POST /recon/demo` (owner; loads "Northbeam IT", 8 clients, $548.10/mo leakage), `GET /workspace`, `PUT /workspace/active`, `/members` (+ invitations), `/invitations/:id(/accept)`, `GET /audit`, public `POST /waitlist`, public `POST /integrations/waitlist` ("Notify me when it's live" on Coming soon integration pages; `integration_waitlist`, unique on email + slug, 5 sign-ups per IP per 10 min kept in the Postgres `rate_limit` table so it works with the cache off; no email sent), platform-admin-only `GET /integrations/waitlist/counts` (SeatTrue-wide counts per integration, card on `/app`; `PLATFORM_ADMIN_EMAILS`, workspace owners get 403). |
| Product app UI | **Built.** Overview + CSV upload, exceptions inbox (flag, comments), mappings, per-client page (markup, archive), billing, Members (`/app/members`), Audit log (`/app/audit`), accept-invite page (`/accept-invite/:id`), workspace switcher. Controls hide by role. |
| Landing page + waitlist form | **Built** (`apps/app/src/routes/index.tsx`). |
| Marketing site | **Built.** `/pricing`, `/compare/{gradient,pax8-psa-sync,spreadsheet}`, `/for/{msps,msp-finance-and-billing-teams,small-msps,growing-msps}`, `/integrations` (+ `/integrations/<slug>`), `/glossary`. Page meta in `apps/app/src/lib/site.ts`; SEO notes and keyword map in `docs/seo.md`. Domain = `SITE_URL` (default `https://seattrue.com`). |
| Blog | **Built.** Markdown in `apps/app/content/blog/`, live when `publishAt <= now` and no `<!-- verify` flag is left in the source (checked per request; no rebuild). Feeds: `/sitemap.xml`, `/rss.xml`, `/llms.txt`, `/llms-full.txt`, `/robots.txt`, OG images at `/og/*`. Schedule and verify flags: `docs/content-calendar.md`. |
| Auth | Better Auth email/password (work email only) + optional Google; organization plugin with owner / admin / tech. Magic link not wired. |
| Roles & seats | **Done, integration tested.** See [Roles & permissions](#roles--permissions). |
| Billing | Stripe Solo/Team, per workspace. See below; live secrets still to set. |

Try the API locally: sign up in the app at http://localhost:3000, then from the browser console on that origin run `await fetch("/api/recon/demo", { method: "POST" })` followed by `await (await fetch("/api/recon/overview")).json()`.

Local Docker Postgres runs on port **5433** on this machine (5432 is taken); `.env` points `DATABASE_URL` and `TEST_DATABASE_URL` there. Start Docker first (`colima start`), then `bun run db:up`. Production secrets: see Fly.io deployment (`bun run secrets:set`, `secrets:fly`). Google sign-in turns on only when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set; redirect URIs `http://localhost:3000/api/auth/callback/google` (local) and `https://<domain>/api/auth/callback/google` (production).

---

Full-stack app: one TanStack Start server that also serves the Elysia API under `/api` (Elysia's [TanStack Start integration](https://elysiajs.com/integrations/tanstack-start)), and PostgreSQL (Neon in production), deployed to Fly.io. Projects CRUD shows the complete path from Drizzle through Elysia and typed Eden Treaty calls to a TanStack Query interface. Better Auth supplies email/password sessions. Optional integrations add Upstash Redis, Resend email, Upstash QStash jobs, and Stripe billing with both subscriptions and one-time purchases.

## First run

Requires Bun 1.4.0, Docker with Compose, and Git.

```sh
bun install --frozen-lockfile
cp .env.example .env
bun run db:up
bun run db:migrate
bun run dev
```

Everything runs on one port: open [the app](http://localhost:3000) (landing at `/`, product at `/app`) and [API health](http://localhost:3000/api/health). Create an account in the app, then create, edit, and delete projects. Billing page remains usable in a disabled state until Stripe is configured.

PostgreSQL binds to localhost. If port 5432 is occupied, change `POSTGRES_PORT`, `DATABASE_URL`, and `TEST_DATABASE_URL` to port 5433 in `.env` before starting Compose. To add the optional sample project, register first, set `SEED_USER_EMAIL` to that account's email, then run `bun run db:seed`. Seed is safe to rerun. Without that variable it exits without inserting data.

## Billing (SeatTrue)

Two flat monthly plans, resolved by Stripe lookup key so sandbox and live both work: `seattrue_solo_monthly` ($149, up to 150 clients) and `seattrue_team_monthly` ($249, unlimited). Live price IDs, for reference only: `price_1UXGEGEmKiht8PXgKHiC0PxD` (Solo), `price_1UXGEHEmKiht8PXgvt1iSeMs` (Team). Portal configuration (live): `bpc_1UXGFQEmKiht8PXgdUn9Lalf`.

- Checkout is subscription mode; Stripe charges automatically and emails receipts and invoices (turn on the customer email toggles in the Stripe dashboard). The app sends no billing email of its own.
- **No refunds.** Cancellation takes effect at period end with no proration. Upgrades in the portal invoice immediately; downgrades apply at period end, so no credits are issued. There is no refund code path.
- Every Stripe POST carries an idempotency key (`customer:<userId>`, `checkout:<userId>:<lookupKey>:<attemptId>`, `portal:<userId>:<attemptId>`). One Stripe customer per account; a second Checkout while a plan exists returns 409 and the UI sends the user to the portal.
- Webhooks: signature verified on the raw body; `billing_webhook_events` (unique event id) is written in the same transaction as the side effects, so duplicates are no-ops; state always comes from re-fetching the subscription, and `last_event_at` stops a late, older invoice event from overwriting newer details; processing errors return 500 so Stripe retries. Handled: `checkout.session.completed`, `customer.subscription.created/updated/deleted/paused/resumed`, `invoice.paid`, `invoice.payment_failed`, `invoice.payment_action_required` (3-D Secure link shown on the Billing page).
- Access: active/trialing = full; past_due = 7-day grace with a banner (Stripe Smart Retries and dunning emails do the chasing); unpaid/canceled/incomplete_expired/paused = read-only (writes return 402, nothing deleted). Never subscribed = full (free audit stage).

- **Plan limits** live in `packages/billing/src/plans.ts`: Solo = 150 active clients and 2 users, Team = unlimited clients and users; never subscribed = unlimited. Client limits are enforced on client create and restore, seat limits on invite and accept (`402 PLAN_LIMIT` with an upgrade prompt). CSV imports don't create clients; they only map to existing ones.
- **Plan changes happen in the app** (Billing page); the Stripe portal only handles card, invoices and cancellation. Upgrades apply now with `always_invoice` and unlock every client. Downgrades run a usage preflight; with overages the user picks which clients stay (least-recently-active are pre-unchecked) and types `DOWNGRADE`, or archives clients first. The downgrade is a Stripe subscription schedule (phase 2 = Solo, `proration_behavior: none`) starting at period end. No credits, no refunds.
- **Locks** apply when the `customer.subscription.updated` webhook shows the new plan: the stored keep-lists (`keep_client_ids`, `keep_member_ids`) for in-app downgrades, otherwise the current state is preserved (or, for an external downgrade such as from the Stripe dashboard, least-recently-active clients lock first, members are kept owner first then most recently active, and the owner gets one Resend email listing both). Locked clients are read-only (`423 CLIENT_LOCKED`), excluded from reconciliation and never deleted; over-limit members are suspended (`member.suspended_at`), never removed, and restored on upgrade; replays are no-ops.
- Billing belongs to the workspace: `billing_customers`, `billing_subscriptions` and `billing_plan_changes` are keyed by `organization_id`; Stripe metadata and idempotency keys use the organization id. Only the owner (`billing:manage`) can check out, open the portal or change plan; every member sees the Billing page.

**TODO (Seif):**
1. `bun run secrets:set STRIPE_SECRET_KEY "sk_live_..."` and, once the domain exists, create the webhook endpoint `https://<domain>/api/billing/webhook` with the events above, then `bun run secrets:set STRIPE_WEBHOOK_SECRET "whsec_..."`.
2. `bun run secrets:set STRIPE_PORTAL_CONFIG_ID "bpc_1UXGFQEmKiht8PXgdUn9Lalf"`.
3. For a sandbox: put a test key in `.env`, run `bun run stripe:seed` (idempotent; creates products, prices and the portal config), and copy the printed portal ID into `.env`.
4. Enable Stripe's "Email customers about successful payments" and invoice emails, plus Smart Retries.

## Roles & permissions

Every workspace is a Better Auth organization ([organization plugin](https://www.better-auth.com/docs/plugins/organization)). Three fixed roles defined with `createAccessControl` / `ac.newRole` in `packages/auth-policy/src/access.ts`; no dynamic access control, no teams. The plugin's own statements stay (`invitation:create` = invite, `member:update` = change role, `member:delete` = remove, `organization:delete` = delete workspace).

| Permission | Owner | Admin (ops/finance) | Tech |
| --- | :-: | :-: | :-: |
| View everything (overview, clients, exceptions, mappings, members, billing page) | ✓ | ✓ | ✓ |
| Upload a bill or client billing CSV, edit billed lines (`run:upload`) | ✓ | ✓ | ✓ |
| Flag / comment on exceptions (`exception:flag`, `exception:comment`) | ✓ | ✓ | ✓ |
| Approve / dismiss / mark billed / reopen (`exception:resolve`) | ✓ | ✓ | |
| Edit customer mappings (`mapping:edit`) | ✓ | ✓ | |
| Invite / cancel invites (`invitation:create`, `invitation:cancel`) | ✓ | ✓ | |
| Audit log (`audit:view`) | ✓ | ✓ | |
| Create / archive clients, change markup (`client:*`) | ✓ | | |
| Load demo data (wipes the workspace) (`run:demo`) | ✓ | | |
| Billing and plan (`billing:manage`) | ✓ | | |
| Change roles, remove members (`member:update`, `member:delete`) | ✓ | | |
| Delete the workspace (`organization:delete`; permission defined, no route or UI yet) | ✓ | | |

- **Enforcement:** every API route resolves the session's active organization (`session.activeOrganizationId`) and the member row. Reads need an active, non-suspended membership; writes also pass `auth.api.hasPermission`. Denials are `403 { error: { code: "FORBIDDEN", message } }`. `GET /workspace` returns the member's role and permissions; the UI only hides controls. The plugin's membership endpoints (`/api/auth/organization/invite-member`, `remove-member`, `update-member-role`, `accept-invitation`, `create`, `delete`, …) return 404 over HTTP; the API's `/members` and `/invitations` routes call them server-side so the 403 contract and audit log always apply.
- **Audit log** (`audit_log`): actor id + email, action (approve, dismiss, billed, reopen, flag, comment, mapping change, markup change, member invited / joined / removed / role changed / suspended / restored, plan change), target, before/after JSON, org id, timestamp. Exception, mapping and markup changes write it in the same transaction; member and plan changes write it right after Better Auth / Stripe succeed. Owners and admins read it at `/app/audit`.
- **Seats:** Solo 2 users, Team unlimited, never subscribed unlimited. Seats = active members + pending, unexpired invites, checked on invite; on accept only members count (the invite held the seat). Over the limit → `402 PLAN_LIMIT`.
- **Invites:** `POST /members/invitations` (work email only, `WORK_EMAIL_REQUIRED` otherwise; role admin or tech, never owner). Better Auth's default 48 h expiry. The email goes through Resend (`sendInvitationEmail`) with a link to `APP_ORIGIN/accept-invite/<id>`; with email disabled (dev) the API logs the link (`invitation_link`). The invitee signs in or signs up with the invited address, then accepts; with email enabled `requireEmailVerificationOnInvitation` makes them verify first. Accepting switches their active workspace.
- **Personal workspaces:** sign-up creates `org_<userId>` with the user as owner (`databaseHooks.user.create.after`); `session.create.before` sets the active organization (newest non-suspended membership). `allowUserToCreateOrganization: false`. Users in several workspaces switch from the sidebar.
- **Migration:** `0004_organizations` adds the plugin tables and nullable `organization_id` columns; `0005_org_backfill` (custom SQL, idempotent: deterministic `org_`/`mem_` ids, `ON CONFLICT DO NOTHING`, updates only `NULL` rows) gives every user a personal org as owner, points sessions at it, re-keys domain and billing rows and forgets pre-move pending Checkouts; `0006_organization_scope` makes `organization_id` NOT NULL and drops `owner_id` / `user_id`. `bun run db:migrate` runs all three; `org-migration.integration.test.ts` replays them on a scratch database, including the backfill twice.

## Workspaces

| Path | Purpose |
| --- | --- |
| `apps/app` | TanStack Start app: landing, product UI, and `routes/api.$.ts`, which forwards every `/api/*` request untouched to the Elysia app |
| `packages/api` | Elysia API (`prefix: "/api"`), Better Auth, validated routes, services, `createServerApp` wiring, Eden `App` type |
| `packages/db` | Drizzle schema, Postgres.js connection, SQL migrations, seed |
| `packages/billing` | Stripe checkout, customer portal, webhook reconciliation |
| `packages/cache` | Optional Upstash Redis cache and Better Auth rate-limit storage |
| `packages/email` | Optional Resend delivery for verification and password reset |
| `packages/jobs` | Optional Upstash QStash job queue; API receives signed callbacks |
| `packages/ui` | Shared shadcn-style controls, Tailwind tokens, brand settings |

`apps/app/src/lib/api.ts` builds Eden Treaty with `createIsomorphicFn`: on the server `treaty(app).api` calls Elysia in-process (no HTTP) with the visitor's cookie and the app origin; in the browser `treaty<App>(window.location.origin).api` fetches same-origin. The server branch imports the API dynamically, so the browser bundle contains no database or API runtime module. Query options define one projects cache key; `useCreateProject`, `useUpdateProject`, and `useDeleteProject` await invalidation on success. Server rendering uses a request-scoped QueryClient and forwards the session cookie for API reads.

## Environment

Copy `.env.example` to ignored `.env` for local development. In staging and production, inject environment variables through the host or secret manager; an `.env` file is optional there. Root development, build, test, and database scripts use dotenvx. `bunfig.toml` disables Bun runtime's implicit `.env` loading, so runtime scripts receive file values through dotenvx. Bun's package manager can still inspect `.env` during installation. API validates required settings at startup; app server validates origins before API requests. Keep secrets out of `VITE_` variables; those values are public in frontend builds. Turborepo declares task environment inputs for caching and process forwarding.

| Variable | Purpose |
| --- | --- |
| `POSTGRES_PORT` | Docker host port, default 5432 |
| `DATABASE_URL` | PostgreSQL URL used by API, seed, Drizzle generation, Studio, and migrations in the current environment |
| `TEST_DATABASE_URL` | PostgreSQL integration-test URL; use an isolated disposable database outside local development |
| `APP_ORIGIN` | Public app origin. Better Auth base URL, the only trusted origin for writes, Stripe return URLs, QStash callback base (`/api/jobs/*`), email links |
| `VITE_APP_ORIGIN`, `VITE_WEB_ORIGIN` | Public links compiled into frontend builds |
| `BETTER_AUTH_SECRET` | 32+ character signing secret; production startup rejects example value |
| `SEED_USER_EMAIL` | Existing registered email to receive sample project |
| `PLATFORM_ADMIN_EMAILS` | Comma-separated SeatTrue staff emails (verified addresses only) who can read platform-wide data such as integration waitlist counts. Empty = nobody. Production: `bun run secrets:set PLATFORM_ADMIN_EMAILS "…"` then `bun run secrets:fly` |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Optional Upstash pair; both or neither |
| `REDIS_KEY_NAMESPACE` | Redis key prefix to separate deployments |
| `RESEND_API_KEY`, `EMAIL_FROM` | Optional Resend credential and verified sender address; both or neither |
| `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY` | Optional QStash token and signing keys; all three or none |
| `QSTASH_DEV` | `true` runs local QStash dev server with deterministic keys instead |
| `LOG_LEVEL` | Minimum API JSON log level |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Optional Stripe test/live secret and signing secret |
| `STRIPE_SUBSCRIPTION_PRICE_ID`, `STRIPE_ONE_TIME_PRICE_ID` | Server-owned recurring and one-time Price IDs |

### PostgreSQL in each environment

Local development uses PostgreSQL 17 from Docker Compose. `bun run db:up` starts it; default `DATABASE_URL` in `.env.example` points to `localhost:5432`. If that port is occupied, change `POSTGRES_PORT`, `DATABASE_URL`, and `TEST_DATABASE_URL` together. Compose is only for local development. Staging and production can use Neon or any compatible hosted PostgreSQL service: set each deployment's `DATABASE_URL` to that environment's connection string, then run the same `bun run db:migrate` command before deploying API code. No provider-specific migration variable or driver is required. Include provider-required TLS settings in the URL. Confirm that the selected connection endpoint permits migration DDL; if a provider offers separate pooled and direct endpoints, choose its migration-capable endpoint for the migration job. Never run integration tests against production data.

Change `packages/db/src/schema.ts` and related schema files, run `bun run db:generate`, review generated SQL, commit migration files, then run `bun run db:migrate` with target environment's `DATABASE_URL`. Runtime and migration processes can receive different values for that same variable if connection endpoints differ. `db:studio` opens Drizzle Studio with the configured database.

### Better Auth

Email/password registration, sign-in, sign-out, and database-backed sessions work without another service. Projects and billing routes require a session; project records are scoped to the session user. Better Auth rate limits use PostgreSQL by default. With both Upstash values present, rate-limit counters use Redis while sessions remain in PostgreSQL. Partial Upstash configuration fails at API startup.

Better Auth is served at `/api/auth/*` on the app's own origin, so its cookies are plain first-party host cookies; there is no cross-subdomain cookie setup. Rate limits use the socket IP from TanStack Start's `getRequestIP` (or `Fly-Client-IP` on Fly) and discard incoming forwarding headers.

Without Resend, signup works immediately and email verification and password-reset delivery remain off. Set both `RESEND_API_KEY` and `EMAIL_FROM` to enable verification on signup and password-reset emails; partial configuration fails at API startup. App shows check-inbox/resend and forgot/reset-password flows only when email delivery is enabled. Verify sender domain with Resend. Set both server-side `APP_ORIGIN` and build-time `VITE_APP_ORIGIN` to the same public app URL so verification and recovery links return to the correct host. Social login is not included.

### API logging

API emits one Pino JSON completion record per request with ISO timestamp, service, event, request ID, HTTP method, pathname without query, actual status, and duration in milliseconds. Startup, shutdown, enabled integrations, and unexpected errors use the same logger. `LOG_LEVEL=info` is the default; `trace`, `debug`, `warn`, `error`, `fatal`, and `silent` are also accepted. Request IDs return in `X-Request-ID` to correlate client reports with server logs. Logs omit request bodies and raw headers; common credential fields are redacted, and unexpected errors record exception names and call sites without their potentially sensitive messages. Forward stdout/stderr to the deployment's log collector and set its retention and access controls there.

### Stripe: subscriptions and one-time purchases

Billing is optional. Create a recurring Price and a one-time Price in Stripe test mode. Set all four `STRIPE_*` variables in `.env`; leaving all blank disables billing, while a partial configuration fails at startup. Checkout accepts only `subscription` or `one_time`; API selects Price IDs from server configuration. Both modes use hosted Stripe Checkout. Subscription customers can open Stripe Customer Portal. Signed webhooks reconcile subscription state and one-time purchase records into PostgreSQL; processed Stripe event IDs prevent duplicate writes. The UI shows current state from the database.

For local webhook forwarding, install Stripe CLI and run:

```sh
stripe listen --forward-to http://localhost:3000/api/billing/webhook
```

Copy the printed `whsec_...` value into `STRIPE_WEBHOOK_SECRET`, restart `bun run dev`, then use Stripe test cards through the billing page. Configure the same webhook endpoint and event types in Stripe for deployment: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, and `customer.subscription.created`, `.updated`, `.deleted`. Configure Customer Portal in Stripe before offering its link. No Stripe credentials are committed, and live payment processing needs a real Stripe account and webhook endpoint.

Billing records demonstrate integration; they do not grant application entitlements yet. Add an explicit server-side entitlement check for paid product features. For production billing, enable email verification/recovery and reconcile operational exceptions from Stripe Dashboard.

### QStash jobs

Jobs are optional. With no `QSTASH_*` values, API runs without a queue and never publishes. With all three set, creating a project publishes a `project-created` message after the database write succeeds. QStash then calls `POST {APP_ORIGIN}/api/jobs/project-created`; API verifies the `Upstash-Signature` JWT against the raw body and that public URL, re-reads the committed project by owner and ID, and logs the outcome. Messages carry identifiers only, use a stable deduplication ID, and retry three times before landing in the QStash dead letter queue. Non-2xx responses trigger retries, so handlers must be idempotent. Partial configuration fails at startup. Enqueue failure produces a warning while the saved project remains available; use a transactional outbox if future jobs must be delivered reliably.

Locally, set `QSTASH_DEV=true`: the SDK downloads and starts the QStash dev server on port 8080 and uses its deterministic keys, so callbacks reach `localhost:3000/api/jobs/*` without a tunnel. Dev mode is ignored when `NODE_ENV=production`. In production, copy the token and both signing keys from the Upstash console into API secrets. API itself is the worker; there is nothing separate to deploy. Add a job by extending `JobName`, adding a publish method in `packages/jobs/src/queue.ts`, and adding a matching signed route.

### Choose modules

Core dependency path: product app calls the API through an Eden contract; API uses PostgreSQL through `packages/db`. Better Auth lives in the API and stores sessions in PostgreSQL. The app uses `packages/ui`. The API opts into `packages/cache`, `packages/email`, `packages/jobs`, and `packages/billing` at startup. Jobs use the database directly in their worker; billing owns its own database tables. Email and jobs have no dependency on each other.

**Disable at runtime:** leave Upstash Redis, Resend, or QStash credentials blank, or leave all four Stripe settings blank. Their packages remain installed, but core app still runs. Partial configuration fails fast. Keep provider secrets on API servers, never in `VITE_` variables.

**Remove code from a derivative project:**

| Module | Files and wiring to remove |
| --- | --- |
| Upstash | Delete `packages/cache`; remove `@seattrue/cache` from `packages/api/package.json`, `createCache` and `secondaryStorage` wiring from `packages/api/src/server.ts`, and cache type/option from `packages/api/src/auth.ts`. Set Better Auth rate-limit storage to `database`. |
| Resend | Delete `packages/email`; remove API package dependency and email setup in `packages/api/src/server.ts` and `packages/api/src/auth.ts`. Remove `/auth/capabilities` from `packages/api/src/app.ts`, `apps/app/src/lib/auth-capabilities.ts`, `apps/app/src/routes/forgot-password.tsx`, `apps/app/src/routes/reset-password.tsx`, `apps/app/src/components/recovery-screen.tsx`, and conditional controls in `apps/app/src/components/auth-screen.tsx`. Basic email/password auth remains. |
| QStash | Delete `packages/jobs`; remove API package dependency, queue setup in `packages/api/src/server.ts`, and `jobs` option, `/jobs/project-created` route, and `onProjectCreated` hook in `packages/api/src/app.ts`. Projects CRUD remains. |
| Stripe | Delete `packages/billing` and `packages/api/src/billing.ts`; remove billing imports/options/routes from `packages/api/src/server.ts` and `app.ts` and API package dependency. Remove `apps/app/src/routes/billing.tsx`, `apps/app/src/lib/billing.ts`, `apps/app/src/billing-styles.css`, links in `apps/app/src/components/app-shell.tsx`, and billing copy in `apps/web/src/routes/index.tsx`. Remove `packages/db/src/billing-schema.ts` and billing exports from its `schema.ts` and `index.ts`. |

For each removal, delete corresponding variables from `.env.example` and `turbo.json`, update relevant tests and package manifests, then run `bun install` to refresh `bun.lock`. For Stripe schema removal on an existing database, generate and review a **new** Drizzle migration, apply it to local PostgreSQL with `bun run db:migrate`, and keep previously applied migration history. After deleting frontend routes, regenerate `apps/app/src/routeTree.gen.ts` with `bun run --cwd apps/app build`. Finish with `bun run check`.

Projects CRUD is a removable sample: replace its table, repository, routes, UI, tests, seed, and related job with domain features; migrate deployed databases instead of rewriting applied SQL.

## Commands

| Command | Purpose |
| --- | --- |
| `bun run dev` | Start the app (API included) on port 3000 |
| `bun run build` | Build all workspaces |
| `bun run start` | Start the built app |
| `bun run lint`, `format`, `format:check` | Biome checks and formatting |
| `bun run typecheck`, `test`, `check` | Typecheck, tests, or full verification |
| `bun run db:up`, `db:down` | Start or stop local PostgreSQL |
| `bun run secrets:set KEY value` | Encrypt a production secret into `.env.production` (no private key needed) |
| `bun run secrets:fly [config] [file]` | Decrypt `.env.production` and stage all values as Fly secrets |
| `bun run db:generate`, `db:migrate`, `db:seed`, `db:studio` | Database workflow |

`bun run check` runs lint, typecheck, tests, and production builds. CI performs each check as a separate named step after starting PostgreSQL and applying migrations. CI needs no Stripe, Resend, or Upstash credentials. The optional `deploy` job ships to Fly after CI passes on `main`; see Fly.io deployment.

## Adapt the starter

1. Update product name, links, and theme color in `packages/ui/src/brand.ts`; adjust shared visual tokens in `packages/ui/tokens.css`. Search for `@starter`, `seattrue`, and the favicon mark when renaming the repository, package scope, Redis namespace, and logo.
2. Add a Drizzle table or column, generate SQL, review it, and commit the migration.
3. Add an owner-scoped repository method and validated Elysia route. Exported `App` type updates Eden calls automatically.
4. Add a typed Eden operation, TanStack Query key/options, mutation hook with awaited invalidation, and app route. Keep server secrets out of browser imports.
5. Add focused validation, database, and typed-client tests. Projects is a removable example; delete its route, repository, and table after replacing it.

## Fly.io deployment

One Fly app, `seattrue`, deploys from the repository root with `fly.toml` and the root `Dockerfile` (builds `apps/app`, which includes the API). Its `release_command` runs Drizzle migrations before new machines start. Replace the `seattrue.fly.dev` origins with your domain once it exists, then:

```sh
fly apps create seattrue
bun run secrets:set DATABASE_URL "postgres://..."          # encrypts into .env.production
bun run secrets:set BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
bun run secrets:fly          # decrypts and stages every value on the app (fly.toml)
fly deploy                   # release_command runs Drizzle migrations first
fly certs add <domain> -a seattrue
```

Production secrets live in committed, encrypted `.env.production` (dotenvx). `secrets:set` encrypts with the public key in that file, so anyone (or any agent) can add or rotate a value without being able to read the others. The private key stays in ignored `.env.keys`; back it up in a password manager. `secrets:fly` decrypts the file and stages every value (`fly secrets set --stage`, one argument per value, no shell quoting); the next `fly deploy` applies them. Add optional `UPSTASH_*`, `QSTASH_*`, `RESEND_API_KEY`/`EMAIL_FROM`, `STRIPE_*` and `GOOGLE_*` the same way. `APP_ORIGIN` lives in `[env]`; `VITE_` origins are `[build.args]` because they compile into the browser bundle. Use a Neon connection string for `DATABASE_URL`, in the same region as `primary_region`. The API reads the client address from `Fly-Client-IP` when `FLY_APP_NAME` is present, because the socket peer is Fly's proxy. Point Stripe's webhook at `https://<domain>/api/billing/webhook` and the Google OAuth redirect at `https://<domain>/api/auth/callback/google`. Health check: `GET /api/health`. For automatic deploys, GitHub stores only two secrets: `FLY_API_TOKEN` (`fly tokens create org`) and `DOTENV_PRIVATE_KEY_PRODUCTION` (from `.env.keys`). Set repository variable `FLY_DEPLOY=true`. The deploy job stages secrets from `.env.production` before deploying, so adding a secret is a commit, not a dashboard edit.

## Deployment notes

Deploy the single output on Bun; Nitro selects its Bun preset when built with Bun. Root `start` sets `NODE_ENV=production`. Set `VITE_` origins at build time. Run committed migrations before starting revised code (Fly's `release_command` does). Same-origin API means no CORS configuration. Set a fresh `BETTER_AUTH_SECRET`; serve public traffic over HTTPS. Protected app routes send `Cache-Control: private, no-store`; keep that policy at the hosting layer.

TanStack Start is currently a release candidate and its Vite hosting guide uses Nitro 3 beta; both are pinned to compatible published versions here. Validate host-specific output and cookie behavior before deploying. GitHub Actions workflow lives in `.github/workflows/ci.yml`.
