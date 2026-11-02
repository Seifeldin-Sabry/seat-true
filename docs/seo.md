# SeatTrue SEO

## Keyword map

Primary theme: **Microsoft 365 license reconciliation for MSPs**. Secondary themes: **Pax8 billing reconciliation**, **NCE seat management**, **MSP license margin**.

One primary and one secondary keyword per page, chosen by search intent. Pages and posts never share a primary keyword; where a static page and a post sit close together, the page takes the commercial query and the post the informational one. Source of truth for pages: `apps/app/src/lib/site.ts` (`primaryKeyword`, `secondaryKeyword`, tested for uniqueness). Posts: `keyword` in each file's frontmatter.

### Pages

| Page | Intent | Primary | Secondary |
|---|---|---|---|
| `/` | Commercial | microsoft 365 license reconciliation for msps | msp license margin |
| `/pricing` | Transactional | msp billing reconciliation software pricing | msp license margin |
| `/for/msps` | Commercial | microsoft 365 billing software for msps | msp license margin |
| `/for/msp-finance-and-billing-teams` | Commercial | msp billing team reconciliation | pax8 billing reconciliation |
| `/for/small-msps` | Commercial | small msp microsoft 365 billing | msp license margin |
| `/for/growing-msps` | Commercial | msp billing approval workflow | nce seat management |
| `/integrations` | Commercial / navigational | msp billing reconciliation integrations | pax8 billing reconciliation |
| `/compare/gradient` | Commercial investigation | gradient msp alternative | microsoft 365 license reconciliation for msps |
| `/compare/pax8-psa-sync` | Commercial investigation | pax8 psa sync price check | pax8 billing reconciliation |
| `/compare/spreadsheet` | Commercial investigation | m365 reconciliation spreadsheet alternative | msp license margin |
| `/blog` | Informational hub | msp microsoft 365 billing | nce seat management |
| `/glossary` | Informational (definitions) | microsoft 365 billing glossary | nce seat management |

### Posts

| Publish | Post | Intent | Primary (frontmatter `keyword`) | Secondary theme |
|---|---|---|---|---|
| 10 Nov | `/blog/reconcile-pax8-bill-against-psa-invoices` | How-to | pax8 billing reconciliation | microsoft 365 license reconciliation for msps |
| 12 Nov | `/blog/what-is-license-leakage` | Definition | license leakage msp | msp license margin |
| 17 Nov | `/blog/nce-monthly-vs-annual-seat-reduction-rules` | How-to | nce cancellation policy | nce seat management |
| 19 Nov | `/blog/seattrue-vs-spreadsheet-m365-reconciliation` | Comparison | m365 billing reconciliation spreadsheet | msp license margin |
| 24 Nov | `/blog/m365-markup-policy-for-msps` | How-to | microsoft 365 markup msp | msp license margin |
| 26 Nov | `/blog/m365-billing-close-checklist` | Checklist | msp billing close checklist | pax8 billing reconciliation |
| 1 Dec | `/blog/seattrue-vs-pax8-psa-sync` | Comparison | pax8 psa sync | pax8 billing reconciliation |
| 3 Dec | `/blog/ghost-licences-after-offboarding` | How-to | ghost licences microsoft 365 | nce seat management |
| 8 Dec | `/blog/what-is-nce-new-commerce-experience` | Definition | what is nce microsoft | nce seat management |
| 10 Dec | `/blog/seattrue-vs-gradient-reconcile` | Comparison | gradient reconcile alternative | microsoft 365 license reconciliation for msps |
| 15 Dec | `/blog/m365-renewal-price-review-checklist` | Checklist | microsoft 365 renewal price check | msp license margin |
| 17 Dec | `/blog/how-seattrue-calculates-license-leakage` | Methodology | how to calculate license leakage | msp license margin |

**/for pages are about who, not which tools.** Each one covers a buyer segment (all MSPs, finance/billing teams, small MSPs, growing MSPs with Owner/Admin/Tech roles). Tools appear only as "works with your existing tools", linking `/integrations`. Copy in `apps/app/src/lib/audiences.ts`.

**Integrations:** `/integrations` plus `/integrations/<slug>` detail pages, from `apps/app/src/lib/integrations.ts`. Live only when the code ships and tests it: today the Pax8 billing CSV and Partner Center reconciliation CSV, both read by `packages/recon/src/pax8-csv.ts` and covered by `packages/recon/src/reconcile.test.ts`. Everything else is "Coming soon", no dates. A test in `structured-data.test.ts` pins the live list; changing it means pointing at new code and tests. Detail pages are in the sitemap and llms.txt, have per-integration OG cards (`/og/integration/<slug>.png`) and a BreadcrumbList; the index carries an ItemList.

