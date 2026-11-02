import { brand } from "@seattrue/ui";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Check,
  LoaderCircle,
  Minus,
  ShieldCheck,
} from "lucide-react";
import type { FormEvent } from "react";
import { useId, useState } from "react";
import { joinWaitlist } from "../lib/recon-api";

const title = `${brand.name}: stop losing money on Microsoft seats you never billed`;
const description =
  "SeatTrue checks every Microsoft 365 line on your Pax8 bill against what you invoice each client, at cost × your agreed markup. Free margin audit: upload one month's export, see the leak in dollars.";
const cta = "Get my free margin audit";

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
    links: [{ rel: "canonical", href: `${brand.appUrl}/` }],
  }),
  component: LandingPage,
});

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

/** Value stack: each anchor states its own basis so nothing reads as an invented stat. */
const stack: { item: string; basis: string; value: number }[] = [
  {
    item: "Done-for-you first audit of your Pax8 bill",
    basis: "what a billing consultant charges for one reconciliation",
    value: 500,
  },
  {
    item: "Monthly reconciliation of every Microsoft line",
    basis: "4 hours of billing-admin time a month at $75/hr",
    value: 300,
  },
  {
    item: "Price × agreed-markup check, per client",
    basis: "the check no PSA sync does; worth whatever it finds",
    value: 0,
  },
  {
    item: "Exceptions inbox with sign-off before invoicing",
    basis: "an audit trail of who approved what, every month",
    value: 150,
  },
  {
    item: "Owner, admin and tech roles with an audit log",
    basis: "techs flag, admins approve, only you touch billing and markups",
    value: 0,
  },
  {
    item: "Customer-to-client mapping set up with you",
    basis: "one onboarding call with the founder",
    value: 200,
  },
  {
    item: "Founding price locked for as long as you stay",
    basis: "no price rises for the first 20 MSPs",
    value: 0,
  },
];
const stackTotal = stack.reduce((sum, row) => sum + row.value, 0);

type Cell = string | boolean;
const comparison: {
  check: string;
  sheet: Cell;
  psa: Cell;
  gradient: Cell;
  ours: Cell;
}[] = [
  {
    check: "Catches seats on the bill but not on the invoice",
    sheet: "If someone checks",
    psa: true,
    gradient: true,
    ours: true,
  },
  {
    check: "Checks price against cost × each client's markup",
    sheet: "If someone checks",
    psa: false,
    gradient: "Not documented",
    ours: true,
  },
  {
    check: "Flags renewals still on last year's price",
    sheet: false,
    psa: false,
    gradient: "Flags cost changes",
    ours: true,
  },
  {
    check: "Licences for clients you've offboarded",
    sheet: "If someone checks",
    psa: "Sometimes",
    gradient: true,
    ours: true,
  },
  {
    check: "Sign-off queue before invoices go out",
    sheet: false,
    psa: false,
    gradient: "Approve and sync",
    ours: true,
  },
  {
    check: "Price",
    sheet: "Your time",
    psa: "Included",
    gradient: "$299–$999/mo + $199",
    ours: "$149 or $249 flat",
  },
];

const faqs = [
  {
    q: "We already sync Pax8 into our PSA. Isn't that enough?",
    a: "The sync copies quantities. It doesn't check that the price on the agreement is still cost × the markup you agreed, and Microsoft's 2026 increase lands one renewal at a time. That gap is what SeatTrue checks.",
  },
  {
    q: "How long does the free audit take?",
    a: "About five minutes of your time: export last month's Pax8 billing CSV and your current client prices. We map customers to clients with you and send back every exception with a monthly dollar figure.",
  },
  {
    q: "What if it finds nothing?",
    a: "Then your billing is in better shape than most, you've lost five minutes, and you don't pay anything. The audit is free either way.",
  },
  {
    q: "Do you need access to Pax8 or our PSA?",
    a: "No. It runs on exports and changes nothing in your systems. A Pax8 API connection and HaloPSA sync are next; CSV keeps working regardless.",
  },
  {
    q: "Why not Gradient MSP?",
    a: "Gradient is broader: more distributors, 30+ vendors, write-back to five PSAs. If you need that today, it's a good tool. SeatTrue is narrower, cheaper and focused on one thing: is every Microsoft line billed at the right quantity and the right price.",
  },
  {
    q: "What if we cancel?",
    a: "No refunds; cancel anytime and keep access until the end of the paid period. That's why the audit comes first and is free: you see the leak in dollars before deciding.",
  },
  {
    q: "Is our billing data safe?",
    a: "Exports are stored in your SeatTrue workspace only, sign-in is limited to company email addresses, and we never write to your Pax8 or PSA.",
  },
  {
    q: "Who's behind SeatTrue?",
    a: "The team at SDX Studio, which runs outbound for MSPs and MSSPs. Billing leakage kept coming up on calls with MSP owners, so we built the check.",
  },
];

