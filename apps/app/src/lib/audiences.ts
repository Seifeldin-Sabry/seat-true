import type { Source } from "../components/marketing";
import type { FaqItem } from "./content/blog";
import type { SitePageKey } from "./site";

/**
 * Landing pages per buyer: who they are, not which tools they run. Tools are
 * mentioned only as "works with your existing tools", linking /integrations.
 */
export type Audience = {
  key: SitePageKey;
  eyebrow: string;
  title: string;
  intro: string;
  problemsTitle: string;
  problems: { title: string; body: string }[];
  stepsTitle: string;
  steps: { title: string; body: string }[];
  faq: FaqItem[];
  sources: Source[];
  posts: string[];
  terms: string[];
  pages: SitePageKey[];
};

const partnerCenterPricing: Source = {
  label: "Microsoft Learn: Partner Center pricing and offers",
  href: "https://learn.microsoft.com/en-us/partner-center/pricing/pricing-and-offers#new-commerce-license-based-pricing",
  note: "new-commerce price changes apply at renewal",
};
const newCommerceSubscriptions: Source = {
  label: "Microsoft Learn: new commerce license-based subscriptions",
  href: "https://learn.microsoft.com/en-us/partner-center/customers/new-commerce-license-based",
  note: "seat reductions limited after the first days of a term",
};

const noAccessFaq: FaqItem = {
  q: "Do you need access to our distributor or PSA?",
  a: "No. SeatTrue runs on a CSV export of the distributor bill (Pax8, or a Microsoft Partner Center reconciliation file) and never writes to any of your systems. Distributor APIs and PSA syncs are coming; the integrations page shows what's live.",
};

