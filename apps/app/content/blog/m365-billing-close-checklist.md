---
title: "Monthly Microsoft 365 Billing Close Checklist for MSPs"
description: "A copy-ready monthly billing close checklist for MSPs reselling Microsoft 365: inputs, quantity and price checks, sign-off, and post-invoice follow-ups."
slug: m365-billing-close-checklist
publishAt: 2026-11-26T09:00:00Z
updatedAt: 2026-11-26T09:00:00Z
author: SDX Studio
tags: [checklist, billing close, microsoft 365, msp, pax8]
targetQuestion: "What should an MSP check before sending monthly Microsoft 365 invoices?"
keyword: msp billing close checklist
faq:
  - q: "When should the billing close happen?"
    a: "After the distributor bill for the period is available and before client invoices are sent. Fixing a line on a draft is easier than issuing a credit later."
  - q: "Who should sign off the close?"
    a: "Someone with authority over pricing, such as an owner or billing admin. Technicians can flag exceptions, but approvals should sit with a named role."
  - q: "How should exceptions be recorded?"
    a: "Each one should end in a decision: fixed on the invoice, marked as billed elsewhere, or dismissed with a reason, plus who decided and when."
---

<!-- verify: Microsoft's 2026 pricing FAQ (microsoft.com/licensing/news/2026-M365-Packaging-Pricing-Updates-FAQ) speaks to customers generally; confirm the renewal-timing rule applies the same way to CSP/NCE subscriptions bought via Pax8. -->

Before sending monthly Microsoft 365 invoices, an MSP should confirm it has this month's distributor bill, map every distributor customer to a client, check seat counts and prices line by line against each client's agreed markup, resolve every exception with a named approver, and queue any seat reductions that must wait for renewal.

## Why use a checklist for the billing close?

The month-end close is repetitive, deadline-driven, and easy to shortcut. A checklist makes the shortcuts visible. It also lets someone other than the usual person run the close without guessing.

Copy the list below into your PSA, ticketing system or project tool and run it every cycle.

## What's on the monthly close checklist?

**Inputs**
- [ ] Download this period's distributor bill (Pax8 invoice export, or the Partner Center new commerce invoice reconciliation file).
- [ ] If using Partner Center, take cost from `EffectiveUnitPrice`, not `UnitPrice`, as [Microsoft advises](https://learn.microsoft.com/en-us/partner-center/billing/use-the-reconciliation-files).
- [ ] Export this period's draft client invoices or recurring invoice lines from the PSA.
- [ ] Confirm the per-client markup list is current.

**Mapping**
- [ ] Every distributor customer maps to exactly one PSA client.
- [ ] Every new customer on the bill has been added to the mapping.
- [ ] SKUs are matched on product and term (monthly and annual terms kept separate).

**Quantity**
- [ ] Distributor seats equal billed seats for each client and SKU.
- [ ] Seats added mid-month are on the invoice.
- [ ] No distributor seats remain for clients you've offboarded.

**Price**
- [ ] Each billed price equals cost × (1 + that client's markup).
- [ ] Subscriptions that renewed this period are billed at their new cost plus markup.
- [ ] No line is billed above expected without a documented reason.

**Decisions**
- [ ] Every exception is fixed, marked billed, or dismissed with a reason.
- [ ] Approvals were made by an authorised role, not by whoever spotted the issue.
- [ ] The final exception list is saved with the period.

**After invoicing**
- [ ] Seat reductions that missed the seven-day window are scheduled for renewal.
- [ ] Offboarded clients' subscriptions are set not to auto-renew, or reduced at renewal.
- [ ] Any overbilling found is handled with the client according to your policy.

## Why do the renewal items matter?

Two Microsoft rules make renewals a monthly concern rather than an annual one.

First, seat reductions are time-limited. Microsoft Learn says licences on new commerce subscriptions can be [decreased only within the first seven days](https://learn.microsoft.com/en-us/partner-center/customers/create-a-new-subscription#increase-or-decrease-licenses-in-new-commerce-license-based-subscriptions) of being added, and otherwise only at the next window at renewal. You can [schedule changes for renewal](https://learn.microsoft.com/en-us/partner-center/customers/create-a-new-subscription#subscription-renewals), including fewer licences or turning auto-renew off.

Second, cost changes arrive at renewal. Microsoft's [2026 pricing FAQ](https://www.microsoft.com/licensing/news/2026-M365-Packaging-Pricing-Updates-FAQ) says customers renewing after July 1, 2026 move to new commercial pricing at their next renewal. With renewals spread through the year, some line's cost changes almost every month.

## What usually goes wrong at month-end?

- The mapping table is out of date, so a new client's seats never reach an invoice.
- The price check is skipped because quantities matched.
- An offboarded client's subscription quietly renews.
- Someone fixes a line but nobody records why, so it recurs next month.

For the reasoning behind each check, see [how to reconcile a Pax8 bill](/blog/reconcile-pax8-bill-against-psa-invoices) and [how to set a markup policy](/blog/m365-markup-policy-for-msps).

## Can this checklist be automated?

The mapping, quantity and price sections can. SeatTrue takes the distributor CSV and PSA invoice export, runs the quantity and price checks per client, and puts each exception in an inbox where your team approves, marks billed or dismisses it, with Owner, Admin and Tech roles, before invoicing. The renewal follow-ups still happen in Pax8 or Partner Center.

## FAQ

**When should the billing close happen?**
After the distributor bill for the period is available and before client invoices are sent. Fixing a line on a draft is easier than issuing a credit later.

**Who should sign off the close?**
Someone with authority over pricing, such as an owner or billing admin. Technicians can flag exceptions, but approvals should sit with a named role.

**How should exceptions be recorded?**
Each one should end in a decision: fixed on the invoice, marked as billed elsewhere, or dismissed with a reason, plus who decided and when.

Want to test the checklist on real data? Start with a [free margin audit](/#offer).