function LandingPage() {
  return (
    <div className="st">
      <a className="st-skip" href="#main">
        Skip to content
      </a>
      <header className="st-header">
        <a className="st-brand" href="/" aria-label={`${brand.name} home`}>
          <span className="st-brand-mark" aria-hidden="true">
            S
          </span>
          {brand.name}
        </a>
        <nav className="st-nav" aria-label="Site">
          <a href="#offer">What you get</a>
          <a href="#compare">Compare</a>
          <a href="#faq">FAQ</a>
          <Link to="/login" search={{ redirect: "/app" }}>
            Sign in
          </Link>
        </nav>
        <a className="st-btn st-btn-small" href="#audit">
          Free audit
        </a>
      </header>

      <main id="main">
        <section className="st-hero" aria-labelledby="st-title">
          <div className="st-hero-copy">
            <p className="st-eyebrow">
              For MSPs reselling Microsoft 365 through Pax8
            </p>
            <h1 id="st-title">
              You're losing money on Microsoft seats you{" "}
              <span className="st-mark">never billed</span>.
            </h1>
            <p className="st-lede">
              Your Pax8 sync copies quantities. It never checks the price.{" "}
              {brand.name} checks every line against cost × the markup you
              agreed with that client, and shows the leak in dollars before the
              invoice goes out.
            </p>
            <div className="st-hero-actions">
              <a className="st-btn" href="#audit">
                {cta}
                <ArrowRight size={18} aria-hidden="true" />
              </a>
              <span className="st-hero-note">
                Upload one Pax8 export. See the leak in about 5 minutes. Free.
              </span>
            </div>
          </div>
          <LeakCalculator />
        </section>

        <section className="st-example" aria-labelledby="st-example-title">
          <div>
            <p className="st-eyebrow">Example run</p>
            <h2 id="st-example-title">
              What one month's Pax8 bill turned up for a demo MSP
            </h2>
            <p>
              "Northbeam IT" is our demo workspace: 8 clients, 14 Pax8 lines.
              These are the exceptions SeatTrue raised. Your audit uses your own
              bill.
            </p>
          </div>
          <ProductMock />
        </section>

        <section className="st-section" aria-labelledby="st-leaks">
          <h2 id="st-leaks">Three leaks a quantity sync can't see</h2>
          <div className="st-leaks">
            <article>
              <span className="st-leak-amount">$36/mo</span>
              <h3>Renewals at last year's price</h3>
              <p>
                Microsoft's 2026 increase applies as each subscription renews.
                The agreement keeps billing the old price, one client at a time.
              </p>
            </article>
            <article>
              <span className="st-leak-amount">$285.60/mo</span>
              <h3>Seats nobody invoiced</h3>
              <p>
                Four Business Premium seats added mid-month, five Copilot seats
                added in Pax8. The agreement never changed.
              </p>
            </article>
            <article>
              <span className="st-leak-amount">$114/mo</span>
              <h3>Licences for clients who left</h3>
              <p>
                Offboarding closed the ticket, not the subscription. You keep
                paying for seats nobody will pay you for.
              </p>
            </article>
          </div>
          <p className="st-footnote">
            Amounts are from the Northbeam IT demo run above.
          </p>
        </section>

        <section className="st-section" aria-labelledby="st-how">
          <h2 id="st-how">From Pax8 export to a clean invoice</h2>
          <ol className="st-steps">
            <li>
              <h3>Export</h3>
              <p>
                Download last month's Pax8 billing CSV. No API access, nothing
                to approve.
              </p>
            </li>
            <li>
              <h3>Check</h3>
              <p>
                Every line is matched to a client, then checked on quantity and
                on price × that client's markup.
              </p>
            </li>
            <li>
              <h3>Fix before invoicing</h3>
              <p>
                Approve, mark billed or dismiss each exception. Each one carries
                a monthly dollar figure.
              </p>
            </li>
          </ol>
        </section>

        <section id="offer" className="st-section" aria-labelledby="st-offer">
          <h2 id="st-offer">Everything you get</h2>
          <div className="st-offer">
            <table className="st-stack">
              <caption className="sr-only">
                What's included and what each part is worth
              </caption>
              <thead>
                <tr>
                  <th scope="col">Included</th>
                  <th scope="col">How we valued it</th>
                  <th scope="col">Value</th>
                </tr>
              </thead>
              <tbody>
                {stack.map((row) => (
                  <tr key={row.item}>
                    <th scope="row">
                      <Check size={16} aria-hidden="true" /> {row.item}
                    </th>
                    <td>{row.basis}</td>
                    <td>{row.value > 0 ? usd.format(row.value) : "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" colSpan={2}>
                    Value in the first month, before any leakage you recover
                  </th>
                  <td>{usd.format(stackTotal)}</td>
                </tr>
              </tfoot>
            </table>
            <aside className="st-price" aria-labelledby="st-price-title">
              <h3 id="st-price-title">Solo plan</h3>
              <p className="st-price-figure">
                <strong>$149</strong>/month
              </p>
              <p>
                Solo: flat, up to 150 clients and 2 users. Team: $249/month
                flat, unlimited clients and unlimited users.
              </p>
              <ul>
                <li>No per-licence fees</li>
                <li>
                  Cancel any time, effective at the end of the paid period
                </li>
                <li>Founding price locked while you stay subscribed</li>
              </ul>
              <a className="st-btn" href="#audit">
                {cta}
              </a>
            </aside>
          </div>
        </section>

        <section className="st-guarantee" aria-labelledby="st-guarantee-title">
          <ShieldCheck size={40} aria-hidden="true" />
          <div>
            <h2 id="st-guarantee-title">See the leak before you pay a cent</h2>
            <ul className="st-risk">
              <li>
                <strong>Free margin audit first.</strong> We run your Pax8 bill
                and show every exception in dollars before you subscribe.
              </li>
              <li>
                <strong>Cancel any time.</strong> Cancellation takes effect at
                the end of the period you've paid for, and you keep access until
                then.
              </li>
              <li>
                <strong>Founding price lock.</strong> The first 20 MSPs keep
                their price for as long as they stay subscribed.
              </li>
            </ul>
          </div>
        </section>

        <section
          id="compare"
          className="st-section"
          aria-labelledby="st-compare"
        >
          <h2 id="st-compare">
            Why not a spreadsheet, your PSA sync, or Gradient?
          </h2>
          <div className="st-table-wrap">
            <table className="st-compare">
              <thead>
                <tr>
                  <th scope="col">
                    <span className="sr-only">Check</span>
                  </th>
                  <th scope="col">Spreadsheet</th>
                  <th scope="col">Pax8 → PSA sync</th>
                  <th scope="col">Gradient MSP</th>
                  <th scope="col" className="st-ours">
                    {brand.name}
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((row) => (
                  <tr key={row.check}>
                    <th scope="row">{row.check}</th>
                    <td>
                      <CellValue value={row.sheet} />
                    </td>
                    <td>
                      <CellValue value={row.psa} />
                    </td>
                    <td>
                      <CellValue value={row.gradient} />
                    </td>
                    <td className="st-ours">
                      <CellValue value={row.ours} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="st-footnote">
            Gradient pricing from meetgradient.com/pricing, November 2026.
            Gradient covers more distributors and writes back to the PSA; if you
            need that today, it's the broader tool.
          </p>
        </section>

        <section id="faq" className="st-section" aria-labelledby="st-faq">
          <h2 id="st-faq">The questions MSP owners ask first</h2>
          <div className="st-faq">
            {faqs.map((faq) => (
              <details key={faq.q}>
                <summary>{faq.q}</summary>
                <p>{faq.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section
          id="audit"
          className="st-final"
          aria-labelledby="st-final-title"
        >
          <div>
            <h2 id="st-final-title">See last month's leak in dollars</h2>
            <p>
              We onboard four MSPs a week so every audit gets a real person. The
              first 20 MSPs keep the founding price for as long as they stay.
              Built by the team at SDX Studio.
            </p>
          </div>
          <AuditForm />
        </section>
      </main>

      <footer className="st-footer">
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
    return <Check size={18} className="st-yes" aria-label="Yes" />;
  if (value === false)
    return <Minus size={18} className="st-no" aria-label="No" />;
  return <>{value}</>;
}

/** Cost of inaction: the visitor sets every input, including their own leak estimate. */
function LeakCalculator() {
  const id = useId();
  const [seats, setSeats] = useState(1200);
  const [price, setPrice] = useState(22);
  const [leakPct, setLeakPct] = useState(2);
  const monthly = Math.max(0, seats) * Math.max(0, price) * (leakPct / 100);

  return (
    <form
      className="st-calc"
      aria-labelledby={`${id}-title`}
      onSubmit={(event) => event.preventDefault()}
    >
      <h2 id={`${id}-title`}>What is it costing you?</h2>
      <label htmlFor={`${id}-seats`}>
        Microsoft seats you resell
        <input
          id={`${id}-seats`}
          type="number"
          min={0}
          inputMode="numeric"
          value={seats}
          onChange={(event) => setSeats(Number(event.target.value))}
        />
      </label>
      <label htmlFor={`${id}-price`}>
        Average price per seat ($/month)
        <input
          id={`${id}-price`}
          type="number"
          min={0}
          step="0.5"
          inputMode="decimal"
          value={price}
          onChange={(event) => setPrice(Number(event.target.value))}
        />
      </label>
      <label htmlFor={`${id}-leak`}>
        Share of seats unbilled or mispriced: {leakPct}%
        <input
          id={`${id}-leak`}
          type="range"
          min={0.5}
          max={10}
          step={0.5}
          value={leakPct}
          onChange={(event) => setLeakPct(Number(event.target.value))}
        />
      </label>
      <output
        className="st-calc-result"
        htmlFor={`${id}-seats ${id}-price ${id}-leak`}
        aria-live="polite"
      >
        <span>{usd.format(monthly)}</span>/month
        <small>{usd.format(monthly * 12)} a year</small>
      </output>
      <p className="st-calc-note">
        Your estimate, not ours. The free audit replaces it with the real number
        from your bill.
      </p>
    </form>
  );
}

/** Static rendering of the exceptions the demo run produces (real app output). */
function ProductMock() {
  const rows: [string, string, string][] = [
    ["Copperline Builders", "Unbilled seats · 5 × Copilot", "$180.00"],
    ["Maple & Co. Bakery", "Unmapped customer", "$112.50"],
    ["Harbor Dental Group", "Unbilled seats · 4 × Premium", "$105.60"],
    ["Bright Path Tutoring", "Ghost licences · offboarded", "$114.00"],
    ["Keystone Logistics", "Stale price · old NCE rate", "$36.00"],
  ];
  return (
    <figure className="st-mock">
      <div className="st-mock-head">
        <span>Leakage found this month</span>
        <strong>$548.10</strong>
        <small>$6,577.20 a year if nothing changes</small>
      </div>
      <table>
        <caption className="sr-only">Exceptions from the demo run</caption>
        <tbody>
          {rows.map(([client, kind, amount]) => (
            <tr key={client}>
              <th scope="row">{client}</th>
              <td>{kind}</td>
              <td>{amount}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <figcaption>Example · demo MSP "Northbeam IT", one Pax8 bill</figcaption>
    </figure>
  );
}

function AuditForm() {
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
      <p className="st-done" role="status">
        You're in. We'll email you within one working day with where to send the
        export.
      </p>
    );
  }

  return (
    <form className="st-form" onSubmit={submit} aria-busy={state === "pending"}>
      <label htmlFor="audit-email">
        Work email
        <input
          id="audit-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@yourmsp.com"
          aria-describedby="audit-email-hint"
        />
      </label>
      <span id="audit-email-hint" className="st-hint">
        Company address only. Gmail, Outlook.com and similar are not accepted.
      </span>
      <label htmlFor="audit-company">
        MSP name
        <input id="audit-company" name="company" maxLength={160} />
      </label>
      <label htmlFor="audit-seats">
        Microsoft seats you resell
        <input id="audit-seats" name="seats" type="number" min={1} />
      </label>
      {error && (
        <p className="st-error" role="alert">
          {error}
        </p>
      )}
      <button className="st-btn" type="submit" disabled={state === "pending"}>
        {state === "pending" && (
          <LoaderCircle className="spin" size={16} aria-hidden="true" />
        )}
        {cta}
      </button>
    </form>
  );
}
