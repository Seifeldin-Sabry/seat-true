import { brand } from "@seattrue/ui";

/**
 * Every public marketing page in one place: head meta, OG card, sitemap and
 * llms.txt all read from here. Titles ≤ 60 chars, descriptions ≤ 155 (tested).
 * Keywords: see docs/seo.md for the map and search intent.
 */
export type SitePage = {
  path: string;
  title: string;
  description: string;
  /** OG card eyebrow + headline. */
  eyebrow: string;
  headline: string;
  /** Last meaningful content change, for sitemap lastmod. */
  updatedAt: string;
  primaryKeyword: string;
  secondaryKeyword: string;
};

export const sitePages = {
  home: {
    path: "/",
    title: "SeatTrue: Microsoft 365 license reconciliation for MSPs",
    description:
      "Check every Microsoft 365 line on your Pax8 bill against what each client is invoiced, at cost × agreed markup. Free margin audit on your own CSV.",
    eyebrow: "For MSPs reselling Microsoft 365",
    headline: "Find the Microsoft seats you never billed",
    updatedAt: "2026-11-02",
    primaryKeyword: "microsoft 365 license reconciliation for msps",
    secondaryKeyword: "msp license margin",
  },
  pricing: {
    path: "/pricing",
    title: "SeatTrue pricing: $49 Starter or $149 Pro, flat monthly",
    description:
      "Microsoft 365 license reconciliation for MSPs. Free for up to 10 clients with no card, then Starter $49 for 50 clients or Pro $149 unlimited.",
    eyebrow: "Pricing",
    headline: "Free for 10 clients. Then $49 or $149 a month, flat.",
    updatedAt: "2026-11-03",
    primaryKeyword: "msp billing reconciliation software pricing",
    secondaryKeyword: "msp license margin",
  },
  blog: {
    path: "/blog",
    title: "SeatTrue blog: Microsoft 365 billing for MSPs",
    description:
      "How MSPs reconcile Pax8 bills, manage NCE seats and protect Microsoft 365 margin. Checklists, definitions and fair comparisons.",
    eyebrow: "Blog",
    headline: "Microsoft 365 billing, reconciled",
    updatedAt: "2026-11-02",
    primaryKeyword: "msp microsoft 365 billing",
    secondaryKeyword: "nce seat management",
  },
  glossary: {
    path: "/glossary",
    title: "Microsoft 365 billing glossary for MSPs · SeatTrue",
    description:
      "Plain definitions of license leakage, NCE, ghost licences, markup policy, stale prices and other Microsoft 365 billing terms for MSPs.",
    eyebrow: "Glossary",
    headline: "Microsoft 365 billing terms, defined",
    updatedAt: "2026-11-02",
    primaryKeyword: "microsoft 365 billing glossary",
    secondaryKeyword: "nce seat management",
  },
  compareGradient: {
    path: "/compare/gradient",
    title: "SeatTrue vs Gradient Reconcile: reconciliation compared",
    description:
      "Gradient Reconcile covers more vendors and PSAs; SeatTrue checks Microsoft lines on price × markup at a flat price. A fair, sourced comparison.",
    eyebrow: "Compare",
    headline: "SeatTrue vs Gradient Reconcile",
    updatedAt: "2026-11-02",
    primaryKeyword: "gradient msp alternative",
    secondaryKeyword: "microsoft 365 license reconciliation for msps",
  },
  comparePsaSync: {
    path: "/compare/pax8-psa-sync",
    title: "SeatTrue vs Pax8-to-PSA sync: what each one checks",
    description:
      "A Pax8-to-PSA sync keeps seat quantities in step. It doesn't describe checking price or markup. Here's what each covers, with sources.",
    eyebrow: "Compare",
    headline: "SeatTrue vs a Pax8-to-PSA sync",
    updatedAt: "2026-11-02",
    primaryKeyword: "pax8 psa sync price check",
    secondaryKeyword: "pax8 billing reconciliation",
  },
  compareSpreadsheet: {
    path: "/compare/spreadsheet",
    title: "SeatTrue vs a spreadsheet for M365 reconciliation",
    description:
      "A spreadsheet can reconcile Microsoft 365 billing if someone rebuilds it every month. What it costs in time and what it tends to miss.",
    eyebrow: "Compare",
    headline: "SeatTrue vs a reconciliation spreadsheet",
    updatedAt: "2026-11-02",
    primaryKeyword: "m365 reconciliation spreadsheet alternative",
    secondaryKeyword: "msp license margin",
  },
  forMsps: {
    path: "/for/msps",
    title: "Microsoft 365 billing software for MSPs · SeatTrue",
    description:
      "For MSPs reselling Microsoft 365: check every seat and price on the distributor bill against what each client is invoiced, before invoices go out.",
    eyebrow: "For MSPs",
    headline: "Bill every Microsoft seat you pay for",
    updatedAt: "2026-11-02",
    primaryKeyword: "microsoft 365 billing software for msps",
    secondaryKeyword: "msp license margin",
  },
  forFinance: {
    path: "/for/msp-finance-and-billing-teams",
    title: "Month-end M365 reconciliation for MSP billing teams",
    description:
      "For the person who closes the month at an MSP: one exceptions inbox for Microsoft 365, each with a dollar figure and an audit trail, before invoicing.",
    eyebrow: "For MSP finance and billing teams",
    headline: "Close the Microsoft month without the spreadsheet",
    updatedAt: "2026-11-02",
    primaryKeyword: "msp billing team reconciliation",
    secondaryKeyword: "pax8 billing reconciliation",
  },
  forSmall: {
    path: "/for/small-msps",
    title: "Microsoft 365 reconciliation for small MSPs · SeatTrue",
    description:
      "For MSPs with 1 to 20 staff, where the owner does the billing: a monthly Microsoft 365 check that takes minutes, from a flat $49 a month.",
    eyebrow: "For small MSPs (1–20 staff)",
    headline: "Billing is one of your ten jobs. Make it a short one.",
    updatedAt: "2026-11-02",
    primaryKeyword: "small msp microsoft 365 billing",
    secondaryKeyword: "msp license margin",
  },
  forGrowing: {
    path: "/for/growing-msps",
    title: "Billing approvals for growing MSPs · SeatTrue",
    description:
      "For MSPs with several techs touching licences: techs flag, admins approve, owners set markups. One audit trail for every Microsoft 365 billing call.",
    eyebrow: "For growing MSPs",
    headline: "Techs add seats. Someone has to approve the bill.",
    updatedAt: "2026-11-02",
    primaryKeyword: "msp billing approval workflow",
    secondaryKeyword: "nce seat management",
  },
  integrations: {
    path: "/integrations",
    title: "SeatTrue integrations: Pax8, Partner Center and more",
    description:
      "What SeatTrue reads today (Pax8 and Partner Center CSV imports, plus a read-only MCP server for Claude) and what's coming: distributor APIs and PSA syncs.",
    eyebrow: "Integrations",
    headline: "Works with your existing tools",
    updatedAt: "2026-11-02",
    primaryKeyword: "msp billing reconciliation integrations",
    secondaryKeyword: "pax8 billing reconciliation",
  },
  audit: {
    path: "/audit",
    title: "Free Microsoft 365 margin audit for MSPs · SeatTrue",
    description:
      "Upload your Pax8 bill and your client billing export; we check every line at cost × your agreed markup and show last month's leak in dollars.",
    eyebrow: "Free margin audit",
    headline: "See last month's leak in dollars",
    updatedAt: "2026-11-02",
    primaryKeyword: "free msp margin audit",
    secondaryKeyword: "msp license margin",
  },
  privacy: {
    path: "/privacy",
    title: "SeatTrue privacy policy",
    description:
      "What SeatTrue processes and why, legal bases, sub-processors, retention and your GDPR rights. Operated by SDX Studio, Belgium.",
    eyebrow: "Legal",
    headline: "Privacy policy",
    updatedAt: "2026-11-02",
    primaryKeyword: "seattrue privacy policy",
    secondaryKeyword: "msp billing data privacy",
  },
  terms: {
    path: "/terms",
    title: "SeatTrue terms of service",
    description:
      "The B2B terms for SeatTrue: monthly billing, cancel anytime, no refunds, never any interest or late fees, Belgian law.",
    eyebrow: "Legal",
    headline: "Terms of Service",
    updatedAt: "2026-11-02",
    primaryKeyword: "seattrue terms of service",
    secondaryKeyword: "seattrue refund policy",
  },
  dpa: {
    path: "/dpa",
    title: "SeatTrue data processing agreement (GDPR Art. 28)",
    description:
      "How SDX Studio processes MSPs' uploaded billing data for SeatTrue as a processor under Article 28 GDPR.",
    eyebrow: "Legal",
    headline: "Data Processing Agreement",
    updatedAt: "2026-11-02",
    primaryKeyword: "seattrue dpa",
    secondaryKeyword: "gdpr data processing agreement",
  },
} satisfies Record<string, SitePage>;

