import type { Source } from "../components/marketing";
import type { SitePageKey } from "./site";

/**
 * Comparison pages. Claims about other products come only from their own
 * public pages (listed as sources, checked November 2026). Where a page is
 * silent we say "not documented", never "doesn't".
 */
export type Comparison = {
  key: SitePageKey;
  name: string;
  title: string;
  intro: string;
  chooseThem: string[];
  chooseUs: string[];
  rows: { check: string; them: string; us: string }[];
  theirStrengths: string;
  sources: Source[];
  posts: string[];
  terms: string[];
  pages: SitePageKey[];
};

const partnerCenterPricing: Source = {
  label: "Microsoft Learn: Partner Center pricing and offers",
  href: "https://learn.microsoft.com/en-us/partner-center/pricing/pricing-and-offers#new-commerce-license-based-pricing",
  note: "mid-term price changes apply only at renewal, for every CSP new-commerce subscription",
};
const reconciliationFiles: Source = {
  label: "Microsoft Learn: Use the reconciliation files",
  href: "https://learn.microsoft.com/en-us/partner-center/billing/use-the-reconciliation-files",
  note: "use EffectiveUnitPrice for licence-based cost",
};

export const comparisons: Record<string, Comparison> = {
  gradient: {
    key: "compareGradient",
    name: "Gradient Reconcile",
    title: "SeatTrue vs Gradient Reconcile",
    intro:
      "Gradient Reconcile, from Gradient MSP, is a broad, established billing reconciliation platform, with a separate done-for-you Managed Billing Reconciliation service. SeatTrue does one narrower job: check every Microsoft line on the Pax8 bill against what you invoice, at cost × the markup agreed with that client.",
    chooseThem: [
      "You resell many vendors (security, backup, telephony) and want them all reconciled in one place.",
      "You buy through several distributors such as Pax8, Ingram Micro and TD SYNNEX.",
      "You want PSA integrations (ConnectWise, Autotask, HaloPSA) today rather than CSV uploads.",
    ],
    chooseUs: [
      "Your leak is Microsoft 365 through Pax8, and you want price checked against each client's markup, not just quantity.",
      "You want a sign-off inbox with owner, admin and technician roles before invoices go out.",
      "You'd rather pay a flat $49 or $179 a month than a tier plus a Microsoft add-on.",
    ],
    rows: [
      {
        check: "Distributors and vendors",
        them: "Pax8, Ingram Micro, TD SYNNEX StreamOne and many vendors",
        us: "Microsoft 365 via Pax8; Partner Center files also work",
      },
      {
        check: "PSA connection",
        them: "Integrations listed for ConnectWise, Autotask and HaloPSA",
        us: "No API sync; billing CSV upload (ConnectWise, Autotask, HaloPSA exports). Syncs planned",
      },
      {
        check: "Seat quantity vs what's billed",
        them: "Yes",
        us: "Yes",
      },
      {
        check: "Price vs cost × each client's agreed markup",
        them: "Not documented on public pages",
        us: "Yes, every line",
      },
      {
        check: "Renewals at a new Microsoft price",
        them: "Price-increase detection (Microsoft add-on)",
        us: "Flags lines billed below new cost × markup",
      },
      {
        check: "Sign-off before invoicing",
        them: "Reconcile in platform",
        us: "Approve, mark billed or dismiss, with an audit log",
      },
      {
        check: "Price",
        them: "$299 / $699 / $999 per month by customer count, plus $199/month Microsoft add-on (pricing page, checked 2 Nov 2026)",
        us: "$49/month (up to 50 clients) or $179/month unlimited; unlimited users on both",
      },
    ],
    theirStrengths:
      "Gradient Reconcile covers far more vendors and distributors and lists PSA integrations today. If you need breadth, it's the stronger tool. SeatTrue is cheaper and narrower, and its markup check is the part we haven't seen Gradient document.",
    sources: [
      {
        label: "Gradient pricing",
        href: "https://www.meetgradient.com/pricing",
        note: "Reconcile tiers and Microsoft add-on, checked 2 Nov 2026",
      },
      {
        label: "Gradient Reconcile product page",
        href: "https://www.meetgradient.com/synthesize-billing",
        note: "integrations, distributors and Managed Billing Reconciliation listed",
      },
      partnerCenterPricing,
    ],
    posts: ["seattrue-vs-gradient-reconcile", "m365-markup-policy-for-msps"],
    terms: ["markup-policy", "stale-price", "license-leakage"],
    pages: ["comparePsaSync", "pricing"],
  },
  "pax8-psa-sync": {
    key: "comparePsaSync",
    name: "a Pax8-to-PSA sync",
    title: "SeatTrue vs a Pax8-to-PSA sync",
    intro:
      "A native Pax8-to-PSA sync keeps seat quantities on recurring invoices current. It isn't described as checking whether each line is priced at cost × the markup you agreed. SeatTrue does that check, monthly, with sign-off.",
    chooseThem: [
      "Quantities drifting between Pax8 and the PSA is your only problem.",
      "You want changes to flow to the recurring invoice automatically.",
      "You're happy to build and maintain automation (for example in Rewst) for anything beyond quantity.",
    ],
    chooseUs: [
      "Renewals land at new Microsoft prices one subscription at a time and you need to catch the ones still billed at the old price.",
      "You want ghost licences for offboarded clients and unmapped Pax8 customers flagged, in dollars.",
      "You want someone to approve each exception before invoices go out, with a record of who did.",
    ],
    rows: [
      {
        check: "Keeps seat quantities in step",
        them: "Yes (HaloPSA: quantities update automatically)",
        us: "Flags differences; you update the invoice",
      },
      {
        check: "Checks price against cost × agreed markup",
        them: "Not described on the integration page",
        us: "Yes, per client",
      },
      {
        check: "Ghost licences for offboarded clients",
        them: "Not described",
        us: "Yes",
      },
      {
        check: "Approval before invoicing",
        them: "Not described",
        us: "Exceptions inbox with roles and audit log",
      },
      {
        check: "Setup",
        them: "Configure per PSA; included with the PSA",
        us: "Upload a CSV; mappings set up with you",
      },
      {
        check: "Price",
        them: "Included",
        us: "$49 or $179 a month flat",
      },
    ],
    theirStrengths:
      "A sync is included, automatic and real time for quantities. Keep it. SeatTrue sits on top as the monthly price and markup check before invoices go out; Rewst and MSPbots can also compare Pax8 with your PSA if you'd rather build or buy a broader automation.",
    sources: [
      {
        label: "HaloPSA: Pax8 integration",
        href: "https://usehalo.com/integration/pax8-integration",
        note: "describes quantity updates; silent on price or markup",
      },
      {
        label: "Rewst: Pax8 integration",
        href: "https://rewst.io/integrations/pax8/",
      },
      {
        label: "MSPbots: Pax8 billing reconciliation app",
        href: "https://mspbots.ai/blog/feature-announcement-pax8-billing-reconciliation-app",
      },
      partnerCenterPricing,
    ],
    posts: [
      "seattrue-vs-pax8-psa-sync",
      "reconcile-pax8-bill-against-psa-invoices",
    ],
    terms: ["stale-price", "ghost-licence", "customer-mapping"],
    pages: ["integrations", "compareGradient"],
  },
  spreadsheet: {
    key: "compareSpreadsheet",
    name: "a spreadsheet",
    title: "SeatTrue vs a reconciliation spreadsheet",
    intro:
      "A spreadsheet can reconcile Microsoft 365 billing. It works as long as someone rebuilds it every month, keeps the customer mapping and markups current, and checks price as well as quantity.",
    chooseThem: [
      "You have a handful of clients and one person who enjoys the monthly close.",
      "Your markup is the same for every client and rarely changes.",
    ],
    chooseUs: [
      "You have dozens of clients with different markups and renewals in different months.",
      "You want only the exceptions, each with a dollar figure, instead of every line.",
      "More than one person touches billing and you need a record of who approved what.",
    ],
    rows: [
      {
        check: "Cost",
        them: "Your time, every month",
        us: "$49 or $179 a month flat",
      },
      {
        check: "Customer and SKU mapping",
        them: "Rebuilt or re-checked each month",
        us: "Kept and reused",
      },
      {
        check: "Price vs cost × agreed markup",
        them: "If someone builds the formula and keeps it current",
        us: "Every line, per client",
      },
      {
        check: "Renewals at new prices",
        them: "Easy to miss: they land in different months",
        us: "Flagged when billed below new cost × markup",
      },
      {
        check: "Approval trail",
        them: "None by default",
        us: "Roles and audit log",
      },
    ],
    theirStrengths:
      "A spreadsheet is free, flexible and already open on your screen. For a small, simple book of clients it's fine. Microsoft's reconciliation-file guidance is a good base for the formulas.",
    sources: [reconciliationFiles, partnerCenterPricing],
    posts: [
      "seattrue-vs-spreadsheet-m365-reconciliation",
      "m365-billing-close-checklist",
    ],
    terms: ["billing-close", "customer-mapping", "effective-unit-price"],
    pages: ["pricing", "forSmall"],
  },
};
