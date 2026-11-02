---
title: "How to Set a Microsoft 365 Markup Policy for MSP Clients"
description: "A practical way for MSPs to set, document and enforce Microsoft 365 licence markup per client, including how to handle renewals and price changes."
slug: m365-markup-policy-for-msps
publishAt: 2026-11-24T09:00:00Z
updatedAt: 2026-11-24T09:00:00Z
author: SDX Studio
tags: [markup, pricing, microsoft 365, msp, pax8]
targetQuestion: "How should an MSP set its Microsoft 365 markup?"
keyword: microsoft 365 markup msp
faq:
  - q: "Should I mark up on cost or on Microsoft's list price?"
    a: "Either works if it's written down. Marking up on your actual distributor cost makes the monthly check simple: expected price equals cost times one plus the agreed markup."
  - q: "Should every client have the same markup?"
    a: "Not necessarily. A default plus documented per-client exceptions is common. What matters is that each client's rate is recorded and checked every month."
  - q: "What happens to my markup when Microsoft raises prices?"
    a: "If your policy marks up on cost, the client price rises with cost at the subscription's renewal. Microsoft's list price changes took effect July 1, 2026, and Partner Center applies a mid-term price change only at renewal."
---

Set a Microsoft 365 markup policy by choosing a pricing base (your distributor cost is simplest), a default markup percentage, a written list of per-client exceptions, and a rule for when price changes reach the client. Then check every invoice line against cost × (1 + markup) monthly, so the policy holds after renewals.

## Why do you need a written markup policy?

Most MSPs have a markup. Fewer have it written down per client. Without that, there's no way to tell whether a line is billed correctly. "Looks about right" isn't a check. A written policy turns pricing into arithmetic: for each line, expected price = cost × (1 + agreed markup). Anything else is an exception.

It also protects the client relationship. When cost rises at renewal, a documented rule ("price follows cost at renewal, same markup") is easier to explain than an ad hoc increase.

## How do you choose the pricing base?

Two common bases:

- **Cost-plus.** Markup on what your distributor charges you. Simple to check monthly, and margin stays constant as a percentage when cost moves.
- **List-price based.** Charge Microsoft's suggested price, or a discount from it. Margin depends on whatever discount you get from the distributor.

Cost-plus is easier to audit because both numbers are on your distributor bill. Whichever you pick, use the same base for every line of a client.

## What should the policy include?

| Policy element | Decide | Example wording |
|---|---|---|
| Pricing base | Cost-plus or list-based | "Prices are distributor cost plus markup." |
| Default markup | One percentage for all SKUs, or per product family | "Default markup applies to all Microsoft 365 SKUs." |
| Client exceptions | Which clients differ and why | "Client X: agreed rate in contract dated …" |
| Term handling | Whether monthly-term seats carry a different price | "Monthly-term seats are billed at monthly-term cost plus markup." |
| Price changes | When cost changes reach the client | "Changes apply from the invoice after the subscription renews." |
| Seat reductions | Who pays for seats that can't be reduced mid-term | "Seats committed annually are billed until renewal." |
| Review | Who checks, how often | "Checked monthly before invoicing; exceptions approved by an Admin." |

The seat-reduction line matters because of new commerce rules. Microsoft Learn says licences can be [reduced only within seven days](https://learn.microsoft.com/en-us/partner-center/customers/create-a-new-subscription#increase-or-decrease-licenses-in-new-commerce-license-based-subscriptions) of being added. See [NCE seat-reduction rules](/blog/nce-monthly-vs-annual-seat-reduction-rules) for the detail.

## How should price changes reach the client?

Under new commerce, cost is set per term and changes when a subscription renews. Microsoft's [Partner Center pricing rules](https://learn.microsoft.com/en-us/partner-center/pricing/pricing-and-offers#new-commerce-license-based-pricing) say that when prices change mid-term, "the new price applies only at renewal". That covers every CSP new-commerce subscription, including ones bought through Pax8, because distributors transact through Partner Center. Microsoft's list price changes [took effect on July 1, 2026](https://www.microsoft.com/en-us/microsoft-365/blog/2025/12/04/advancing-microsoft-365-new-capabilities-and-pricing-update/). Your Pax8 buy price is set by Pax8 and can differ from Microsoft list; check your Pax8 price list. That means one client can have subscriptions at old and new cost at the same time.

A cost-plus policy handles this cleanly if you apply it line by line: when a subscription renews at a new cost, its invoice line moves too. The common failure is a "stale price", where cost went up at renewal but the invoice kept last year's price. Your markup is quietly squeezed.

## How do you enforce the policy every month?

1. Store each client's markup somewhere your billing check can read it, not just in a contract PDF.
2. After the distributor bill arrives, compute expected price per line.
3. Flag lines billed below expected (stale price or unapproved discount) and above it (overbilling, a refund question).
4. Have a named role approve or dismiss each one, with a reason.
5. Invoice only after the list is clear.

The [Pax8 reconciliation guide](/blog/reconcile-pax8-bill-against-psa-invoices) covers the matching steps.

## Where does SeatTrue fit?

SeatTrue stores the markup you agreed with each client and checks every line of the Pax8 or Partner Center bill against cost × (1 + markup). Stale prices and overbilling land in an exceptions inbox to approve, mark billed or dismiss before you invoice.

## FAQ

**Should I mark up on cost or on Microsoft's list price?**
Either works if it's written down. Marking up on your actual distributor cost makes the monthly check simple: expected price equals cost times one plus the agreed markup.

**Should every client have the same markup?**
Not necessarily. A default plus documented per-client exceptions is common. What matters is that each client's rate is recorded and checked every month.

**What happens to my markup when Microsoft raises prices?**
If your policy marks up on cost, the client price rises with cost at the subscription's renewal. Microsoft's list price changes took effect July 1, 2026, and Partner Center applies a mid-term price change only at renewal.

When your policy is written, a [free margin audit](/#offer) shows which lines already follow it.
