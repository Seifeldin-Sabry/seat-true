---
title: "What Is NCE? Microsoft's New Commerce Experience Defined"
description: "NCE is how Microsoft sells licence-based subscriptions through CSP partners. Definition, terms, the seven-day window, and what it means for MSPs."
slug: what-is-nce-new-commerce-experience
publishAt: 2026-12-08T09:00:00Z
updatedAt: 2026-12-08T09:00:00Z
author: SDX Studio
tags: [glossary, nce, new commerce experience, microsoft 365, csp]
targetQuestion: "What is NCE in Microsoft licensing?"
keyword: what is nce microsoft
faq:
  - q: "What does NCE stand for?"
    a: "New Commerce Experience, Microsoft's model for how CSP partners buy and manage licence-based subscriptions such as Microsoft 365."
  - q: "Is NCE optional?"
    a: "No longer for most purchases. Microsoft Learn says that as of September 1, 2024 all licence-based subscription purchases are on new commerce, except certain five- or six-year public sector legacy offers."
  - q: "What is the NCE cancellation window?"
    a: "Seven days (168 hours) from the start of any term, with a prorated refund. After that, the partner is billed for the full term."
---

NCE, the New Commerce Experience, is Microsoft's model for how Cloud Solution Provider (CSP) partners buy and manage licence-based subscriptions such as Microsoft 365. It defines products by SKU and term, offers monthly, annual and three-year terms, and limits cancellations and seat reductions to seven days after a term starts or seats are added.

## Where did NCE come from?

Microsoft Learn's [new commerce overview](https://learn.microsoft.com/en-us/partner-center/customers/new-commerce-license-based) says the Microsoft Customer Agreement and the new commerce platform were introduced through CSP partners in 2019, and that as of September 1, 2024 all licence-based subscription purchases are on new commerce, except five- or six-year public sector legacy offers. The older model is usually called "legacy" or "traditional" CSP.

## What are the key terms in NCE?

| Term | Meaning |
|---|---|
| Product / SKU / term | How new commerce offers are defined, replacing legacy "offer IDs" |
| Term length | Monthly, annual or three-year for many subscriptions |
| Billing frequency | Monthly, annual or up-front for many subscriptions |
| Cancellation window | Seven days (168 hours) from the start of any term, prorated refund |
| Seat reduction | Allowed only within seven days of licences being added |
| Scheduled change | A change (SKU, quantity, term) set to apply at renewal |
| Auto-renew | On by default; can be turned off |

Sources: [new commerce overview](https://learn.microsoft.com/en-us/partner-center/customers/new-commerce-license-based), [cancellation policy](https://learn.microsoft.com/en-us/partner-center/customers/new-commerce-cancellation-policy), and [subscription management](https://learn.microsoft.com/en-us/partner-center/customers/create-a-new-subscription).

## What are NCE's cancellation and reduction rules?

Microsoft Learn states that partners can cancel a new commerce licence-based subscription with a prorated refund within the first seven days (168 hours) of any term. After the window, cancellation isn't available and "the partner is billed for the full term even if the customer stops paying for or using the subscription."

Seat counts follow a similar rule. Licences can be increased at any time, but [decreased only within seven days](https://learn.microsoft.com/en-us/partner-center/customers/create-a-new-subscription#increase-or-decrease-licenses-in-new-commerce-license-based-subscriptions) of being added. After renewal, a new seven-day window opens from the moment renewal completes. For a side-by-side of monthly and annual terms, see [NCE monthly vs annual](/blog/nce-monthly-vs-annual-seat-reduction-rules).

## How does NCE pricing work?

New commerce pricing is defined per customer market, and the partner's cost for a subscription is set for its term. Microsoft notes in its [reconciliation file guidance](https://learn.microsoft.com/en-us/partner-center/billing/use-the-reconciliation-files) that a subscription's `UnitPrice` stays fixed for the billing term, and that `EffectiveUnitPrice` should be used for actual cost, since it reflects promotions, partner earned credit and proration.

Price changes therefore reach a subscription when it renews. Microsoft's [Partner Center pricing rules](https://learn.microsoft.com/en-us/partner-center/pricing/pricing-and-offers#new-commerce-license-based-pricing) say that when prices change mid-term, "the new price applies only at renewal". That covers every CSP new-commerce subscription, including ones bought through Pax8, because distributors transact through Partner Center. Microsoft's list price changes [took effect on July 1, 2026](https://www.microsoft.com/en-us/microsoft-365/blog/2025/12/04/advancing-microsoft-365-new-capabilities-and-pricing-update/). Your Pax8 buy price is set by Pax8 and can differ from Microsoft list; check your Pax8 price list.

## Why does NCE matter for MSP billing?

Three consequences for anyone reselling Microsoft 365:

1. **Commitment risk.** If a client leaves mid-term on an annual subscription, you may be paying for seats you can't reduce. Your client contract should say who carries that.
2. **Staggered cost changes.** Because cost changes at each subscription's renewal, prices on the distributor bill can change in any month.
3. **Ghost licences.** Seats that can't be reduced, or that nobody reduced in time, keep billing. See [ghost licences after offboarding](/blog/ghost-licences-after-offboarding).

All three show up as license leakage if invoices don't follow the distributor bill.

## FAQ

**What does NCE stand for?**
New Commerce Experience, Microsoft's model for how CSP partners buy and manage licence-based subscriptions such as Microsoft 365.

**Is NCE optional?**
No longer for most purchases. Microsoft Learn says that as of September 1, 2024 all licence-based subscription purchases are on new commerce, except certain five- or six-year public sector legacy offers.

**What is the NCE cancellation window?**
Seven days (168 hours) from the start of any term, with a prorated refund. After that, the partner is billed for the full term.

SeatTrue checks each month that NCE seat and price changes made it onto client invoices. A [free margin audit](/#offer) is the easiest way to try it.