export const audiences: Record<string, Audience> = {
  msps: {
    key: "forMsps",
    eyebrow: "For MSPs reselling Microsoft 365",
    title: "Bill every Microsoft seat you pay for",
    intro:
      "You pay your distributor for every Microsoft 365 seat on the bill. Somewhere between that bill and the client invoice, seats and price rises go missing. SeatTrue checks every line, every month, on quantity and on cost × the markup you agreed with that client.",
    problemsTitle: "Where the margin goes",
    problems: [
      {
        title: "Seats nobody billed",
        body: "A tech adds licences mid-month. The client agreement keeps the old quantity, and the difference comes out of your margin.",
      },
      {
        title: "Prices that moved at renewal",
        body: "Under NCE, Microsoft's price changes land at each subscription's renewal. Invoices still at last term's price look fine on quantity.",
      },
      {
        title: "Clients you've already offboarded",
        body: "The client is gone; the subscription isn't. Ghost licences keep costing you until someone notices.",
      },
    ],
    stepsTitle: "How it fits your month",
    steps: [
      {
        title: "Export",
        body: "Download last month's distributor bill as CSV. No API access to approve.",
      },
      {
        title: "Map once",
        body: "Link each distributor customer to one client. Mappings are kept, so next month is just the exceptions.",
      },
      {
        title: "Fix before invoicing",
        body: "Approve, mark billed or dismiss each exception. Each carries a monthly dollar figure and an audit trail.",
      },
    ],
    faq: [
      {
        q: "What does SeatTrue check?",
        a: "Every Microsoft line on the distributor bill against what that client is invoiced: seat count, and price against cost × that client's agreed markup. It raises five kinds of exception: unbilled seats, stale price or markup, ghost licences, overbilling and unmapped customers.",
      },
      noAccessFaq,
      {
        q: "What does it cost?",
        a: "$49 a month for Starter (up to 50 active clients) or $149 a month for Pro (unlimited clients). Users are unlimited on both. The first margin audit on your own export is free.",
      },
    ],
    sources: [partnerCenterPricing, newCommerceSubscriptions],
    posts: [
      "what-is-license-leakage",
      "reconcile-pax8-bill-against-psa-invoices",
      "ghost-licences-after-offboarding",
    ],
    terms: [
      "license-leakage",
      "unbilled-seats",
      "stale-price",
      "ghost-licence",
    ],
    pages: ["forSmall", "forGrowing", "integrations", "pricing"],
  },
  "msp-finance-and-billing-teams": {
    key: "forFinance",
    eyebrow: "For MSP finance and billing teams",
    title: "Close the Microsoft month without the spreadsheet",
    intro:
      "You're the one who makes the distributor bill and the client invoices agree before they go out. SeatTrue does the line-by-line comparison and hands you only the exceptions, each with a dollar figure, so the close is decisions rather than VLOOKUPs.",
    problemsTitle: "What makes the close slow",
    problems: [
      {
        title: "Names that never match",
        body: "“Acme Corp” on the bill and “Acme Corporation” in the PSA. Every month someone matches them by hand, or they go unchecked.",
      },
      {
        title: "Markups that live in people's heads",
        body: "Fifteen per cent here, twenty there, a legacy deal somewhere. Checking price means knowing each client's markup.",
      },
      {
        title: "No record of who decided what",
        body: "A discrepancy was waived last quarter. Nobody remembers why, or who said so.",
      },
    ],
    stepsTitle: "How it fits your close",
    steps: [
      {
        title: "Upload the bill",
        body: "Upload the month's distributor export. Customer mappings and client markups from last month are already in place.",
      },
      {
        title: "Work the inbox",
        body: "Exceptions sort by monthly dollar impact. Approve, mark billed or dismiss; comment where a tech needs to explain.",
      },
      {
        title: "Invoice with a trail",
        body: "Every decision is in the audit log with who made it and when, ready for next month's questions.",
      },
    ],
    faq: [
      {
        q: "How is the expected price worked out?",
        a: "Distributor unit cost × (1 + that client's markup), rounded to whole cents. A small rounding tolerance stops cent-level differences from being flagged.",
      },
      {
        q: "Can techs change what gets billed?",
        a: "No. Techs can upload, flag and comment. Resolving an exception (approve, mark billed, dismiss) needs an admin or the owner, and only the owner sets client markups.",
      },
      noAccessFaq,
    ],
    sources: [
      partnerCenterPricing,
      {
        label: "Microsoft Learn: Use the reconciliation files",
        href: "https://learn.microsoft.com/en-us/partner-center/billing/use-the-reconciliation-files",
        note: "use EffectiveUnitPrice for licence-based cost",
      },
    ],
    posts: [
      "m365-billing-close-checklist",
      "how-seattrue-calculates-license-leakage",
      "m365-markup-policy-for-msps",
    ],
    terms: [
      "billing-close",
      "customer-mapping",
      "markup-policy",
      "effective-unit-price",
    ],
    pages: ["compareSpreadsheet", "forGrowing", "integrations", "pricing"],
  },
  "small-msps": {
    key: "forSmall",
    eyebrow: "For small MSPs (1–20 staff)",
    title: "Billing is one of your ten jobs. Make it a short one.",
    intro:
      "At a small MSP the owner, or one person next to them, does the billing between everything else. There's no time for a monthly spreadsheet, so the Microsoft bill gets a glance and the invoices go out. SeatTrue does the check for you and shows only what's wrong.",
    problemsTitle: "Why it slips at a small shop",
    problems: [
      {
        title: "No billing person",
        body: "Reconciliation is nobody's job, so it happens at quarter-end, or after a client asks about an invoice.",
      },
      {
        title: "Every dollar counts",
        body: "A few unbilled seats a month is real money when Microsoft resale is already a thin-margin line.",
      },
      {
        title: "Tools priced for bigger shops",
        body: "Broad reconciliation platforms cover every vendor and are priced for it. You mostly need Microsoft checked.",
      },
    ],
    stepsTitle: "How it fits a small team",
    steps: [
      {
        title: "Set up once",
        body: "Upload a bill, link each distributor customer to a client and set each client's markup.",
      },
      {
        title: "Each month after",
        body: "Upload the new bill. Only changes and exceptions show up, sorted by dollars.",
      },
      {
        title: "Everyone included",
        body: "Starter covers up to 50 active clients with unlimited users: you, whoever helps with billing, and your techs.",
      },
    ],
    faq: [
      {
        q: "Is Starter enough for us?",
        a: "Starter is $49 a month for up to 50 active clients, with unlimited users. If you pass 50 clients, Pro is $149 a month with no client limit.",
      },
      {
        q: "We don't have a PSA. Does that matter?",
        a: "No. You set each client and their markup in SeatTrue; the distributor bill comes in as CSV. PSA syncs are coming for those who have one.",
      },
      noAccessFaq,
    ],
    sources: [partnerCenterPricing],
    posts: [
      "seattrue-vs-spreadsheet-m365-reconciliation",
      "what-is-license-leakage",
      "nce-monthly-vs-annual-seat-reduction-rules",
    ],
    terms: ["license-leakage", "unbilled-seats", "nce"],
    pages: ["compareSpreadsheet", "pricing", "integrations"],
  },
  "growing-msps": {
    key: "forGrowing",
    eyebrow: "For growing MSPs",
    title: "Techs add seats. Someone has to approve the bill.",
    intro:
      "Once several techs can add Microsoft licences, nobody holds the full picture. SeatTrue gives each role its part: techs flag what they changed, admins approve what gets billed, the owner sets markups and the plan. Every call lands in one audit log.",
    problemsTitle: "What breaks as you grow",
    problems: [
      {
        title: "Changes nobody hears about",
        body: "A tech adds five seats for a new starter and moves on. Billing finds out at renewal, or never.",
      },
      {
        title: "Approvals in chat threads",
        body: "Whether to bill, credit or waive a discrepancy gets decided in chat and lost there.",
      },
      {
        title: "Too many hands on pricing",
        body: "If anyone can change a client's markup, nobody can trust the check.",
      },
    ],
    stepsTitle: "Who does what",
    steps: [
      {
        title: "Tech",
        body: "Sees everything. Uploads the bill, flags exceptions and comments with context (“new starter, billed from the 1st”).",
      },
      {
        title: "Admin",
        body: "Ops or finance. Resolves exceptions (approve, mark billed, dismiss), edits customer mappings, invites people and reads the audit log.",
      },
      {
        title: "Owner",
        body: "Everything an admin does, plus client markups, adding and archiving clients, billing and the workspace itself.",
      },
    ],
    faq: [
      {
        q: "Can a tech resolve an exception?",
        a: "No. Techs can flag and comment; resolving needs an admin or the owner. The server enforces this, not just the screen.",
      },
      {
        q: "How many people can we add?",
        a: "As many as you like, on either plan. Plans differ only by client count. Invites grant admin or tech; ownership is never handed out by invite.",
      },
      {
        q: "Is there a record of who approved what?",
        a: "Yes. Resolutions, flags, comments, mapping and markup changes go into the audit log with who and when. Admins and the owner can read it.",
      },
    ],
    sources: [partnerCenterPricing, newCommerceSubscriptions],
    posts: [
      "m365-billing-close-checklist",
      "ghost-licences-after-offboarding",
      "m365-renewal-price-review-checklist",
    ],
    terms: ["unbilled-seats", "markup-policy", "billing-close"],
    pages: ["forFinance", "pricing", "integrations"],
  },
};
