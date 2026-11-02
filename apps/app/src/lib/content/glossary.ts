/**
 * Glossary entries shown on /glossary and linked from blog posts.
 * `matches` are lower-case phrases; a post that contains one links to the entry.
 * `posts` are blog slugs that explain the term in depth (shown only once published).
 */
export type GlossaryEntry = {
  slug: string;
  term: string;
  definition: string;
  detail: string;
  matches: string[];
  posts: string[];
};

export const glossary: GlossaryEntry[] = [
  {
    slug: "license-leakage",
    term: "License leakage",
    definition:
      "Margin an MSP loses when licence costs on the distributor bill aren't billed to clients at the agreed price.",
    detail:
      "It covers seats nobody invoiced, lines billed below cost × the agreed markup, and licences still running for clients who left. Measure it monthly, in dollars, per client.",
    matches: ["license leakage", "licence leakage"],
    posts: [
      "what-is-license-leakage",
      "how-seattrue-calculates-license-leakage",
    ],
  },
  {
    slug: "nce",
    term: "NCE (New Commerce Experience)",
    definition:
      "Microsoft's model for how CSP partners buy licence-based subscriptions such as Microsoft 365, defined by SKU and term.",
    detail:
      "Microsoft Learn describes monthly, annual and three-year terms, a seven-day (168-hour) cancellation window from the start of a term, and seat reductions only within seven days of licences being added.",
    matches: ["nce", "new commerce"],
    posts: [
      "what-is-nce-new-commerce-experience",
      "nce-monthly-vs-annual-seat-reduction-rules",
    ],
  },
  {
    slug: "ghost-licence",
    term: "Ghost licence",
    definition:
      "A licence still on the distributor bill for a client you no longer serve, so nobody is invoiced for it.",
    detail:
      "Usually left behind when offboarding closes the ticket but not the subscription. Under NCE an annual seat may not be reducible until renewal, so the cost runs on.",
    matches: ["ghost licence", "ghost license", "offboard"],
    posts: ["ghost-licences-after-offboarding"],
  },
  {
    slug: "markup-policy",
    term: "Markup policy",
    definition:
      "The written rule for what each client pays for Microsoft licences: a pricing base, a default markup and any per-client exceptions.",
    detail:
      "With cost as the base, the expected client price is unit cost × (1 + markup). Writing it down is what makes a monthly price check arithmetic instead of archaeology.",
    matches: ["markup"],
    posts: ["m365-markup-policy-for-msps"],
  },
  {
    slug: "unbilled-seats",
    term: "Unbilled seats",
    definition:
      "Seats on the distributor bill for a client that are missing from that client's invoice.",
    detail:
      "Typical cause: licences added mid-month in Pax8 or Partner Center while the PSA agreement kept the old quantity.",
    matches: ["unbilled seat"],
    posts: ["reconcile-pax8-bill-against-psa-invoices"],
  },
  {
    slug: "stale-price",
    term: "Stale price",
    definition:
      "An invoice line billed below the subscription's current cost × the agreed markup.",
    detail:
      "Common after a renewal moves a subscription to new pricing while the PSA keeps last term's price. Under NCE these changes land subscription by subscription.",
    matches: ["stale price", "renewal"],
    posts: ["m365-renewal-price-review-checklist"],
  },
  {
    slug: "overbilling",
    term: "Overbilling",
    definition:
      "Billing a client more seats, or a higher price, than the distributor bill and the agreed markup support.",
    detail:
      "Usually seats reduced at the distributor but not in the PSA. Track it separately from leakage: it's money the client can ask for back.",
    matches: ["overbill"],
    posts: ["reconcile-pax8-bill-against-psa-invoices"],
  },
  {
    slug: "customer-mapping",
    term: "Customer mapping",
    definition:
      "The link between each distributor customer (for example in Pax8) and exactly one client in your PSA.",
    detail:
      "Names rarely match on their own (“Acme Corp” vs “Acme Corporation”). Unmapped customers can't be checked, so they're an exception of their own.",
    matches: ["mapping", "unmapped"],
    posts: ["reconcile-pax8-bill-against-psa-invoices"],
  },
  {
    slug: "billing-close",
    term: "Billing close",
    definition:
      "The monthly check between the distributor bill arriving and client invoices going out.",
    detail:
      "Reconcile quantities and prices, resolve every exception, record who approved what, then send invoices.",
    matches: ["billing close", "before invoices go out"],
    posts: ["m365-billing-close-checklist"],
  },
  {
    slug: "effective-unit-price",
    term: "EffectiveUnitPrice",
    definition:
      "The Partner Center reconciliation-file column Microsoft says to use for licence-based cost.",
    detail:
      "It reflects promotions, partner earned credit and proration; UnitPrice stays fixed for the term.",
    matches: ["effectiveunitprice", "partner center"],
    posts: ["reconcile-pax8-bill-against-psa-invoices"],
  },
];

export function glossaryEntriesIn(text: string, limit = 4): GlossaryEntry[] {
  const haystack = text.toLowerCase();
  return glossary
    .filter((entry) =>
      entry.matches.some((phrase) =>
        new RegExp(`\\b${phrase}`, "i").test(haystack),
      ),
    )
    .slice(0, limit);
}
