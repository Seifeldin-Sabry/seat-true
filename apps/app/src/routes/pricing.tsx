import { createFileRoute } from "@tanstack/react-router";
import { Check } from "lucide-react";
import {
  AuditCta,
  FurtherReading,
  PageIntro,
  sitePageHead,
} from "../components/marketing";
import { SiteShell } from "../components/site-chrome";
import { getLivePostLinks } from "../lib/content/blog-fns";
import { plans, refundPolicy } from "../lib/site";
import { faqPage, softwareApplication } from "../lib/structured-data";

const included = [
  "Monthly reconciliation of every Microsoft line on the Pax8 bill",
  "Quantity and price × agreed-markup check, per client",
  "Exceptions inbox with approve, mark billed and dismiss",
  "Owner, admin and technician roles with an audit log",
  "CSV import: no API access, nothing written to Pax8 or your PSA",
  "Customer-to-client mapping set up with you",
  "Read-only MCP server: ask Claude, Cursor or any MCP client about your leakage",
];

const pricingFaq = [
  {
    q: "Is there a per-licence or per-client fee?",
    a: "No. Starter is $49 a month flat for up to 50 active clients. Pro is $149 a month flat with unlimited clients. Users are unlimited on both.",
  },
  {
    q: "Do I have to pay before the audit?",
    a: "No. The margin audit runs on one month's Pax8 export first and costs nothing. You choose a plan only if you want to keep reconciling every month.",
  },
  {
    q: "What happens if we cancel?",
    a: refundPolicy,
  },
  {
    q: "Can we switch plans?",
    a: "Yes. Upgrading to Pro takes effect immediately. Moving to Starter starts at the end of the period you've paid for.",
  },
];

export const Route = createFileRoute("/pricing")({
  loader: () => getLivePostLinks(),
  head: () =>
    sitePageHead(
      "pricing",
      [{ name: "Pricing", path: "/pricing" }],
      [softwareApplication(), faqPage(pricingFaq)],
    ),
  component: PricingPage,
});

function PricingPage() {
  const livePosts = Route.useLoaderData();
  return (
    <SiteShell>
      <PageIntro eyebrow="Pricing" title="Two flat plans. Free audit first.">
        <p>
          No per-licence fees, no per-user fees and no setup fee. Run the free
          margin audit: upload your Pax8 bill and your client billing export,
          then pick the plan that fits your client count.
        </p>
      </PageIntro>

      <section className="st-section st-section-tight" aria-label="Plans">
        <div className="st-plans">
          {plans.map((plan) => (
            <article
              key={plan.id}
              className="st-plan"
              aria-labelledby={`plan-${plan.id}`}
            >
              <h2 id={`plan-${plan.id}`}>{plan.name}</h2>
              <p className="st-price-figure">
                <strong>${plan.priceUsd}</strong>/month
              </p>
              <p>{plan.summary}.</p>
              <a className="st-btn" href="/audit">
                Start with the free audit
              </a>
            </article>
          ))}
        </div>
        <p className="st-footnote">{refundPolicy}</p>
      </section>

      <section
        className="st-section st-section-tight"
        aria-labelledby="included"
      >
        <h2 id="included" className="st-h2-small">
          Included in both plans
        </h2>
        <ul className="st-checklist">
          {included.map((item) => (
            <li key={item}>
              <Check size={18} aria-hidden="true" /> {item}
            </li>
          ))}
        </ul>
      </section>

      <section
        className="st-section st-section-tight"
        aria-labelledby="pricing-faq"
      >
        <h2 id="pricing-faq" className="st-h2-small">
          Pricing questions
        </h2>
        <div className="st-faq">
          {pricingFaq.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <FurtherReading
        pages={["compareGradient", "compareSpreadsheet", "forSmall"]}
        posts={[
          "how-seattrue-calculates-license-leakage",
          "what-is-license-leakage",
        ]}
        livePosts={livePosts}
        terms={["license-leakage", "markup-policy"]}
      />
      <AuditCta />
    </SiteShell>
  );
}
