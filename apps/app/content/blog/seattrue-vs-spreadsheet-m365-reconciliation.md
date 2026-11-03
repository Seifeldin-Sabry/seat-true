---
title: "SeatTrue vs a Spreadsheet for M365 Billing Reconciliation"
description: "When a spreadsheet is enough to reconcile Microsoft 365 billing, when it breaks, and what a purpose-built margin gate adds. A fair comparison for MSPs."
slug: seattrue-vs-spreadsheet-m365-reconciliation
publishAt: 2026-11-19T09:00:00Z
updatedAt: 2026-11-19T09:00:00Z
author: SDX Studio
tags: [comparison, spreadsheet, billing reconciliation, microsoft 365, msp]
targetQuestion: "Is a spreadsheet good enough to reconcile Microsoft 365 billing?"
keyword: m365 billing reconciliation spreadsheet
faq:
  - q: "Is a spreadsheet good enough for M365 billing reconciliation?"
    a: "It can be for a small client base with one person doing the work and a stable markup. It gets fragile as clients, SKUs, people and renewal dates multiply."
  - q: "What does SeatTrue do that a spreadsheet doesn't?"
    a: "It checks price against cost times each client's agreed markup on every line, keeps customer mappings, and puts each mismatch in an exceptions inbox with role-based approve, mark billed and dismiss actions."
  - q: "Does SeatTrue need an integration?"
    a: "No. It works from CSV uploads. A Pax8 API connection and HaloPSA sync are planned but not live."
---

A spreadsheet is good enough to reconcile Microsoft 365 billing when you have few clients, one person doing the work, and a markup that rarely changes. It breaks down when price checks per client, renewal-driven cost changes, and sign-off by more than one person matter. SeatTrue automates that margin check and records who resolved each exception.

## What does a reconciliation spreadsheet do well?

Credit where it's due. A spreadsheet is free, flexible, and already open on your screen. For many MSPs it is the honest first step, and a good one:

- You control every formula.
- A `VLOOKUP` or `XLOOKUP` from the distributor export to the PSA export catches most quantity gaps.
- Excel's Power Query can load a Partner Center reconciliation file that's too large to open directly. Microsoft [documents this approach](https://learn.microsoft.com/en-us/partner-center/billing/use-the-reconciliation-files) for big files.

If you have a handful of clients on two or three SKUs, a well-kept sheet may be all you need.

## Where does a spreadsheet start to break?

The problems are rarely the formulas. They're the things around the formulas:

- **Mappings drift.** "Acme Corp" and "Acme Corporation" need a lookup table that someone maintains. New clients get added to the bill before the table.
- **Price checks get skipped.** Matching quantity is one lookup. Matching price means pulling each client's agreed markup, computing cost × (1 + markup), and comparing. That's the step that tends to drop off under time pressure.
- **Costs change at renewal.** Microsoft's [Partner Center pricing rules](https://learn.microsoft.com/en-us/partner-center/pricing/pricing-and-offers#new-commerce-license-based-pricing) say that when prices change mid-term, "the new price applies only at renewal". That covers every CSP new-commerce subscription, including ones bought through Pax8, because distributors transact through Partner Center. Microsoft's list price changes [took effect on July 1, 2026](https://www.microsoft.com/en-us/microsoft-365/blog/2025/12/04/advancing-microsoft-365-new-capabilities-and-pricing-update/). So costs shift subscription by subscription. Your Pax8 buy price is set by Pax8 and can differ from Microsoft list; check your Pax8 price list. A sheet that compares this month's quantities won't flag a price that should have moved.
- **No record of decisions.** A highlighted cell doesn't say who decided an exception was fine, or why.
- **Key-person risk.** When the person who built the sheet is on leave, the close often waits.

## How do they compare side by side?

| | Spreadsheet | SeatTrue |
|---|---|---|
| Cost to start | Free | Free margin audit; then $49/mo (Starter) or $149/mo (Pro), flat |
| Input | Any export you can paste | CSV upload: Pax8 (Partner Center files supported) and PSA invoice export |
| Quantity check | Yes, if built | Yes, every line |
| Price vs cost × client markup | Manual, if built | Yes, every line |
| Flags | Whatever you build | Unbilled seats, stale prices, ghost licences, overbilling, unmapped customers |
| Workflow | Cell colours, comments | Exceptions inbox: approve, mark billed, dismiss |
| Access control | File permissions | Owner, Admin and Tech roles |
| Flexibility | Unlimited | Built for Microsoft resale via Pax8; not a general BI tool |

## When should you stay on a spreadsheet?

Stay if all of these are true: one distributor, a small and stable client list, one markup for everyone, one person who closes the month, and nobody asking for an audit trail. Improve the sheet instead of replacing it. Add a markup column per client, a price check column, and a "decided by" column.

## When is a purpose-built tool worth it?

Consider one when any of these hold:

- Different clients have different markups.
- More than one person touches billing, and you want techs to flag but not approve.
- Renewals are spread across the year, so cost changes arrive every month.
- You've found a stale price or a [ghost licence](/blog/what-is-license-leakage) after the invoice had already gone out.

SeatTrue is that tool for MSPs reselling Microsoft 365 through Pax8. Starter is $49/mo flat for up to 50 clients; Pro is $149/mo flat with unlimited clients. Users are unlimited on both. You can cancel any time, effective at the end of the period; there are no refunds. Built by SDX Studio.

## FAQ

**Is a spreadsheet good enough for M365 billing reconciliation?**
It can be for a small client base with one person doing the work and a stable markup. It gets fragile as clients, SKUs, people and renewal dates multiply.

**What does SeatTrue do that a spreadsheet doesn't?**
It checks price against cost times each client's agreed markup on every line, keeps customer mappings, and puts each mismatch in an exceptions inbox with role-based approve, mark billed and dismiss actions.

**Does SeatTrue need an integration?**
No. It works from CSV uploads. A Pax8 API connection and HaloPSA sync are planned but not live.

Not sure which side of the line you're on? Run the [free margin audit](/#offer) against your current sheet and compare the results.
