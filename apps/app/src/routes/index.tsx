import { Button, brand, Input, Label } from "@seattrue/ui";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check, Layers3, LoaderCircle, Minus } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { joinWaitlist } from "../lib/recon-api";

const title = `${brand.name}: the margin gate for Microsoft resellers`;
const description =
  "SeatTrue checks every Microsoft 365 line on your Pax8 bill against what you invoice each client, at cost × your agreed markup, and flags unbilled seats and ghost licences before the invoice goes out.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:image", content: `${brand.appUrl}/og.png` },
      { property: "og:url", content: `${brand.appUrl}/` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: `${brand.appUrl}/og.png` },
    ],
    links: [
      { rel: "canonical", href: `${brand.appUrl}/` },
      { rel: "sitemap", type: "application/xml", href: "/sitemap.xml" },
    ],
  }),
  component: LandingPage,
});

const problems = [
  {
    label: "Renewals at last year's price",
    body: "Microsoft's 2026 increase applies when each subscription renews, so PSA prices go stale one client at a time. Nobody notices until margin is gone.",
  },
  {
    label: "Seats nobody invoiced",
    body: "A client adds four Business Premium seats mid-month. Pax8 bills you. The agreement still says 38.",
  },
  {
    label: "Licences for clients who left",
    body: "Offboarding closes the ticket, not the subscription. You keep paying for seats no one will ever pay you for.",
  },
];

const steps = [
  {
    title: "Upload last month's Pax8 export",
    body: "No integration to approve. Map each Pax8 customer to a PSA client once; SeatTrue remembers it.",
  },
  {
    title: "Every line is checked twice",
    body: "Quantity against the agreement, and price against Pax8 cost × the markup you agreed with that client.",
  },
  {
    title: "Work the exceptions before you invoice",
    body: "Each one has a monthly dollar figure. Approve it, mark it billed, or dismiss it. Statuses survive re-runs.",
  },
];

type Cell = string | boolean;
const comparison: {
  check: string;
  native: Cell;
  gradient: Cell;
  ours: Cell;
}[] = [
  {
    check: "Price",
    native: "Included",
    gradient: "$299–$999/mo + $199 Microsoft add-on",
    ours: "$149 or $249/mo flat",
  },
  {
    check: "Checks quantities against the PSA",
    native: true,
    gradient: true,
    ours: true,
  },
  {
    check: "Checks price against cost × each client's agreed markup",
    native: false,
    gradient: "Flags cost changes; markup check not documented",
    ours: true,
  },
  {
    check: "Exceptions with sign-off before invoicing",
    native: false,
    gradient: "Approve and sync",
    ours: true,
  },
  {
    check: "Distributors",
    native: "Pax8 only",
    gradient: "Pax8, Ingram, TD SYNNEX + 30 vendors",
    ours: "Pax8 today",
  },
  {
    check: "Writes back to the PSA",
    native: "Quantities",
    gradient: true,
    ours: "Not yet (read-only)",
  },
  {
    check: "Time to first result",
    native: "Hours of manual binding",
    gradient: "Days of mapping",
    ours: "Under 30 minutes from a CSV",
  },
];

const plans = [
  {
    name: "Starter",
    price: "$149",
    detail: "Up to 150 clients",
    features: [
      "Monthly Pax8 reconciliation",
      "Price × markup checks on every line",
      "Exceptions inbox with sign-off",
      "Unlimited users at your MSP",
    ],
  },
  {
    name: "Growth",
    price: "$249",
    detail: "Unlimited clients",
    features: [
      "Everything in Starter",
      "Per-client margin history",
      "Priority help mapping your first month",
      "Early access to HaloPSA sync",
    ],
  },
];

const faqs = [
  {
    q: "Do I need to connect Pax8 or my PSA?",
    a: "No. Start with last month's Pax8 billing export and your agreement prices. A Pax8 API connection and HaloPSA sync come next; Pax8 approves third-party API access case by case, so CSV is always supported.",
  },
  {
    q: "How is this different from Gradient MSP?",
    a: "Gradient is broader: more distributors and vendors, and it writes back to five PSAs. If you need that today, it's a good choice. SeatTrue is narrower and cheaper: it checks every Microsoft line's price against the markup you agreed with that client, and puts the result in a sign-off queue before you invoice.",
  },
  {
    q: "What does SeatTrue change in my systems?",
    a: "Nothing. It reads exports and shows exceptions. You decide what goes on the invoice.",
  },
  {
    q: "Does it handle NCE monthly vs annual terms?",
    a: "Each Pax8 line keeps its own term and cost, so annual and monthly versions of the same SKU are priced separately.",
  },
  {
    q: "What's in the free reconciliation run?",
    a: "Send one month's Pax8 export and your current client prices. You get back the exception list with a monthly dollar figure. If it finds nothing, you've lost 15 minutes.",
  },
  {
    q: "Who's behind it?",
    a: "SeatTrue is built by the team at SDX Studio, which runs outbound for MSPs and MSSPs. We kept hearing about billing leakage on calls, so we built the check.",
  },
];

