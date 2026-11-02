---
title: "How SeatTrue Calculates Monthly License Leakage"
description: "The exact formulas SeatTrue uses for unbilled seats, stale prices, ghost licences and overbilling, with a worked example you can check by hand."
slug: how-seattrue-calculates-license-leakage
publishAt: 2026-12-17T09:00:00Z
updatedAt: 2026-12-17T09:00:00Z
author: SDX Studio
tags: [methodology, license leakage, calculation, microsoft 365, msp]
targetQuestion: "How is monthly license leakage calculated?"
keyword: how to calculate license leakage
faq:
  - q: "What is the expected price in SeatTrue?"
    a: "Distributor cost per seat multiplied by one plus the markup agreed with that client. Every billed price is compared with it."
  - q: "Why are ghost licences counted at cost rather than expected price?"
    a: "There is no client revenue to recover against them, so the loss is what you pay the distributor: seats times cost."
  - q: "Is overbilling subtracted from leakage?"
    a: "No. Overbilling is reported separately as refund risk, because netting it against leakage would hide two separate problems."
---

<!-- verify: Confirm Northbeam IT demo figures (8 clients, $548.10/mo) match the live demo, and that the product handles lines with both unbilled seats and a stale price exactly as the formulas show. -->

SeatTrue calculates monthly license leakage by comparing each distributor line with the client's invoice. Expected price is cost × (1 + agreed markup). Leakage is the sum of unbilled seats × expected price, stale-price gaps × billed seats, and ghost-licence seats × cost. Overbilling is reported separately as refund risk, never netted off.

## What inputs does the calculation use?

For each client and SKU in the period:

- **Cost**: the per-seat cost on the distributor bill. From a Partner Center file that's `EffectiveUnitPrice`, which Microsoft says to [use instead of `UnitPrice`](https://learn.microsoft.com/en-us/partner-center/billing/use-the-reconciliation-files) for licence-based cost.
- **Distributor seats**: quantity on the distributor bill.
- **Billed seats** and **billed price**: from your PSA invoice export.
- **Markup**: the rate you agreed with that client.
- **Client status**: whether you still invoice this customer.

Input is by CSV upload. No integration is needed.

## What are the formulas?

| Exception | Condition | Amount |
|---|---|---|
| Expected price | (all lines) | cost × (1 + markup) |
| Unbilled seats | distributor seats > billed seats | (distributor seats − billed seats) × expected price |
| Stale price | billed price < expected price | (expected price − billed price) × billed seats |
| Ghost licence | distributor seats for a client you no longer invoice | seats × cost |
| Overbilling (refund risk) | billed price > expected, or billed seats > distributor seats | reported separately |
| Unmapped customer | no PSA client match | flagged; not valued until mapped |

**Monthly leakage = unbilled + stale price + ghost licences.** Overbilling is shown alongside it, not subtracted.

## Why these choices?

- **Unbilled seats use expected price**, not cost, because the loss is the revenue you agreed to charge, including margin.
- **Stale price multiplies by billed seats**, because those are the seats where the price is wrong. Unbilled seats are already counted separately, so nothing is double-counted.
- **Ghost licences use cost**, because there's no client to bill. The loss is the money paid to the distributor.
- **Overbilling isn't netted**, because a client overcharged on one line doesn't cancel out margin lost on another. Each needs its own decision.

## What does a worked example look like?

*Hypothetical figures, for arithmetic only.* One client, one SKU, agreed markup 15%:

- Cost per seat: $20.00 → expected price = 20.00 × 1.15 = **$23.00**
- Distributor seats: 12; billed seats: 10; billed price: $22.00

Unbilled = (12 − 10) × 23.00 = **$46.00**
Stale price = (23.00 − 22.00) × 10 = **$10.00**
Leakage for this line = **$56.00**

If a second, offboarded customer still had 3 seats at $20.00 cost on the bill, the ghost licence amount would be 3 × 20.00 = **$60.00**.

For a fuller picture, SeatTrue's demo uses an **example** MSP, "Northbeam IT", with 8 clients and **$548.10/month** of leakage. Northbeam IT is a fictional demo dataset, not a customer.

## What does SeatTrue do after calculating?

Each exception goes into the exceptions inbox with its amount and cause. Users with the right role [approve, mark billed or dismiss](/blog/m365-billing-close-checklist) each one before invoicing:

Access is role-based (Owner, Admin, Tech), so you decide who resolves exceptions and who only sees them.

Record a reason when you dismiss one, such as "annual term; seats billable to renewal under contract". That's how a ghost licence the client is still contractually paying for is separated from real leakage.

## What doesn't the calculation cover?

- It doesn't judge whether a markup is right, only whether it was applied.
- It doesn't see seats in a client tenant, only what's on the distributor bill and invoice. Unused-but-billed seats are a separate conversation.
- It doesn't change anything in Pax8, Partner Center or your PSA. A Pax8 API connection and HaloPSA sync are planned, not live.

For the definitions behind each category, see [what license leakage is](/blog/what-is-license-leakage).

## FAQ

**What is the expected price in SeatTrue?**
Distributor cost per seat multiplied by one plus the markup agreed with that client. Every billed price is compared with it.

**Why are ghost licences counted at cost rather than expected price?**
There is no client revenue to recover against them, so the loss is what you pay the distributor: seats times cost.

**Is overbilling subtracted from leakage?**
No. Overbilling is reported separately as refund risk, because netting it against leakage would hide two separate problems.

You can run these exact formulas on your own data with a [free margin audit](/#offer) before choosing a plan.