export type SitePageKey = keyof typeof sitePages;

export function absoluteUrl(path: string): string {
  return `${brand.siteUrl}${path === "/" ? "/" : path}`;
}

export function pageOgImage(key: SitePageKey): string {
  return absoluteUrl(`/og/page/${key}.png`);
}

export function postOgImage(slug: string): string {
  return absoluteUrl(`/og/blog/${slug}.png`);
}

/** The no-card tier. Mirrors freePlan in packages/billing/src/plans.ts. */
export const freeTier = {
  id: "free",
  name: "Free",
  clients: 10,
  summary:
    "Up to 10 active clients and unlimited users. No card, no time limit",
} as const;

/** Facts reused by pricing, structured data and llms.txt. One source. */
export const plans = [
  {
    id: "starter",
    name: "Starter",
    priceUsd: 49,
    summary: "Up to 50 active clients and unlimited users",
  },
  {
    id: "pro",
    name: "Pro",
    priceUsd: 149,
    summary: "Unlimited clients and unlimited users",
  },
] as const;

export const refundPolicy =
  "No refunds; cancel anytime and keep access until the end of the paid period.";

/** Blog → product link mesh: each post points at the closest compare or for-page. */
export function pagesForPost(slug: string): SitePageKey[] {
  if (slug.includes("gradient")) return ["compareGradient", "pricing"];
  if (slug.includes("psa-sync")) return ["comparePsaSync", "integrations"];
  if (slug.includes("close-checklist")) return ["forFinance", "pricing"];
  if (slug.includes("spreadsheet")) return ["compareSpreadsheet", "pricing"];
  return ["forMsps", "pricing"];
}
