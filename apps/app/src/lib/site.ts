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
    title: "SeatTrue pricing: $149 Solo or $249 Team, flat monthly",
    description:
      "Two flat monthly plans for Microsoft 365 license reconciliation. Solo $149 for up to 150 clients and 2 users; Team $249 unlimited. Free audit first.",
    eyebrow: "Pricing",
    headline: "$149 or $249 a month. Flat. Free audit first.",
    updatedAt: "2026-11-02",
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
    primaryKeyword: "license leakage",
    secondaryKeyword: "nce seat management",
  },
  compareGradient: {
    path: "/compare/gradient",
    title: "SeatTrue vs Gradient MSP: reconciliation compared",
    description:
      "Gradient covers more vendors and PSAs; SeatTrue checks Microsoft lines on price × markup at a flat price. A fair, sourced comparison.",
    eyebrow: "Compare",
    headline: "SeatTrue vs Gradient MSP",
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
    primaryKeyword: "pax8 psa sync",
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
    primaryKeyword: "m365 billing reconciliation spreadsheet",
    secondaryKeyword: "msp license margin",
  },
  forPax8: {
    path: "/for/pax8-msps",
    title: "Pax8 billing reconciliation for MSPs · SeatTrue",
    description:
      "For MSPs buying Microsoft 365 through Pax8: match each month's Pax8 bill to client invoices on seats and price × markup, before invoices go out.",
    eyebrow: "For Pax8 partners",
    headline: "Reconcile the Pax8 bill before you invoice",
    updatedAt: "2026-11-02",
    primaryKeyword: "pax8 billing reconciliation",
    secondaryKeyword: "nce seat management",
  },
  forHalo: {
    path: "/for/halopsa-msps",
    title: "HaloPSA + Pax8 license reconciliation · SeatTrue",
    description:
      "For HaloPSA shops reselling Microsoft 365 through Pax8: check the price and markup the quantity sync leaves alone. Works from CSV exports today.",
    eyebrow: "For HaloPSA MSPs",
    headline: "The price check your Halo sync doesn't do",
    updatedAt: "2026-11-02",
    primaryKeyword: "halopsa pax8 billing",
    secondaryKeyword: "pax8 billing reconciliation",
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

/** Facts reused by pricing, structured data and llms.txt. One source. */
export const plans = [
  {
    id: "solo",
    name: "Solo",
    priceUsd: 149,
    summary: "Up to 150 active clients and 2 users",
  },
  {
    id: "team",
    name: "Team",
    priceUsd: 249,
    summary: "Unlimited clients and unlimited users",
  },
] as const;

export const refundPolicy =
  "No refunds; cancel anytime and keep access until the end of the paid period.";