**Watch for cannibalisation:** the three comparison posts overlap with the `/compare/*` pages. The pages target the "alternative / price check" query and link to the post once it's live; if Search Console shows them competing, make the post the canonical deep dive and trim the page.

## What's in place

- **Single domain value:** `SITE_URL` (build time, read as `brand.siteUrl`, default `https://seattrue.com`). Canonicals, OG URLs, sitemap, RSS, llms files and JSON-LD all derive from it. Set it in the deploy build before launch.
- **Per-page meta (server-rendered):** unique `<title>` ≤ 60 chars and description ≤ 155 (tested), canonical, Open Graph and Twitter `summary_large_image`, RSS `alternate` link.
- **OG images:** generated per page and per post at `/og/page/<key>.png` and `/og/blog/<slug>.png` (satori + resvg, 1200×630, cached in memory). Scheduled posts have no image until live.
- **noindex:** every `/app/*` route (incl. billing), sign in, sign up, forgot/reset password, accept invite, 404. `robots.txt` disallows `/app` and `/api`.
- **Structured data:** Organization, WebSite, SoftwareApplication with two Offers (Solo $149, Team $249, USD per month) and FAQPage on `/`; SoftwareApplication + FAQPage on `/pricing`; BlogPosting (with `dateModified`), BreadcrumbList and FAQPage on posts; DefinedTermSet on `/glossary`; FAQPage on each `/for/*` page; ItemList on `/integrations`; BreadcrumbList on every other page. No ratings, reviews or invented numbers. Required properties per type are checked in `apps/app/src/lib/structured-data.test.ts`.
- **Feeds:** `/sitemap.xml` (with `lastmod`), `/rss.xml`, `/llms.txt`, `/llms-full.txt`, `/robots.txt` (GPTBot, ClaudeBot, PerplexityBot and Google-Extended allowed). All built per request from live posts only.
- **Link mesh:** header links `/integrations`; footer links every compare, for-page, integrations and learn page; each post links to its closest compare/for page, related posts and glossary terms; compare, for and pricing pages link to live posts and glossary entries.
- **Performance:** self-hosted fonts (fontsource, latin subset), headline face preloaded, metric-matched Arial fallback for Inter (no layout shift on swap), Brotli/gzip pre-compressed assets, gzip on HTML and feeds (`apps/app/src/server.ts`), no raster images on marketing pages, markdown/YAML/OG libraries stay server-only.

## Lighthouse (production build, 2 Nov 2026)

`bun run build`, then the built server on localhost, Lighthouse 13.4.1 CLI. Mobile = default simulated slow 4G + 4× CPU; desktop = `--preset=desktop`. Order: performance / accessibility / best practices / SEO.

| Page | Mobile | Desktop |
|---|---|---|
| `/` | 92 / 100 / 100 / 100 | 100 / 100 / 100 / 100 |
| `/pricing` | 95 / 100 / 100 / 100 | 100 / 100 / 100 / 100 |
| `/blog` | 95 / 100 / 100 / 100 | 100 / 100 / 100 / 100 |
| one post | 92 / 100 / 100 / 100 | 100 / 100 / 100 / 100 |
| `/glossary` | 95 / 100 / 100 / 100 | 100 / 100 / 100 / 100 |
| `/compare/gradient` | 95 / 100 / 100 / 100 | 100 / 100 / 100 / 100 |
| `/for/pax8-msps` (since replaced by `/for/*` segment pages; not re-measured) | 94 / 100 / 100 / 100 | 100 / 100 / 100 / 100 |

The post was measured with a temporary copy of `reconcile-pax8-bill-against-psa-invoices` dated in the past (no post is live before 10 Nov); the copy was not committed.

**How the landing got from 89 to 92 on mobile** (FCP 3.0 s → 2.7 s): the landing now modulepreloads 6 scripts instead of 17, and none of them is auth, TanStack Query options or the Eden API client.

- `/app/*` loaders are split into their own chunks (`codeSplittingOptions.splitBehavior` in `apps/app/vite.config.ts`), so their query options and API client stay out of the entry bundle.
- Route guards (`lib/auth-navigation.ts`) dynamic-import `lib/auth-guards.ts`; `beforeLoad` can't be code-split, so the import is what keeps session and workspace code off marketing pages.
- The waitlist form loads the API client on submit, not on first paint.
- React, the router and Start's client runtime ship as one `framework` chunk (Rolldown `codeSplitting.groups`, client build only) instead of a dozen small preloaded files.
- Tried and dropped: Start's experimental `inlineCss` (no gain: the bigger HTML cancelled the saved stylesheet request).
