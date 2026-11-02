---
title: "Ghost Licences: Why Offboarded Clients Keep Costing You"
description: "Why Microsoft 365 seats keep billing after a client or user leaves, what Microsoft's rules say about reducing them, and how MSPs can catch ghost licences."
slug: ghost-licences-after-offboarding
publishAt: 2026-12-03T09:00:00Z
updatedAt: 2026-12-03T09:00:00Z
author: SDX Studio
tags: [ghost licences, offboarding, microsoft 365, nce, msp]
targetQuestion: "Why am I still paying for Microsoft 365 licences after a client leaves?"
keyword: ghost licences microsoft 365
faq:
  - q: "Does unassigning a licence stop the charge?"
    a: "No. Microsoft's offboarding guidance treats removing a user's licence and reducing the subscription's licence count as separate steps. The charge follows the subscription count."
  - q: "Can I cancel an offboarded client's annual NCE subscription?"
    a: "Only within seven days of the start of the term. After that, Microsoft says the partner is billed for the full term. You can turn off auto-renew so it ends at term end."
  - q: "Who pays for ghost licences?"
    a: "That depends on your client contract. If the contract is silent, the MSP may end up carrying the cost, which is why the commitment term should appear in client agreements."
---

<!-- verify: Microsoft's offboarding page describes admin-center steps for directly bought subscriptions; for CSP seats the reduction is made via Pax8 or Partner Center. Wording reflects this, but confirm. -->

Ghost licences are Microsoft 365 seats your distributor still bills you for after a user or whole client has left. They happen because unassigning a licence doesn't reduce the subscription count, and because new commerce only lets you reduce seats within seven days of a term starting. Catch them by checking the distributor bill against active clients every month.

## How do ghost licences happen?

There are two common routes.

**A user leaves an active client.** The technician blocks sign-in, converts the mailbox, and unassigns the licence. The seat is now free, but it's still on the subscription. Microsoft's own [offboarding guide](https://learn.microsoft.com/en-us/microsoft-365/admin/add-users/remove-former-employee-step-6) makes this explicit: if you don't want to keep paying, you unassign the licence and then delete it from the subscription, which is a separate "reduce the number of licenses" step. Microsoft's [licence assignment page](https://learn.microsoft.com/en-us/microsoft-365/admin/manage/assign-licenses-to-users) also notes that a deleted user's licence simply becomes available to assign to someone else.

**A whole client leaves.** The client is closed in the PSA, so invoicing stops. The subscriptions at the distributor don't stop by themselves. If nobody cancels or reduces them, the distributor keeps billing you, and there's no invoice line to compare against, which makes them easy to miss.

## Why can't you just cancel the seats?

Under new commerce, timing decides. Microsoft Learn says:

- Licence-based subscriptions can be [cancelled with a prorated refund within seven days](https://learn.microsoft.com/en-us/partner-center/customers/new-commerce-cancellation-policy) of purchase. After that window the partner [is billed for the full term](https://learn.microsoft.com/en-us/partner-center/customers/create-a-new-subscription#cancel-a-subscription), even if the customer stops paying or using it.
- Licences can be [decreased only within seven days of being added](https://learn.microsoft.com/en-us/partner-center/customers/create-a-new-subscription#increase-or-decrease-licenses-in-new-commerce-license-based-subscriptions), at purchase, renewal or midterm.
- You can turn off auto-renew, or [schedule a reduction for renewal](https://learn.microsoft.com/en-us/partner-center/customers/create-a-new-subscription#subscription-renewals).

So a ghost licence on an annual term may be unavoidable until renewal. What is avoidable is letting it renew. On a monthly term, each month's renewal gives you a new seven-day window, as covered in [NCE monthly vs annual rules](/blog/nce-monthly-vs-annual-seat-reduction-rules).

## How do you find ghost licences?

1. List clients you've offboarded, with their offboarding dates.
2. Filter the month's distributor bill for those customers. Any line is a ghost licence.
3. For active clients, compare seats on the distributor bill with assigned licences in the client's tenant. A gap is a candidate for reduction at the next window.
4. For each ghost, note the term, the next renewal date, and whether you're inside a seven-day window today.

## What should you do with each one?

| Situation | Action |
|---|---|
| Inside a seven-day window | Cancel or reduce now |
| Annual term, mid-term | Turn off auto-renew or schedule a reduction for renewal |
| Monthly term | Reduce or cancel in the next window after renewal |
| Contract lets you bill the client until term end | Keep invoicing the committed seats, and tell the client the end date |

The last row is a contract question, not a technical one. If your client agreement says seats committed on an annual term are billed until renewal, a departing client's seats aren't ghosts. They're billable. If it doesn't say, add it. See [how to set a markup policy](/blog/m365-markup-policy-for-msps) for the wording.

## How does SeatTrue measure them?

SeatTrue flags a ghost licence when the distributor bill has seats for a customer you no longer invoice. It counts the cost as seats × distributor cost, since there's no client revenue against it, and puts it in the exceptions inbox. Your team then dismisses it with a reason (for example, "annual term, renewal set to off") or acts on it.

## FAQ

**Does unassigning a licence stop the charge?**
No. Microsoft's offboarding guidance treats removing a user's licence and reducing the subscription's licence count as separate steps. The charge follows the subscription count.

**Can I cancel an offboarded client's annual NCE subscription?**
Only within seven days of the start of the term. After that, Microsoft says the partner is billed for the full term. You can turn off auto-renew so it ends at term end.

**Who pays for ghost licences?**
That depends on your client contract. If the contract is silent, the MSP may end up carrying the cost, which is why the commitment term should appear in client agreements.

To see whether any ghosts are on last month's bill, a [free margin audit](/#offer) will list them.