function LandingPage() {
  return (
    <div className="lp">
      <header className="lp-header">
        <a className="lp-brand" href="/" aria-label={`${brand.name} home`}>
          <span className="lp-brand-mark" aria-hidden="true">
            <Layers3 size={18} strokeWidth={1.8} />
          </span>
          {brand.name}
        </a>
        <nav className="lp-nav" aria-label="Site">
          <a href="#how">How it works</a>
          <a href="#compare">Compare</a>
          <a href="#pricing">Pricing</a>
          <Link to="/login" search={{ redirect: "/app" }}>
            Sign in
          </Link>
        </nav>
      </header>

      <main id="main">
        <section className="lp-hero lp-hero-split" aria-labelledby="lp-title">
          <div>
            <p className="lp-kicker">The margin gate for Microsoft resellers</p>
            <h1 id="lp-title">
              Find the license leak before the invoice goes out.
            </h1>
            <p className="lp-lede">
              Your Pax8 sync copies quantities. It never checks the price.{" "}
              {brand.name} matches every Microsoft line to the right client and
              its agreed markup, then shows you only what's wrong, in dollars.
            </p>
            <div className="lp-actions">
              <a className="lp-primary" href="#audit">
                Get a free margin audit
                <ArrowRight size={18} aria-hidden="true" />
              </a>
              <Link
                className="lp-secondary"
                to="/signup"
                search={{ redirect: "/app" }}
              >
                Try it with demo data
              </Link>
            </div>
          </div>
          <ProductMock />
        </section>

        <section className="lp-section" aria-labelledby="lp-problem">
          <p className="lp-kicker">The problem</p>
          <h2 id="lp-problem">Three leaks a quantity sync can't see</h2>
          <ul className="lp-cards">
            {problems.map((problem) => (
              <li key={problem.label}>
                <h3>{problem.label}</h3>
                <p>{problem.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section id="how" className="lp-section" aria-labelledby="lp-how">
          <p className="lp-kicker">How it works</p>
          <h2 id="lp-how">
            From Pax8 export to a clean invoice in three steps
          </h2>
          <ol className="lp-step-grid">
            {steps.map((step, index) => (
              <li key={step.title}>
                <span className="lp-step-number" aria-hidden="true">
                  {index + 1}
                </span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section
          id="compare"
          className="lp-section"
          aria-labelledby="lp-compare"
        >
          <p className="lp-kicker">Why not Gradient or the Pax8 sync?</p>
          <h2 id="lp-compare">A margin gate, not another sync</h2>
          <div className="lp-table-wrap">
            <table className="lp-table">
              <thead>
                <tr>
                  <th scope="col">
                    <span className="sr-only">Check</span>
                  </th>
                  <th scope="col">Native Pax8 → PSA sync</th>
                  <th scope="col">Gradient MSP Synthesize</th>
                  <th scope="col" className="lp-ours">
                    {brand.name}
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((row) => (
                  <tr key={row.check}>
                    <th scope="row">{row.check}</th>
                    <td>
                      <CellValue value={row.native} />
                    </td>
                    <td>
                      <CellValue value={row.gradient} />
                    </td>
                    <td className="lp-ours">
                      <CellValue value={row.ours} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="lp-footnote">
            Gradient pricing from meetgradient.com/pricing, November 2026. If
            you need 30+ vendor integrations and PSA write-back today, Gradient
            is the broader tool.
          </p>
        </section>

        <section
          id="pricing"
          className="lp-section"
          aria-labelledby="lp-pricing"
        >
          <p className="lp-kicker">Pricing</p>
          <h2 id="lp-pricing">Flat monthly price. No per-seat maths.</h2>
          <div className="lp-plans">
            {plans.map((plan) => (
              <article className="lp-plan" key={plan.name}>
                <h3>{plan.name}</h3>
                <p className="lp-plan-price">
                  <strong>{plan.price}</strong>/month
                </p>
                <p className="lp-plan-detail">{plan.detail}</p>
                <ul>
                  {plan.features.map((feature) => (
                    <li key={feature}>
                      <Check size={16} aria-hidden="true" /> {feature}
                    </li>
                  ))}
                </ul>
                <a className="lp-secondary" href="#audit">
                  Start with a free audit
                </a>
              </article>
            ))}
          </div>
          <p className="lp-footnote">
            Billed monthly. Cancel any time from the billing page.
          </p>
        </section>

        <section className="lp-section" aria-labelledby="lp-faq">
          <p className="lp-kicker">FAQ</p>
          <h2 id="lp-faq">Questions MSP owners ask first</h2>
          <div className="lp-faq">
            {faqs.map((faq) => (
              <details key={faq.q}>
                <summary>{faq.q}</summary>
                <p>{faq.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section id="audit" className="lp-audit" aria-labelledby="lp-audit">
          <div>
            <p className="lp-kicker">Free margin audit</p>
            <h2 id="lp-audit">See last month's leak in dollars</h2>
            <p>
              Leave your work email. We'll reply with where to send one month's
              Pax8 export and return the exceptions, each with a monthly dollar
              figure. Built by the team at SDX Studio.
            </p>
          </div>
          <WaitlistForm />
        </section>
      </main>

      <footer className="lp-footer">
        <span>© {brand.name} · Built by SDX Studio</span>
        <Link to="/login" search={{ redirect: "/app" }}>
          Sign in
        </Link>
      </footer>
    </div>
  );
}

function CellValue({ value }: { value: Cell }) {
  if (value === true)
    return <Check size={18} className="lp-yes" aria-label="Yes" />;
  if (value === false)
    return <Minus size={18} className="lp-no" aria-label="No" />;
  return <>{value}</>;
}

/** Static, accessible rendering of the overview screen using demo figures. */
function ProductMock() {
  const rows: [string, string, string][] = [
    ["Copperline Builders", "Unbilled seats", "$180.00"],
    ["Maple & Co. Bakery", "Unmapped customer", "$112.50"],
    ["Harbor Dental Group", "Unbilled seats", "$105.60"],
    ["Bright Path Tutoring", "Ghost licence", "$90.00"],
    ["Keystone Logistics", "Stale price / markup", "$36.00"],
  ];
  return (
    <figure className="lp-mock" aria-label="SeatTrue overview with demo data">
      <div className="lp-mock-stat">
        <span>Leakage found this month</span>
        <strong>$548.10</strong>
        <small>$6,577.20 a year if nothing changes</small>
      </div>
      <table>
        <caption className="sr-only">Top exceptions in the demo MSP</caption>
        <tbody>
          {rows.map(([client, kind, amount]) => (
            <tr key={client + kind}>
              <th scope="row">{client}</th>
              <td>{kind}</td>
              <td>{amount}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <figcaption>Demo MSP "Northbeam IT", 8 clients, one Pax8 bill</figcaption>
    </figure>
  );
}

function WaitlistForm() {
  const [state, setState] = useState<"idle" | "pending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const company = String(form.get("company") ?? "").trim();
    const seats = Number(form.get("seats") || 0);
    setError(null);
    setState("pending");
    try {
      await joinWaitlist({
        email,
        ...(company ? { company } : {}),
        ...(seats > 0 ? { seats: Math.round(seats) } : {}),
      });
      setState("done");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Something went wrong.",
      );
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <p className="lp-done" role="status">
        Thanks. We'll email you within one working day with where to send the
        export.
      </p>
    );
  }

  return (
    <form className="lp-form" onSubmit={submit} aria-busy={state === "pending"}>
      <div className="lp-field">
        <Label htmlFor="wl-email">Work email</Label>
        <Input
          id="wl-email"
          name="email"
          type="email"
          required
          placeholder="you@yourmsp.com"
          autoComplete="email"
          aria-describedby="wl-email-hint"
        />
        <span id="wl-email-hint" className="lp-hint">
          Company address only, no Gmail or Outlook.com.
        </span>
      </div>
      <div className="lp-field">
        <Label htmlFor="wl-company">MSP name</Label>
        <Input id="wl-company" name="company" maxLength={160} />
      </div>
      <div className="lp-field">
        <Label htmlFor="wl-seats">Microsoft seats under management</Label>
        <Input id="wl-seats" name="seats" type="number" min={1} />
      </div>
      {error && (
        <p className="lp-error" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={state === "pending"}>
        {state === "pending" && (
          <LoaderCircle className="spin" size={16} aria-hidden="true" />
        )}
        Request my free audit
      </Button>
    </form>
  );
}
