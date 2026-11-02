---
title: "Microsoft 365 Renewal Price Review Checklist for MSPs"
description: "A copy-ready checklist for MSPs to review each Microsoft 365 subscription renewal: new cost, client price, seat count, term and client communication."
slug: m365-renewal-price-review-checklist
publishAt: 2026-12-15T09:00:00Z
updatedAt: 2026-12-15T09:00:00Z
author: SDX Studio
tags: [checklist, renewals, stale price, microsoft 365, nce, msp]
targetQuestion: "What should an MSP check when a Microsoft 365 subscription renews?"
keyword: microsoft 365 renewal price check
faq:
  - q: "Why review prices at every renewal rather than once a year?"
    a: "Under new commerce, cost is set per subscription term, so each subscription's cost can change when it renews. Renewals are spread across the year, so changes arrive in different months."
  - q: "What is a stale price?"
    a: "A client invoice line still billed at the price that applied before the subscription renewed at a new cost, so the agreed markup is no longer being recovered."
  - q: "How long do I have to reduce seats after renewal?"
    a: "Microsoft Learn says partners have a seven-day window to cancel or reduce licences after renewal completes, starting at the datetime renewal completes."
---

<!-- verify: Microsoft's 2026 pricing FAQ (microsoft.com/licensing/news/2026-M365-Packaging-Pricing-Updates-FAQ) speaks to customers generally; confirm the renewal-timing rule applies the same way to CSP/NCE subscriptions bought via Pax8. -->

When a Microsoft 365 subscription renews, check its new cost on the distributor bill, update the client's invoice price to cost × the agreed markup, confirm the seat count and term still fit the client, and use the seven-day post-renewal window for any reduction. Then tell the client what changed before the invoice arrives.

## Why does every renewal need a price review?

Under new commerce, a subscription's cost is fixed for its term. Microsoft's [reconciliation guidance](https://learn.microsoft.com/en-us/partner-center/billing/use-the-reconciliation-files) notes that `UnitPrice` stays fixed for the billing term. Changes arrive when it renews. Microsoft's [2026 pricing FAQ](https://www.microsoft.com/licensing/news/2026-M365-Packaging-Pricing-Updates-FAQ) says commercial Microsoft 365 price updates took effect July 1, 2026, apply to both annual and monthly billing plans, and reach customers at their next renewal after that date.

If you resell dozens of subscriptions renewing in different months, some line's cost can change almost every month. The usual failure is a stale price: the cost went up at renewal, the invoice line didn't, and your agreed markup shrinks without anyone deciding it should.

Renewal is also the only time, outside the first seven days, that you can [reduce licences or change term](https://learn.microsoft.com/en-us/partner-center/customers/create-a-new-subscription#subscription-renewals) on an annual subscription.

## What's on the renewal review checklist?

Copy this into your PSA as a recurring task for each subscription's renewal date.

**Before renewal (ideally 30 days out)**
- [ ] Confirm the renewal date and current term (monthly, annual, three-year).
- [ ] Compare licensed seats with seats actually assigned in the client's tenant.
- [ ] Decide with the client whether to keep, reduce or change SKU or term.
- [ ] Set any agreed changes as a scheduled change for renewal, or turn off auto-renew if the client is leaving.
- [ ] Tell the client if their price will change, and why.

**After renewal (within seven days)**
- [ ] Check the renewal completed; Microsoft says it can take up to 24 hours.
- [ ] Read the new unit cost from the distributor bill (for Partner Center, `EffectiveUnitPrice`).
- [ ] Recalculate the client price: new cost × (1 + agreed markup).
- [ ] Update the PSA recurring invoice line with the new price.
- [ ] Reduce or cancel seats now if needed. The window closes seven days after renewal completes.
- [ ] Record what changed and who approved it.

**At the next billing close**
- [ ] Confirm the client invoice shows the new price.
- [ ] Confirm the seat count matches the distributor bill.
- [ ] Resolve any remaining difference as an exception.

## What should you tell the client?

Keep it factual and early. A short note works: the subscription renewed on a given date, Microsoft's price for that product changed, and under your agreement the client's price follows cost plus the agreed markup from the next invoice. Link to Microsoft's announcement rather than restating figures you haven't confirmed for their market. Microsoft notes that pricing can vary by country and currency.

If your client agreement doesn't say how cost changes are passed through, add that clause. See [how to set a Microsoft 365 markup policy](/blog/m365-markup-policy-for-msps).

## What goes wrong most often?

- The renewal happens, but nobody opens the PSA line.
- Seats are reduced in the tenant but not on the subscription within the window. That's a future [ghost licence](/blog/ghost-licences-after-offboarding).
- A monthly-term subscription is treated like an annual one, or the other way round.
- The client hears about the increase from the invoice.

## Can this be automated?

The "after renewal" price check can. SeatTrue compares every line of the Pax8 bill (or Partner Center file) with each client's invoice and agreed markup, and flags stale prices as exceptions before invoicing. The before-renewal decisions remain a conversation with the client.

## FAQ

**Why review prices at every renewal rather than once a year?**
Under new commerce, cost is set per subscription term, so each subscription's cost can change when it renews. Renewals are spread across the year, so changes arrive in different months.

**What is a stale price?**
A client invoice line still billed at the price that applied before the subscription renewed at a new cost, so the agreed markup is no longer being recovered.

**How long do I have to reduce seats after renewal?**
Microsoft Learn says partners have a seven-day window to cancel or reduce licences after renewal completes, starting at the datetime renewal completes.

To find stale prices already on your invoices, run a [free margin audit](/#offer) on last month's files.
