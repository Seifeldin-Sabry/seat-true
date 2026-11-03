# SeatTrue launch playbook

Draft, 2 Nov 2026. Nothing has been created, started or sent. Built with the orchestrator "grow" sequence: positioning-angle → lead-magnet → direct-response-copy → email-sequences → keyword-research → seo-content.

**Key:** **(A)** marks an assumption to replace with real data. **[verify]** marks a channel or fact not yet confirmed.

**Dates**
- Day -7 to 0: Mon 9 – Sun 15 Nov.
- Launch weeks 1–6: 16 Nov – 27 Dec.
- Cold email starts Mon 23 Nov (launch week 2), the first day the new mailboxes have 14 days of warmup. That only holds if the domains are bought by Sat 7 Nov.
- LinkedIn, content and audits start in week 1.

---

## 1. Positioning

**Only statement.** SeatTrue is the only pre-invoice margin gate that checks every Microsoft line on the Pax8 bill against what each client is invoiced, in quantity and in price (cost × the markup agreed with that client). It's for MSPs whose PSA sync copies quantities and never checks price.

**ICP**
- Who: owners, COOs and finance or billing leads at MSPs with 10–150 staff, US and UK, buying Microsoft 365 through Pax8.
- Sharpest segment: UK HaloPSA shops that also buy through Giacom or Sherweb.
- Leads already sourced (`~/leads/seattrue-msp-companies-us-uk.csv`): 400 companies, 328 US and 72 UK.
  - By size: 228 at 51–200 staff, 166 at 21–50, 6 at 11–20.
  - Companies only, with no contacts yet. Drop companies above 150 staff when GetLeads returns headcount.

**Enemy.** The "quantities synced, so billing's fine" assumption.
- Native Pax8 → PSA syncs copy quantity only and never check price (competitor research, 2 Nov).
- Microsoft's 1 July 2026 price rise reaches each existing subscription at its next renewal ([CloudFactory](https://blog.cloudfactorygroup.com/posts/microsoft-365-pricing-packaging-update-effective-july-1-2026-what-every-csp-partner-must-know), [Work365](https://resources.work365apps.com/blog/microsoft-365-july-2026-price-increase-what-csp-partners-need-to-do-now)).
- So client prices go stale one subscription at a time.

**Versus the alternatives**

