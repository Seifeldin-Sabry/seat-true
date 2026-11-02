---
title: "What Is License Leakage? A Definition for MSPs"
description: "License leakage is margin an MSP loses when distributor licence costs aren't billed to clients at the agreed price. Definition, types, measurement."
slug: what-is-license-leakage
publishAt: 2026-11-12T09:00:00Z
updatedAt: 2026-11-12T09:00:00Z
author: SDX Studio
tags: [glossary, license leakage, microsoft 365, msp billing]
targetQuestion: "What is license leakage for an MSP?"
keyword: license leakage msp
faq:
  - q: "Is license leakage the same as unused licences?"
    a: "No. Unused licences are seats a client pays for but doesn't use. License leakage is cost the MSP pays the distributor but doesn't recover from the client at the agreed price."
  - q: "Does overbilling count as license leakage?"
    a: "It is the opposite direction: the client is charged more than agreed. It is best tracked separately as refund exposure rather than netted against leakage."
  - q: "How often should leakage be measured?"
    a: "Every billing cycle, because seat counts change mid-month and new commerce costs change subscription by subscription at renewal."
---

<!-- verify: Microsoft's 2026 pricing FAQ (microsoft.com/licensing/news/2026-M365-Packaging-Pricing-Updates-FAQ) speaks to customers generally; confirm the renewal-timing rule applies the same way to CSP/NCE subscriptions bought via Pax8. -->

License leakage is the margin a Microsoft reseller loses when licences it pays the distributor for are not billed to the client, or are billed below the price agreed with that client. In practice it has three sources: unbilled seats, stale prices after a cost change, and ghost licences still running for clients who have left.

## What exactly counts as license leakage?

A line leaks when what you recover from the client is less than what the agreement with that client says you should recover. For an MSP reselling Microsoft 365, the agreed amount is usually:

**expected price per seat = distributor cost per seat × (1 + agreed markup)**

Leakage is the gap between that expected amount and what was actually invoiced, summed across clients and SKUs for the month.

It is a billing gap, not a usage gap. A client who pays for 20 seats and uses 15 has unused licences. That's a licence-optimisation conversation with the client. It is not leakage, because you recovered your cost and margin.

## What are the types of license leakage?

| Type | Definition | How it's measured |
|---|---|---|
| Unbilled seats | Seats on the distributor bill with no matching invoice line | Unbilled seats × expected price |
| Stale price | Seats billed below cost × (1 + markup), often after a renewal at a new cost | (Expected − billed price) × billed seats |
| Ghost licence | Seats still billed by the distributor for a client you no longer serve | Seats × distributor cost |

**Overbilling** is the mirror image: billed quantity or price above expected. It's not margin you lost, but it is money the client may reasonably ask back, so treat it as refund exposure and count it separately. Netting it against leakage hides both problems.

**Unmapped customers** (a distributor customer you can't match to any PSA client) aren't leakage in themselves, but you can't measure leakage for them until they're mapped.

## Why does license leakage happen?

- **Seat changes outside the billing workflow.** A technician adds licences for a new starter; nobody updates the recurring invoice.
- **Cost changes at renewal.** Under new commerce, prices are set per term and change when a subscription renews. Microsoft's [2026 pricing FAQ](https://www.microsoft.com/licensing/news/2026-M365-Packaging-Pricing-Updates-FAQ) says customers renewing after July 1, 2026 move to the new commercial pricing at their next renewal date, so cost increases arrive one subscription at a time.
- **Offboarding without a licence reduction.** Microsoft's own [offboarding guidance](https://learn.microsoft.com/en-us/microsoft-365/admin/add-users/remove-former-employee-step-6) treats unassigning a licence and reducing the licence count as two separate steps. Doing only the first leaves you paying for the seat.
- **Quantity-only syncs.** Integrations that update seat counts don't check price against markup.

## How is license leakage different from revenue leakage?

Revenue leakage is the broad finance term for any revenue a business earned but didn't collect. License leakage is a specific slice of it: the licence resale margin between a distributor bill and client invoices. Using the narrower term keeps the measurement concrete: each pound or dollar can be traced to a client, a SKU and a cause.

## How do you measure it?

Reconcile the distributor bill against client invoices every month, line by line, checking quantity and price. The [Pax8 reconciliation process](/blog/reconcile-pax8-bill-against-psa-invoices) walks through the steps. Report leakage as a monthly figure split by type, so you can tell whether the fix is a process change (offboarding), a pricing change (renewals) or a data change (mapping).

SeatTrue calculates this from a Pax8 or Partner Center CSV and your PSA invoice export, and lists each leaking line as an exception to approve, mark billed or dismiss before invoicing.

## FAQ

**Is license leakage the same as unused licences?**
No. Unused licences are seats a client pays for but doesn't use. License leakage is cost the MSP pays the distributor but doesn't recover from the client at the agreed price.

**Does overbilling count as license leakage?**
It is the opposite direction: the client is charged more than agreed. It is best tracked separately as refund exposure rather than netted against leakage.

**How often should leakage be measured?**
Every billing cycle, because seat counts change mid-month and new commerce costs change subscription by subscription at renewal.

Curious what your own figure is? A [free margin audit](/#offer) runs on last month's files.
