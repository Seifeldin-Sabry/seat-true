---
title: "How to Reconcile Your Pax8 Bill Against PSA Invoices"
description: "A monthly process for MSPs to match Pax8 or Partner Center charges to each client invoice, checking seat counts and price before invoices go out."
slug: reconcile-pax8-bill-against-psa-invoices
publishAt: 2026-11-10T09:00:00Z
updatedAt: 2026-11-10T09:00:00Z
author: SDX Studio
tags: [pax8, billing reconciliation, microsoft 365, psa, msp]
targetQuestion: "How do I reconcile my Pax8 bill against my PSA invoices?"
keyword: pax8 billing reconciliation
faq:
  - q: "Can I reconcile Pax8 billing without an API connection?"
    a: "Yes. A CSV export of the distributor bill and a CSV export of your PSA invoices are enough to match every client, SKU, seat count and price."
  - q: "Should I use UnitPrice or EffectiveUnitPrice from a Partner Center file?"
    a: "Microsoft says to use EffectiveUnitPrice for license-based cost, because it reflects promotions, partner earned credit and proration. UnitPrice stays fixed for the term."
  - q: "When should reconciliation happen?"
    a: "Every billing cycle, after the distributor bill is available and before client invoices are sent, so mistakes are fixed on the invoice rather than chased afterwards."
---

<!-- verify: Microsoft's 2026 pricing FAQ (microsoft.com/licensing/news/2026-M365-Packaging-Pricing-Updates-FAQ) speaks to customers generally; confirm the renewal-timing rule applies the same way to CSP/NCE subscriptions bought via Pax8. -->

Reconcile a Pax8 bill by matching every distributor line to a client invoice line, then checking two things: the seat count matches, and the price you billed equals your cost times the markup you agreed with that client. Do it every month before invoices go out, and treat each mismatch as an exception someone must resolve.

## Why isn't a quantity sync enough?

Most native distributor-to-PSA integrations focus on seat quantity. HaloPSA's [Pax8 integration page](https://usehalo.com/integration/pax8-integration), for example, says subscription quantities on the recurring invoice can update automatically when Pax8 subscriptions change. It doesn't describe syncing price or markup.

Quantity is half the check. A line can carry the right number of seats and still be billed at an old price. Under new commerce, cost changes land subscription by subscription at renewal: Microsoft's [2026 pricing FAQ](https://www.microsoft.com/licensing/news/2026-M365-Packaging-Pricing-Updates-FAQ) says the commercial Microsoft 365 price updates took effect on July 1, 2026, and that customers renewing after that date move to the new pricing at their next renewal. Two subscriptions for the same client can change cost in different months. A sync that copies quantity won't notice either one.

## What do you need before you start?

- **The distributor bill for the month.** A Pax8 invoice export, or, if you buy direct, the Partner Center new commerce invoice reconciliation file. For that file, Microsoft says to [use `EffectiveUnitPrice`, not `UnitPrice`](https://learn.microsoft.com/en-us/partner-center/billing/use-the-reconciliation-files), when calculating license-based cost.
- **Your client invoices** (or recurring invoice lines) from the PSA for the same period.
- **A customer mapping.** "Acme Corp" in Pax8 and "Acme Corporation" in the PSA will not match on their own.
- **The markup agreed with each client.** If it lives in someone's head, write it down first.

## How do you reconcile, step by step?

1. **Map customers.** Link each distributor customer to exactly one PSA client. Anything you can't map goes on the exceptions list. Don't guess.
2. **Map products.** Match on SKU and term, not on product name. A monthly-term and an annual-term subscription to the same product are separate lines with separate costs.
3. **Compare quantity.** For each client and SKU, compare distributor seats with billed seats. More distributor seats than billed means unbilled seats. Distributor seats for a client you've offboarded are ghost licences.
4. **Compare price.** Expected price = unit cost × (1 + agreed markup). Billed below that is a stale price or an unapproved discount. Billed above it, or more seats billed than bought, is overbilling, which the client may ask you to refund.
5. **Resolve every exception.** Fix the invoice, mark it as billed elsewhere, or dismiss it with a reason. Record who decided.
6. **Then send invoices.**

## What do mismatches usually look like?

| Exception | What you see | Common cause |
|---|---|---|
| Unbilled seats | Distributor quantity above billed quantity | Seats added mid-month, PSA not updated |
| Stale price | Billed price below cost × (1 + markup) | Subscription renewed at a new cost, invoice line unchanged |
| Ghost licence | Distributor still billing for a client you no longer serve | Offboarding didn't include a licence reduction |
| Overbilling | Billed quantity or price above expected | Seats reduced at the distributor but not in the PSA |
| Unmapped customer | Distributor customer with no PSA match | Name mismatch or a new client |

## How do you keep it from taking all week?

Most of the effort in the first month is mapping customers and SKUs. Keep those mappings and reuse them; after that, review only the exceptions, not every line. Keep the markup per client in one place so step 4 is arithmetic, not archaeology. And agree who can approve an exception and who can only flag one, so a technician spotting an issue doesn't also quietly change prices.

## Where does SeatTrue fit?

SeatTrue runs this check as a margin gate for Microsoft resellers. Upload the Pax8 CSV (Partner Center files also work) and your PSA invoice export, and it lists unbilled seats, stale prices, ghost licences, overbilling and unmapped customers in an exceptions inbox. Your team approves, marks billed, or dismisses each one before invoicing. No integration is required. A Pax8 API connection and HaloPSA sync are planned, not live today.

## FAQ

**Can I reconcile Pax8 billing without an API connection?**
Yes. A CSV export of the distributor bill and a CSV export of your PSA invoices are enough to match every client, SKU, seat count and price.

**Should I use UnitPrice or EffectiveUnitPrice from a Partner Center file?**
Microsoft says to use EffectiveUnitPrice for license-based cost, because it reflects promotions, partner earned credit and proration. UnitPrice stays fixed for the term.

**When should reconciliation happen?**
Every billing cycle, after the distributor bill is available and before client invoices are sent, so mistakes are fixed on the invoice rather than chased afterwards.

If you'd like to see what last month's files say before changing your process, SeatTrue offers a [free margin audit](/#offer) on your own CSVs.