| Alternative | What it lacks | SeatTrue line |
|---|---|---|
| Gradient Reconcile: $299/$699/$999 a month plus a $199 Microsoft add-on ([meetgradient.com/pricing](https://www.meetgradient.com/pricing), checked 2 Nov) | Broader and pricier. Its public pages show no check against a per-client markup. | "Gradient reconciles everything. SeatTrue gates margin on Microsoft, from $49." |
| Native Pax8 → Halo/ConnectWise sync | Syncs quantity only; no approval step | "Your sync copies seats. Nobody checks the price." |
| Spreadsheet close | Takes hours and still misses lines | Exceptions inbox, cleared before invoicing |
| License Drift, MSPbots, Rewst | Cheaper, or DIY | Markup check per client, plus roles and an audit trail |

**Proof points (honest only)**
- Founder-led by Seif, whose outbound agency SDX Studio works only with MSPs and MSSPs.
- Worked demo, always labelled: *Example: Northbeam IT, $548.10/mo leakage.*
- Problem evidence comes from BigIdeasDB research (`~/bigideasdb-research.md`):
  - r/msp pain points, used as research only: PSA "double or triple charges us", and price jumps locked in for 12 months.
  - The MSP vertical has no system-of-record vendor.
- No customer results exist yet. Don't imply any.

## 2. Offer stack (Hormozi value equation)

| Lever | How SeatTrue moves it |
|---|---|
| Dream outcome | Every Microsoft line is billed at cost × agreed markup before the invoice leaves. No stale renewals, unbilled seats or ghost licences. |
| Perceived likelihood | The free audit runs on *their* Pax8 export and returns a $ figure before they pay anything. |
| Time delay | Audit result in 2 working days (A: Seif to confirm turnaround). First live close the same month. |
| Effort | A CSV upload is enough to start; no Pax8 API needed. Roles: Owner, Admin, Tech. Onboarding call included. |

**Founding-customer mechanics**
1. **Free margin audit.**
   - The MSP sends last month's Pax8 export plus a PSA or accounting invoice export.
   - Seif returns an exceptions list with a $ figure per line.
   - Files are deleted after 30 days unless they subscribe (A: confirm the data policy).
2. **Honest go/no-go.** If the audit finds less leakage than the subscription costs, Seif tells them not to buy. This is the risk reversal, and it needs no refunds.
3. **Founding price lock for the first 20 MSPs.**
   - Starter $49/mo (50 clients) or Pro $179/mo (unlimited clients), unlimited users on both, stays fixed while the subscription stays active.
   - Show a real "N of 20 left" count on /pricing.
4. **4 onboarding slots a week.**
   - Use a Calendly event capped at 4 bookings a week. This is a real capacity limit.
   - When the week is full, say so and offer next week.
5. **Billing terms.** Monthly via Stripe. No refunds; cancel any time, effective at period end.
   - Say this plainly on /pricing and in the checkout.
   - No financing, "pay later" or countdown-timer language.

> Change from `~/q1-q2-campaigns.md`: that file says "3 months free after the audit". The product facts are a free audit plus a founding price lock, so the free months are dropped from all copy below.

**Demo / audit-review script (about 15 min)**

| Min | Talk track |
|---|---|
| 0–2 | Agenda and permission: "I'll show what the audit found, then you decide if it's worth $49. Fair?" |
| 2–5 | Their close today: who invoices, which PSA, which distributors, and how renewals get repriced. Let them name the pain. |
| 5–10 | Exceptions inbox on their data, or the labelled Northbeam IT example if no export yet. Show one of each: stale renewal price, unbilled seat, ghost licence, overbilling, unmapped customer. Show the $ total and how a Tech clears a line while the Owner signs off. |
| 10–12 | Objections. "We have the sync": it copies quantity, not price. "Gradient": broader, ~$498/mo for Microsoft resellers; this does one job. "Data": CSV only, deleted after 30 days if you don't continue. |
| 12–15 | Close. Is the leakage worth more than the plan? If yes: founding lock (N of 20 left), pick one of this week's 4 onboarding slots, monthly, cancel any time effective at period end. If no: "Then don't buy. I'll re-run it after your next renewal cluster." |

## 3. Lead magnet

**Primary: Free Margin Audit (service-style magnet).**

**Content upgrade: "The Monthly M365 Billing Close Checklist"**
- Pairs with the blog post `m365-billing-close-checklist` (Thu 26 Nov).

**Checklist outline**
- **Title:** The Monthly M365 Billing Close Checklist.
- **Subtitle:** 12 checks to run before Microsoft invoices go out, so renewals, new seats and leavers are billed right.

Steps:
1. Export last month's Pax8 bill. Note the `cost`, `quantity`, `term` and `subscriptionId` columns.
2. Export the PSA invoice lines for the same period.
3. Map every Pax8 company to a PSA client, and flag unmapped customers.
4. Quantity check: seats on Pax8 vs seats invoiced. Flag unbilled seats.
5. Price check: invoiced unit price vs cost × the agreed markup for that client.
6. Renewal check: which subscriptions renewed since 1 July 2026? Was the client price updated?
7. NCE term check: monthly vs annual buy rates differ per variant.
8. Ghost licences: seats for offboarded users or departed clients.
9. Overbilling: client billed above agreed markup (a trust risk, not a win).
10. Mid-month adds: prorated charges with no matching invoice line.
11. Sign-off: who cleared each exception, and when.
12. Log the $ recovered this month.
- Bonus: a markup-policy table template, linking to `m365-markup-policy-for-msps`.
- CTA: "Rather not do this by hand? Send the export, get the audit free."

**Audit landing form copy (/audit)**
- **Headline:** Find out what your Microsoft billing missed last month.
- **Sub:** Send one Pax8 export. Get every unbilled seat, stale renewal price and ghost licence back as a list with a $ figure. Free, before you pay anything.
- **Bullets:**
  - Checks price, not just quantity: cost × the markup you agreed per client.
  - Catches renewals that missed Microsoft's July 2026 increase.
  - No integration or Pax8 API access needed. A CSV is enough.
  - If it finds less than SeatTrue costs, we'll tell you not to buy.
- **Fields:** work email, first name, company, PSA (Halo / ConnectWise / Autotask / other), distributors (Pax8 / Giacom / Sherweb / other).
- **Button:** Book my free audit.
- **Under the button:** "Founding price lock for the first 20 MSPs. 4 onboarding slots a week. No spam; unsubscribe any time."
- **Checklist form:** email only. Button: "Send me the checklist".

## 4. Launch timeline

### Days -7 to 0 (Mon 9 – Sun 15 Nov): prerequisites

| Item | Detail | Owner |
|---|---|---|
| Domains | Buy 2 lookalike domains via Zapmail by **Sat 7 Nov**, kept apart from the SDX brand | Seif |
| Mailboxes | 2 per domain = 4 inboxes (A), into Smartlead warmup, ≥14 days, started by Mon 9 Nov. Antwerp address and a "reply no" line in the signature. | Seif + Claude |
| Deploy | Site live with /, /audit, /pricing, /blog by Mon 9 Nov. The blog starts Tue 10 Nov. | Seif |
| Stripe live | Starter and Pro prices, founding price IDs, cancel-at-period-end | Seif |
| Calendly | "SeatTrue 15-min audit" event and "Onboarding" event capped at 4 a week | Seif |
| Waitlist + founding list | Waitlist form on /; founding list = sheet of the 20 lock slots | Claude drafts, Seif publishes |
| Pax8 API | Email integrations@pax8.com for OAuth delegation (approval is case by case) | Seif |
| List build | See below | Claude |
| 10 design-partner profiles | See below | Claude |

**List build**
- Run GetLeads decision-maker lookup on the 400 companies: owner, MD, COO, operations, finance, billing.
- Budget 2 credits per usable contact (SDX's volume-plan, 24 Oct).
- Use Loopster for any gap.
- Apify up to $10, only if both fall short.
- Dedupe by company domain against all SDX MSSP lists before loading.

**10 design-partner target profiles** (types, not named companies)
1. UK HaloPSA MSP, 20–50 staff, Pax8 plus Giacom.
2. UK HaloPSA MSP, 51–150 staff, Pax8 plus Sherweb.
3. US ConnectWise MSP, 21–50 staff, Pax8 only, with a part-time billing admin.
4. US Autotask MSP, 51–150 staff, with a finance lead who owns month-end.
5. MSP that grew by acquisition, with two client lists to map.
6. MSP with mostly NCE annual commitments and a mid-2026 renewal cluster.
7. MSP currently hiring a billing or finance admin.
8. MSP whose owner still runs invoicing.
9. Co-managed IT provider billing per seat with mixed markups by client.
10. Former Gradient trial user who found it too broad (screen for this on calls).

### Day by day, weeks 1–2

LinkedIn here means Seif's personal profile (HeyReach account 266688). The SDX Studio page is brand-only.

| Day | Email (Smartlead) | LinkedIn | Content / community / ops |
|---|---|---|---|
| Mon 16 Nov | — (warmup) | 6 invites (SeatTrue share, §5) | Founder post #1: the July renewal problem |
| Tue 17 | — | 6 invites | Blog: `nce-monthly-vs-annual-seat-reduction-rules`; company page reshares |
| Wed 18 | — | 6 invites, plus M1 to accepts | MSPGeek: introduce, answer billing threads (no pitch) |
| Thu 19 | — | 6 invites | Blog: `seattrue-vs-spreadsheet-m365-reconciliation` |
| Fri 20 | — | 6 invites | Founder post #2: anatomy of a ghost licence. Friday numbers. |
| Mon 23 | Launch: 4 inboxes × 5 = 20 new contacts | 6 invites | Load wave 1 (100 contacts) into Smartlead |
| Tue 24 | 20 | 6 | Blog: `m365-markup-policy-for-msps` |
| Wed 25 | 20 | 6 | Run the first audits received; reply within 2 h |
| Thu 26 | UK only (US Thanksgiving) | 6 | Blog: `m365-billing-close-checklist`; checklist magnet goes live |
| Fri 27 | Ramp to 10 per inbox; UK only | 6 | Founder post #3: Example Northbeam IT walkthrough |

### Weeks 3–6

| Week | Email: new contacts (4 inboxes, ramp 5→10→15→20/day, never >25) | LinkedIn invites | Content | Community / directories |
|---|---|---|---|---|
| 3 (30 Nov) | 100 | 25 | `seattrue-vs-pax8-psa-sync`, `ghost-licences-after-offboarding` | Apply to Pax8 Marketplace (curated waitlist, [pax8.com/marketplace/vendors](https://www.pax8.com/en-us/marketplace/vendors)) |
| 4 (7 Dec) | 100 | 25 | `what-is-nce-…`, `seattrue-vs-gradient-reconcile` | Halo community [verify]; SaaSHub and AlternativeTo listings |
| 5 (14 Dec) | 100 | 25 | `m365-renewal-price-review-checklist`, `how-seattrue-calculates-license-leakage` | ConnectWise IT Nation / Kaseya user-group posts where rules allow [verify] |
| 6 (21 Dec) | 50 (holidays) | 15 | Repost best performers | Product Hunt only once 3+ paying users (Jan) |

**Email capacity check.** At 20 sends per inbox per day, 4 inboxes send about 400 emails a week. Each contact gets 4 emails, so steady state is about 100 new contacts a week.

**Founder posts.** Mon and Fri on the personal profile (Wed is BookedTrue). Headline: "Builder of SeatTrue and BookedTrue, from SDX Studio".

**Communities.** Contribute first, link only where the rules allow, and never use Reddit.
- MSPGeek (Discord/Slack, [mspgeek.org](https://mspgeek.org/about-us/)).
- Pax8 partner community [verify].
- HaloPSA community/Discord [verify].
- ConnectWise IT Nation and Kaseya user groups [verify].

**AI-search mentions**
- Comparison pages plus honest "best Pax8 reconciliation tools" listicles that include competitors.
- Methodology page (`how-seattrue-calculates-license-leakage`).
- Directories: SaaSHub, AlternativeTo, BetaList.
- G2 and Capterra only after real paying users.
- AI-tool directories only if SeatTrue ships a genuine AI feature.

## 5. LinkedIn capacity (single sender: Seif personal, shared with SDX MSSP)

**HeyReach's documented limits**
- Default 25 connection requests a day once warmed, with a weekly hard cap of 200 ([help.heyreach.io/…/15128619](https://help.heyreach.io/en/articles/15128619-how-do-connection-request-limits-work-in-heyreach)).
- Its safety article says about 100 requests a week per account, and 200 actions a day ([help.heyreach.io/…/9877960](https://help.heyreach.io/en/articles/9877960-is-heyreach-safe-to-use)).
- **Plan to the lower figure: 100 invites a week in total.**
- HeyReach documents no follow-up message limit. Keep all actions well under 200 a day.
- Keep acceptance above 20%, and withdraw invites older than 3 weeks.

| Week | SDX MSSP | SeatTrue | BookedTrue | Total |
|---|---|---|---|---|
| 1 (16 Nov) | 50 | 30 | 0 | 80 |
| 2 (23 Nov) | 50 | 30 | 20 | 100 |
| 3–5 | 50 | 25 | 25 | 100 |
| 6 (21 Dec) | 30 | 15 | 15 | 60 |

**No-overlap rule**
- One company sits in only one HeyReach campaign in any 90-day window.
- Any company already in SDX's MSSP pipeline stays SDX-only.
- SeatTrue LinkedIn goes to Tier A contacts (UK Halo, hiring billing). Everyone else is email-only.

## 6. Outbound sequences

**Smartlead**
- Plain text: Day 0, 3, 7, plus a breakup on Day 12 (threaded, empty subject on steps 2–4).
- Emails 1–3 have no tracking; only email 3 has a link.
- US and UK only.

**Email 1 (Day 0, no link)**
- Subject A: `renewal pricing at {{company_name}}`
- Subject B: `pax8 vs your invoices`

> Hi {{first_name}}, Microsoft's July increase reaches each subscription at its renewal, not on one date. So client prices in the PSA go stale one at a time, and the sync won't flag it.
>
> Has anyone at {{company_name}} checked every Microsoft line against cost × your agreed markup since July?
>
> Seif

**Email 2 (Day 3)**

> Asking because the Pax8 → PSA sync copies quantities, never price. The leaks I keep seeing: renewals still billed at the old price, mid-month seats never invoiced, licences running for clients who've left.
>
> I built SeatTrue to list only those exceptions before you invoice, each with a $ figure. It reads the Pax8 export, so no integration to try it.

**Email 3 (Day 7, link)**

> Send last month's Pax8 export and I'll return your margin exceptions free. If it finds less than the tool costs, I'll tell you not to buy. {{booking_link}}

**Email 4: breakup (Day 12)**

> Closing the loop, {{first_name}}. I'll assume billing's covered. If renewals ever start drifting, reply "audit" and I'll run one. Either way, good luck with the year-end close.

**Signature:** Seif · SeatTrue (from SDX Studio) · Antwerp address · "Not relevant? Reply no and I won't email again."

**HeyReach** (Tier A only; a reply on either channel stops both)
- **Connection request:** blank.
- **M1:** "Thanks {{first_name}}. Quick one: does your PSA catch it when a Microsoft renewal goes up and the client price doesn't?"
- **M2 (+4d):** "I built a pre-invoice margin check for this: Pax8 cost × your agreed markup vs what you bill, plus unbilled seats and ghost licences. Runs from a CSV."
- **M3 (+7d):** "Happy to run it on one month of your data, free: {{booking_link}}"

## 7. Nurture: waitlist and audit sign-ups

Welcome blueprint: Day 0, 1, 2, 4, 7. The sequence stops when an audit is booked or a subscription is paid.

| # | Day | Subject | Job |
|---|---|---|---|
| 1 | 0 | Your M365 close checklist (and the audit) | Promise: deliver the checklist or audit next steps. Quick win: check #6 (July renewals). Open loop: "tomorrow, why the sync can't see this". |
| 2 | 1 | Why I built a margin gate | Story: SDX works only with MSPs; quantities sync, price doesn't. Soft mention of SeatTrue. |
| 3 | 2 | The 10-minute renewal check | Quick win: filter Pax8 for subscriptions renewed since 1 July and compare unit price to the PSA. CTA: reply with what you found. |
| 4 | 4 | What $548.10 of leakage looks like | Proof: the labelled *Example: Northbeam IT* breakdown by exception type. Medium CTA: book the audit. |
| 5 | 7 | Founding price, while it lasts | Offer: Starter $49 / Pro $179 locked for the first 20 MSPs; 4 onboarding slots a week; cancel any time, effective at period end. Objection: "we already use Gradient/the sync". |

## 8. SEO and AI-search plan

Volumes are not measured yet. Check them in Search Console and the free tools from the keyword-research skill before writing new pages beyond the blog calendar.

| Page | Primary keyword | Secondary keywords | Intent |
|---|---|---|---|
| / | MSP license margin | Microsoft 365 license reconciliation for MSPs | Commercial |
| /pricing | seattrue pricing | M365 reconciliation tool cost | Transactional |
| /compare/gradient | gradient reconcile alternative | gradient msp pricing | Commercial (vs) |
| /compare/pax8-psa-sync | pax8 psa sync | pax8 halopsa / connectwise integration price | Commercial |
| /compare/spreadsheet | m365 billing reconciliation spreadsheet | — | Commercial |
| /for/msps | MSP microsoft 365 billing | msp license reconciliation | Commercial |
| /for/msp-finance-and-billing-teams | msp billing reconciliation | msp invoice audit microsoft | Commercial |
| /integrations/halopsa, /integrations/connectwise | halopsa pax8 billing; connectwise pax8 reconciliation | unsynced subscriptions pax8 | Commercial |
| /audit | pax8 billing reconciliation | free M365 billing audit | Transactional |
| /glossary/* | what is NCE; license leakage; ghost licence; NCE seat management | — | Informational |

- **Cluster:** the pillar is `reconcile-pax8-bill-against-psa-invoices`, and every post links to it and to /audit.
- **On-page:** answer each glossary question in 40–60 words under the H2 so it can be quoted as a snippet or an AI answer.

## 9. Metrics and kill criteria

**North star:** monthly closes completed. That is a paying MSP clearing its exceptions inbox before invoicing.

| Week | Contacts touched | Positive replies | Audits booked | Audits delivered | Paid |
|---|---|---|---|---|---|
| 1 | 30 (LinkedIn) | 1 (A) | 1 (A) | 0 | 0 |
| 2 | 130 | 3 (A) | 2 (A) | 1 | 0 |
| 3 | 125 | 4 (A) | 3 (A) | 2 | 1 (A) |
| 4 | 125 | 4 (A) | 3 (A) | 3 | 1 (A) |
| 5 | 125 | 4 (A) | 3 (A) | 3 | 1 (A) |
| 6 | 65 | 2 (A) | 1 (A) | 2 | 1 (A) |

**Funnel per 300 contacts (all rates are assumptions)**
- Positive reply 3.3% → 10.
- Audit booked 60% → 6.
- Audit delivered 80% → 5.
- Paid 30% → 1–2.

**Kill and change rules**
- **Demand test:** fewer than 10 positive replies by about 300 contacts (around the end of week 4) → change the angle (subject, hook or offer, one at a time).
- Two failed angles (about 600 contacts) → park SeatTrue.
- 5 delivered audits that each find less than $49/mo of leakage → the pain is too small. Stop.
- Bounces above 2% in a day → pause and re-verify. Any spam complaint → pause that inbox for 7 days.

## 10. Week-1 task list (Sat 7 – Sun 15 Nov)

| # | Task | Owner | Depends on |
|---|---|---|---|
| 1 | Buy 2 domains, 4 Zapmail inboxes; DNS (SPF, DKIM, DMARC) | Seif | — |
| 2 | Connect the inboxes to Smartlead and start warmup | Seif | 1 |
| 3 | Deploy site: /, /audit, /pricing, /blog | Seif | — |
| 4 | Stripe live prices, founding price IDs, cancel at period end | Seif | 3 |
| 5 | Calendly audit event plus onboarding event capped at 4 a week | Seif | — |
| 6 | Email integrations@pax8.com for OAuth delegation | Seif | — |
| 7 | GetLeads decision-maker lookup on 400 companies; dedupe vs SDX lists | Claude | Seif OK on credits |
| 8 | Tier A/B split, first lines for Tier A | Claude | 7 |
| 9 | Draft the Smartlead campaign and HeyReach list (not started) | Claude | 7, Seif review |
| 10 | Checklist PDF and audit form copy into the site | Claude drafts, Seif ships | 3 |
| 11 | Founder posts #1–3 drafted | Claude | — |
| 12 | Audit runbook: CSV intake, 2-day turnaround, data deletion | Seif | — |
| 13 | Join MSPGeek; verify Halo, Pax8 and IT Nation community rules | Seif | — |

## 11. Risks

| Risk | Mitigation |
|---|---|
| Pax8 refuses API delegation | CSV upload stays the core path; the audit already works from CSV |
| Deliverability on new domains | 14-day warmup, ≤20 sends per inbox per day, plain text, no tracking, 2% bounce stop rule |
| One LinkedIn sender shared three ways | 100 a week total; dedupe by company; lean on email |
| Gradient adds markup checks | Compete on price ($49–$179 vs ~$498), setup time and the UK Halo + Giacom niche |
| Halo or Pax8 add native price sync | Stay multi-distributor plus markup policy; keep the audit-trail sign-off |
| $99 tools and free AI skills | Sell the gate and the audit trail, not the matching |
| Leakage claims unproven | Only quote the labelled example until real audits exist; then publish anonymised ranges with consent |
| Pax8 CSV columns are assumed | The first real export replaces them (audit doubles as data) |
