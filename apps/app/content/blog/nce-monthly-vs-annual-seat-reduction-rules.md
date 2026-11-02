---
title: "NCE Monthly vs Annual: Seat Reduction and Cancellation Rules"
description: "How Microsoft NCE monthly and annual terms handle cancellations and seat reductions, with the seven-day window explained from Microsoft Learn."
slug: nce-monthly-vs-annual-seat-reduction-rules
publishAt: 2026-11-17T09:00:00Z
updatedAt: 2026-11-17T09:00:00Z
author: SDX Studio
tags: [nce, new commerce experience, microsoft 365, partner center, msp]
targetQuestion: "Can I reduce seats on an NCE annual subscription?"
keyword: nce cancellation policy
faq:
  - q: "Can I reduce seats on an NCE annual subscription mid-term?"
    a: "Only within seven days of when those licences were added. After that, Microsoft says the count can't be decreased until the next cancellation window at renewal."
  - q: "When does the seven-day window start after renewal?"
    a: "Microsoft says it starts at the same datetime the renewal completes, and renewals can take up to 24 hours to process."
  - q: "Can I add seats at any time?"
    a: "Yes. Licences can be increased at any time, and added licences share the subscription's end date, with billing adjustments on the next invoice."
  - q: "Is a monthly term more expensive than an annual term?"
    a: "Monthly terms are generally priced higher than annual terms for the same SKU. Check your distributor or Partner Center price list for the actual figures."
---

<!-- verify: Monthly-term price premium is stated without numbers; no Microsoft primary page found that states it. Keep as general practice or confirm on a current Partner Center price list. | Microsoft's 2026 pricing FAQ (microsoft.com/licensing/news/2026-M365-Packaging-Pricing-Updates-FAQ) speaks to customers generally; confirm the renewal-timing rule applies the same way to CSP/NCE subscriptions bought via Pax8. -->

On a new commerce (NCE) licence-based subscription you can cancel or reduce seats only within seven days of purchase, renewal, or the moment those seats were added. After that, an annual term holds the seat count until renewal. A monthly term renews every month, so you get a fresh seven-day window each month.

## What does Microsoft actually say about the seven-day window?

From Microsoft Learn's [NCE cancellation policy](https://learn.microsoft.com/en-us/partner-center/customers/new-commerce-cancellation-policy): licence-based (per user) subscriptions get a prorated refund within seven calendar days of purchase, and the cancellation window "doesn't reopen until the subscription itself renews into a new term."

The [subscription management page](https://learn.microsoft.com/en-us/partner-center/customers/create-a-new-subscription#cancel-a-subscription) adds the detail that matters for billing:

- Cancellation with a prorated refund is available in the first seven days (168 hours) of any term.
- After the window, the partner "is billed for the full term even if the customer stops paying for or using the subscription."
- Licences can be [decreased only within the first seven days of when they were added](https://learn.microsoft.com/en-us/partner-center/customers/create-a-new-subscription#increase-or-decrease-licenses-in-new-commerce-license-based-subscriptions), whether at initial purchase, renewal or midterm.
- Licences can be increased at any time. Added licences share the subscription's end date.

## How do monthly and annual terms compare?

| | Monthly term | Annual term |
|---|---|---|
| Term length | One month, renews monthly | 12 months |
| Cancel / reduce window | First 7 days of each monthly term | First 7 days of the term, or of seats added midterm |
| After the window | Wait for next month's renewal | Billed for the full term |
| Add seats | Any time | Any time |
| Price | Generally higher per seat than annual | Generally lower per seat |

Microsoft's own cancellation page suggests a monthly term for customers at risk of non-payment, describing it as an option "that allows for subscription cancellation at the end of any month." The price difference between terms varies by product and market. Check the current price list rather than relying on a remembered percentage.

## What happens at renewal?

Per [Microsoft Learn](https://learn.microsoft.com/en-us/partner-center/customers/create-a-new-subscription#subscription-renewals):

- Subscriptions auto-renew by default; you can turn auto-renew off.
- You can schedule changes for the next term: change SKU, increase or decrease licences, or change term and billing frequency.
- Renewal is processed the day after the term end date and can take up to 24 hours. The seven-day window to cancel or reduce starts when renewal completes.

Renewal is also when cost changes. Microsoft's [2026 pricing FAQ](https://www.microsoft.com/licensing/news/2026-M365-Packaging-Pricing-Updates-FAQ) says customers renewing after July 1, 2026 move to new commercial pricing at their next renewal date. If a subscription renews at a new cost, the client's invoice line needs checking that month.

## What does this mean for your client billing?

1. **Match the client contract to the Microsoft term.** If you sell a client monthly flexibility but buy annual seats, an offboarded user leaves you holding the seat until renewal. Decide in writing who carries that cost.
2. **Reduce seats inside the window.** Offboarding requests that arrive late in a term should be queued as scheduled changes for renewal, not forgotten.
3. **Track renewal dates per subscription.** Each one is a moment when price, quantity or term can change, and the invoice should follow.
4. **Reconcile monthly.** The [Pax8 reconciliation process](/blog/reconcile-pax8-bill-against-psa-invoices) catches seats you're paying for but not billing, and prices that didn't move with the renewal.

## Where does SeatTrue help?

SeatTrue doesn't manage subscriptions in Partner Center or Pax8. It checks the result: each month it compares the distributor bill with what each client was invoiced, flagging unbilled seats, stale prices after a renewal and ghost licences for offboarded clients, so you fix them before invoicing.

## FAQ

**Can I reduce seats on an NCE annual subscription mid-term?**
Only within seven days of when those licences were added. After that, Microsoft says the count can't be decreased until the next cancellation window at renewal.

**When does the seven-day window start after renewal?**
Microsoft says it starts at the same datetime the renewal completes, and renewals can take up to 24 hours to process.

**Can I add seats at any time?**
Yes. Licences can be increased at any time, and added licences share the subscription's end date, with billing adjustments on the next invoice.

**Is a monthly term more expensive than an annual term?**
Monthly terms are generally priced higher than annual terms for the same SKU. Check your distributor or Partner Center price list for the actual figures.

For a definitions-first overview, see [what license leakage is](/blog/what-is-license-leakage). To check your own renewals, try a [free margin audit](/#offer).
