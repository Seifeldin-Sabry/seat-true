# SeatTrue content calendar

Two posts a week, Tuesday and Thursday 09:00 UTC, 10 Nov – 17 Dec 2026. Series links point only to posts already published on that date. Blog paths assume `/blog/<slug>`; adjust if the site uses another prefix.

| Publish (UTC) | Title | Type | Target question | Keyword | Slug | Internal links |
|---|---|---|---|---|---|---|
| Tue 10 Nov 2026 09:00 | How to Reconcile Your Pax8 Bill Against PSA Invoices | Problem/how-to | How do I reconcile my Pax8 bill against my PSA invoices? | pax8 billing reconciliation | `reconcile-pax8-bill-against-psa-invoices` | product `/#offer` |
| Thu 12 Nov 2026 09:00 | What Is License Leakage? A Definition for MSPs | Glossary | What is license leakage for an MSP? | license leakage msp | `what-is-license-leakage` | product `/#offer`; `/blog/reconcile-pax8-bill-against-psa-invoices` |
| Tue 17 Nov 2026 09:00 | NCE Monthly vs Annual: Seat Reduction and Cancellation Rules | Problem/how-to | Can I reduce seats on an NCE annual subscription? | nce cancellation policy | `nce-monthly-vs-annual-seat-reduction-rules` | product `/#offer`; `/blog/reconcile-pax8-bill-against-psa-invoices`; `/blog/what-is-license-leakage` |
| Thu 19 Nov 2026 09:00 | SeatTrue vs a Spreadsheet for M365 Billing Reconciliation | Comparison | Is a spreadsheet good enough to reconcile Microsoft 365 billing? | m365 billing reconciliation spreadsheet | `seattrue-vs-spreadsheet-m365-reconciliation` | product `/#offer`; `/blog/what-is-license-leakage` |
| Tue 24 Nov 2026 09:00 | How to Set a Microsoft 365 Markup Policy for MSP Clients | Problem/how-to | How should an MSP set its Microsoft 365 markup? | microsoft 365 markup msp | `m365-markup-policy-for-msps` | product `/#offer`; `/blog/nce-monthly-vs-annual-seat-reduction-rules`; `/blog/reconcile-pax8-bill-against-psa-invoices` |
| Thu 26 Nov 2026 09:00 | Monthly Microsoft 365 Billing Close Checklist for MSPs | Template/checklist | What should an MSP check before sending monthly Microsoft 365 invoices? | msp billing close checklist | `m365-billing-close-checklist` | product `/#offer`; `/blog/reconcile-pax8-bill-against-psa-invoices`; `/blog/m365-markup-policy-for-msps` |
| Tue 01 Dec 2026 09:00 | SeatTrue vs Native Pax8-to-PSA Sync, Rewst and MSPbots | Comparison | Does a Pax8-to-PSA sync catch Microsoft 365 billing errors? | pax8 psa sync | `seattrue-vs-pax8-psa-sync` | product `/#offer`; `/blog/what-is-license-leakage`; `/blog/m365-billing-close-checklist` |
| Thu 03 Dec 2026 09:00 | Ghost Licences: Why Offboarded Clients Keep Costing You | Problem/how-to | Why am I still paying for Microsoft 365 licences after a client leaves? | ghost licences microsoft 365 | `ghost-licences-after-offboarding` | product `/#offer`; `/blog/nce-monthly-vs-annual-seat-reduction-rules`; `/blog/m365-markup-policy-for-msps` |
| Tue 08 Dec 2026 09:00 | What Is NCE? Microsoft's New Commerce Experience Defined | Glossary | What is NCE in Microsoft licensing? | what is nce microsoft | `what-is-nce-new-commerce-experience` | product `/#offer`; `/blog/nce-monthly-vs-annual-seat-reduction-rules`; `/blog/ghost-licences-after-offboarding` |
| Thu 10 Dec 2026 09:00 | SeatTrue vs Gradient MSP Synthesize: Which Fits Your MSP? | Comparison | Should I use Gradient Synthesize or SeatTrue for Microsoft billing reconciliation? | gradient synthesize alternative | `seattrue-vs-gradient-synthesize` | product `/#offer`; `/blog/m365-markup-policy-for-msps`; `/blog/seattrue-vs-pax8-psa-sync` |
| Tue 15 Dec 2026 09:00 | Microsoft 365 Renewal Price Review Checklist for MSPs | Template/checklist | What should an MSP check when a Microsoft 365 subscription renews? | microsoft 365 renewal price check | `m365-renewal-price-review-checklist` | product `/#offer`; `/blog/m365-markup-policy-for-msps`; `/blog/ghost-licences-after-offboarding` |
| Thu 17 Dec 2026 09:00 | How SeatTrue Calculates Monthly License Leakage | Methodology | How is monthly license leakage calculated? | how to calculate license leakage | `how-seattrue-calculates-license-leakage` | product `/#offer`; `/blog/m365-billing-close-checklist`; `/blog/what-is-license-leakage` |

**Mix:** Comparison: 3, Glossary: 2, Methodology: 1, Problem/how-to: 4, Template/checklist: 2

## How publishing works

