import { Button, brand, Input, Label } from "@seattrue/ui";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check, Layers3, LoaderCircle } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { joinWaitlist } from "../lib/recon-api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: `${brand.name} · Find the license leak before the invoice goes out`,
      },
    ],
  }),
  component: LandingPage,
});

const leaks = [
  {
    label: "Stale price",
    body: "Microsoft's 2026 increase lands at each renewal. The PSA keeps billing last year's price, one client at a time.",
  },
  {
    label: "Unbilled seats",
    body: "Seats added mid-month show up on the Pax8 bill and never make it onto the client agreement.",
  },
  {
    label: "Ghost licences",
    body: "A client leaves, the licences keep running, and you keep paying for them.",
  },
];

const steps = [
  "Upload last month's Pax8 export, or connect Pax8 later.",
  "Map each Pax8 customer to a PSA client once.",
  "Every line is checked: quantity, and price against cost × that client's markup.",
  "Work the exceptions inbox before invoicing: approve, fix, or mark billed.",
];

const comparison: [string, string][] = [
  ["Syncs quantities", "Yes"],
  ["Checks price against cost × agreed markup", "No"],
  ["Catches renewals that missed a price rise", "No"],
  ["Flags licences for offboarded clients", "Sometimes"],
  ["Sign-off before the invoice goes out", "No"],
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
          <a href="#audit">Free audit</a>
          <Link to="/login" search={{ redirect: "/app" }}>
            Sign in
          </Link>
        </nav>
      </header>

      <main>
        <section className="lp-hero" aria-labelledby="lp-title">
          <p className="lp-kicker">For MSPs reselling Microsoft 365</p>
          <h1 id="lp-title">
            Find the license leak before the invoice goes out.
          </h1>
          <p className="lp-lede">
            Your Pax8 sync copies quantities. It never checks the price.{" "}
            {brand.name} matches every Microsoft line to the right client,
            contract and markup, and shows you only what's wrong, in dollars.
          </p>
          <div className="lp-actions">
            <a className="lp-primary" href="#audit">
              Get a free reconciliation run
              <ArrowRight size={18} aria-hidden="true" />
            </a>
            <Link
              className="lp-secondary"
              to="/signup"
              search={{ redirect: "/app" }}
            >
              Try the demo
            </Link>
          </div>
          <dl className="lp-proof">
            <div>
              <dt>Setup</dt>
              <dd>Under 30 minutes, from a CSV</dd>
            </div>
            <div>
              <dt>Checks</dt>
              <dd>Quantity and price × markup</dd>
            </div>
            <div>
              <dt>Integration needed</dt>
              <dd>None to start</dd>
            </div>
          </dl>
        </section>

        <section className="lp-section" aria-labelledby="lp-leaks">
          <h2 id="lp-leaks">Three leaks your PSA sync can't see</h2>
          <ul className="lp-cards">
            {leaks.map((leak) => (
              <li key={leak.label}>
                <h3>{leak.label}</h3>
                <p>{leak.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section id="how" className="lp-section" aria-labelledby="lp-how">
          <h2 id="lp-how">How it works</h2>
          <ol className="lp-steps">
            {steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>

        <section className="lp-section" aria-labelledby="lp-compare">
          <h2 id="lp-compare">A margin gate, not another sync</h2>
          <div className="lp-table-wrap">
            <table className="lp-table">
              <thead>
                <tr>
                  <th scope="col">Check</th>
                  <th scope="col">Native Pax8 → PSA sync</th>
                  <th scope="col">{brand.name}</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map(([check, native]) => (
                  <tr key={check}>
                    <th scope="row">{check}</th>
                    <td>{native}</td>
                    <td>
                      <Check size={16} aria-label="Yes" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="audit" className="lp-audit" aria-labelledby="lp-audit">
          <div>
            <h2 id="lp-audit">Free reconciliation run</h2>
            <p>
              Send last month's Pax8 export and we'll return your margin
              exceptions with a monthly dollar figure. If it finds nothing,
              you've lost 15 minutes.
            </p>
          </div>
          <WaitlistForm />
        </section>
      </main>

      <footer className="lp-footer">
        <span>© {brand.name}</span>
        <Link to="/login" search={{ redirect: "/app" }}>
          Sign in
        </Link>
      </footer>
    </div>
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
        You're on the list. We'll email you to arrange the free run.
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
        />
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
        Request my free run
      </Button>
    </form>
  );
}
