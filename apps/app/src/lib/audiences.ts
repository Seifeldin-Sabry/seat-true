import type { Source } from "../components/marketing";
import type { SitePageKey } from "./site";

/** Landing pages per buyer: same product, their words and their tools. */
export type Audience = {
  key: SitePageKey;
  eyebrow: string;
  title: string;
  intro: string;
  problems: { title: string; body: string }[];
  steps: { title: string; body: string }[];
  status: string;
  sources: Source[];
  posts: string[];
  terms: string[];
  pages: SitePageKey[];
};

const haloIntegration: Source = {
  label: "HaloPSA: Pax8 integration",
  href: "https://usehalo.com/integration/pax8-integration",
  note: "quantity updates on recurring invoices",
};

const steps = [
  {
    title: "Export",
    body: "Download last month's Pax8 billing CSV and your current client prices. No API access to approve.",
  },
  {
    title: "Map once",
    body: "Link each Pax8 customer to one client. Mappings are kept, so next month is just the exceptions.",
  },
  {
    title: "Fix before invoicing",
    body: "Approve, mark billed or dismiss each exception. Each carries a monthly dollar figure and an audit trail.",
  },
];

export const audiences: Record<string, Audience> = {
  "pax8-msps": {
    key: "forPax8",
    eyebrow: "For MSPs buying through Pax8",
    title: "Reconcile the Pax8 bill before you invoice",
    intro:
      "The Pax8 bill is the truth about what Microsoft 365 costs you. SeatTrue checks every line of it against what each client is invoiced: on seats, and on price × the markup you agreed with that client.",
    problems: [
      {
        title: "Seats added in Pax8, not on the invoice",
        body: "A tech adds licences mid-month. The agreement keeps the old quantity, and nobody bills the difference.",
      },
      {
        title: "Renewals at new prices",
        body: "Under NCE, cost changes land at each subscription's renewal. Microsoft's 2026 price updates reach clients one renewal at a time.",
      },
      {
        title: "Customers that don't match",
        body: "“Acme Corp” in Pax8 and “Acme Corporation” in the PSA never match on their own. Unmapped customers go unchecked.",
      },
    ],
    steps,
    status:
      "Works from the Pax8 billing export today. A Pax8 API connection is planned, not live, and needs Pax8's approval.",
    sources: [
      {
        label: "Microsoft Learn: Partner Center pricing and offers",
        href: "https://learn.microsoft.com/en-us/partner-center/pricing/pricing-and-offers#new-commerce-license-based-pricing",
      },
      {
        label: "Microsoft Learn: new commerce license-based subscriptions",
        href: "https://learn.microsoft.com/en-us/partner-center/customers/new-commerce-license-based",
      },
    ],
    posts: [
      "reconcile-pax8-bill-against-psa-invoices",
      "nce-monthly-vs-annual-seat-reduction-rules",
      "ghost-licences-after-offboarding",
    ],
    terms: ["nce", "unbilled-seats", "customer-mapping", "ghost-licence"],
    pages: ["comparePsaSync", "forHalo", "pricing"],
  },
  "halopsa-msps": {
    key: "forHalo",
    eyebrow: "For HaloPSA MSPs reselling Microsoft 365",
    title: "The price check your Halo sync doesn't do",
    intro:
      "HaloPSA's Pax8 integration keeps subscription quantities on recurring invoices current. Its integration page doesn't describe checking price or markup. SeatTrue does that check every month, before invoices go out.",
    problems: [
      {
        title: "Quantities match, price doesn't",
        body: "The sync updates seat counts. A line still billed at last term's price after a renewal looks fine on quantity.",
      },
      {
        title: "Markup varies by client",
        body: "Twelve per cent here, twenty there, a legacy deal somewhere. SeatTrue checks each line against that client's agreed markup.",
      },
      {
        title: "Offboarded clients still on the bill",
        body: "Closing the client in Halo doesn't reduce the Pax8 subscription. Ghost licences keep costing you.",
      },
    ],
    steps,
    status:
      "Runs on exports today and never writes to HaloPSA or Pax8. A HaloPSA sync is planned, not live.",
    sources: [haloIntegration],
    posts: [
      "seattrue-vs-pax8-psa-sync",
      "m365-markup-policy-for-msps",
      "m365-renewal-price-review-checklist",
    ],
    terms: ["markup-policy", "stale-price", "ghost-licence"],
    pages: ["comparePsaSync", "forPax8", "pricing"],
  },
};