- Posts live in `apps/app/content/blog/<slug>.md`. Frontmatter is validated at build and in tests (`apps/app/src/lib/content/blog.ts`): title ≤ 60 chars, description ≤ 155, kebab-case slug, ISO `publishAt`/`updatedAt`, tags, targetQuestion, keyword, and at least one `faq` item.
- A post is visible only when `publishAt <= now`, checked on the server per request. Before that `/blog/<slug>` is a 404 and the post is left out of `/blog`, `/sitemap.xml`, `/rss.xml`, `/llms.txt`, `/llms-full.txt` and its OG image. No rebuild or deploy is needed on the day.
- To change a date, edit `publishAt` (and `updatedAt` when the content changes) and deploy.
- `<!-- verify: ... -->` comments stay in the source and are stripped before rendering. Remove each one once checked.

## Verify flags (Seif to check before each date)

| Publish (UTC) | Post | What to verify |
|---|---|---|
| 2026-11-10 | `reconcile-pax8-bill-against-psa-invoices` | Microsoft's 2026 pricing FAQ (microsoft.com/licensing/news/2026-M365-Packaging-Pricing-Updates-FAQ) speaks to customers generally; confirm the renewal-timing rule applies the same way to CSP/NCE subscriptions bought via Pax8. |
| 2026-11-12 | `what-is-license-leakage` | Microsoft's 2026 pricing FAQ (microsoft.com/licensing/news/2026-M365-Packaging-Pricing-Updates-FAQ) speaks to customers generally; confirm the renewal-timing rule applies the same way to CSP/NCE subscriptions bought via Pax8. |
| 2026-11-17 | `nce-monthly-vs-annual-seat-reduction-rules` | Microsoft's 2026 pricing FAQ (microsoft.com/licensing/news/2026-M365-Packaging-Pricing-Updates-FAQ) speaks to customers generally; confirm the renewal-timing rule applies the same way to CSP/NCE subscriptions bought via Pax8. |
| 2026-11-17 | `nce-monthly-vs-annual-seat-reduction-rules` | Monthly-term price premium is stated without numbers; no Microsoft primary page found that states it. Keep as general practice or confirm on a current Partner Center price list. |
| 2026-11-19 | `seattrue-vs-spreadsheet-m365-reconciliation` | Microsoft's 2026 pricing FAQ (microsoft.com/licensing/news/2026-M365-Packaging-Pricing-Updates-FAQ) speaks to customers generally; confirm the renewal-timing rule applies the same way to CSP/NCE subscriptions bought via Pax8. |
| 2026-11-24 | `m365-markup-policy-for-msps` | Microsoft's 2026 pricing FAQ (microsoft.com/licensing/news/2026-M365-Packaging-Pricing-Updates-FAQ) speaks to customers generally; confirm the renewal-timing rule applies the same way to CSP/NCE subscriptions bought via Pax8. |
| 2026-11-26 | `m365-billing-close-checklist` | Microsoft's 2026 pricing FAQ (microsoft.com/licensing/news/2026-M365-Packaging-Pricing-Updates-FAQ) speaks to customers generally; confirm the renewal-timing rule applies the same way to CSP/NCE subscriptions bought via Pax8. |
| 2026-12-01 | `seattrue-vs-pax8-psa-sync` | HaloPSA page is silent on price/markup sync; post says 'not described', not 'absent'. Rewst/MSPbots capabilities are from their own pages. |
| 2026-12-01 | `seattrue-vs-pax8-psa-sync` | Microsoft's 2026 pricing FAQ (microsoft.com/licensing/news/2026-M365-Packaging-Pricing-Updates-FAQ) speaks to customers generally; confirm the renewal-timing rule applies the same way to CSP/NCE subscriptions bought via Pax8. |
| 2026-12-03 | `ghost-licences-after-offboarding` | Microsoft's offboarding page describes admin-center steps for directly bought subscriptions; for CSP seats the reduction is made via Pax8 or Partner Center. Wording reflects this, but confirm. |
| 2026-12-08 | `what-is-nce-new-commerce-experience` | Microsoft's 2026 pricing FAQ (microsoft.com/licensing/news/2026-M365-Packaging-Pricing-Updates-FAQ) speaks to customers generally; confirm the renewal-timing rule applies the same way to CSP/NCE subscriptions bought via Pax8. |
| 2026-12-10 | `seattrue-vs-gradient-synthesize` | meetgradient.com/synthesize currently describes the product as 'Reconcile'; confirm the current product name. PSA write-back is not stated on Gradient's page, so the post says 'integrations' only. Pricing checked Nov 2026. |
| 2026-12-15 | `m365-renewal-price-review-checklist` | Microsoft's 2026 pricing FAQ (microsoft.com/licensing/news/2026-M365-Packaging-Pricing-Updates-FAQ) speaks to customers generally; confirm the renewal-timing rule applies the same way to CSP/NCE subscriptions bought via Pax8. |
| 2026-12-17 | `how-seattrue-calculates-license-leakage` | Confirm Northbeam IT demo figures (8 clients, $548.10/mo) match the live demo, and that the product handles lines with both unbilled seats and a stale price exactly as the formulas show. |

14 flags across 12 posts. The Microsoft 2026 pricing FAQ flag repeats on 9 posts: one answer clears all of them.
