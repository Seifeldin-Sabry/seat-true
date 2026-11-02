import { LoaderCircle } from "lucide-react";
import { type FormEvent, useId, useState } from "react";

const clientCounts = ["1-25", "26-75", "76-150", "150+"] as const;
const distributors = [
  "Pax8",
  "Microsoft Partner Center",
  "Giacom",
  "Sherweb",
  "Other",
] as const;
const psas = ["ConnectWise", "Autotask", "HaloPSA", "Other", "None"] as const;

function Choice({
  id,
  name,
  label,
  options,
}: {
  id: string;
  name: string;
  label: string;
  options: readonly string[];
}) {
  return (
    <label htmlFor={id}>
      {label}
      <select id={id} name={name} required defaultValue="">
        <option value="" disabled>
          Choose one
        </option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option.replace("-", "–")}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Free margin audit request. Stored for SeatTrue staff; no email is sent. */
export function AuditForm({ cta }: { cta: string }) {
  const id = useId();
  const [state, setState] = useState<"idle" | "pending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const field = (name: string) => String(form.get(name) ?? "").trim();
    setError(null);
    setState("pending");
    try {
      // Loaded on submit: the API client isn't needed for first paint.
      const { requestAudit } = await import("../lib/recon-api");
      await requestAudit({
        email: field("email"),
        company: field("company"),
        clients: field("clients"),
        distributor: field("distributor"),
        psa: field("psa"),
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
        You're in. We'll email you within one business day with where to send
        the export.
      </p>
    );
  }

  return (
    <form className="st-form" onSubmit={submit} aria-busy={state === "pending"}>
      <label htmlFor={`${id}-email`}>
        Work email
        <input
          id={`${id}-email`}
          name="email"
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          placeholder="you@yourmsp.com"
          aria-describedby={`${id}-email-hint`}
        />
      </label>
      <span id={`${id}-email-hint`} className="st-hint">
        Company address only. Gmail, Outlook.com and similar are not accepted.
      </span>
      <label htmlFor={`${id}-company`}>
        MSP name
        <input
          id={`${id}-company`}
          name="company"
          required
          maxLength={160}
          autoComplete="organization"
        />
      </label>
      <Choice
        id={`${id}-clients`}
        name="clients"
        label="Number of clients"
        options={clientCounts}
      />
      <Choice
        id={`${id}-distributor`}
        name="distributor"
        label="Distributor"
        options={distributors}
      />
      <Choice id={`${id}-psa`} name="psa" label="PSA" options={psas} />
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
