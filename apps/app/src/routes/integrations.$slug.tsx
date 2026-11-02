import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { LoaderCircle } from "lucide-react";
import { type FormEvent, useState } from "react";
import { AuditCta, PageIntro, StatusBadge } from "../components/marketing";
import { SiteShell } from "../components/site-chrome";
import { integrationBySlug, integrationPath } from "../lib/integrations";
import { publicHead } from "../lib/seo";
import { absoluteUrl, sitePages } from "../lib/site";
import { breadcrumbs } from "../lib/structured-data";

export const Route = createFileRoute("/integrations/$slug")({
  loader: ({ params }) => {
    if (!integrationBySlug.has(params.slug)) throw notFound();
  },
  head: ({ params }) => {
    const integration = integrationBySlug.get(params.slug);
    if (!integration) return {};
    const path = integrationPath(integration.slug);
    return publicHead({
      title: integration.title,
      description: integration.description,
      path,
      image: absoluteUrl(`/og/integration/${integration.slug}.png`),
      jsonLd: [
        breadcrumbs([
          { name: "Home", path: "/" },
          { name: "Integrations", path: sitePages.integrations.path },
          { name: integration.name, path },
        ]),
      ],
    });
  },
  component: IntegrationPage,
});

function IntegrationPage() {
  const { slug } = Route.useParams();
  const integration = integrationBySlug.get(slug);
  if (!integration) return null;
  const live = integration.status === "live";
  return (
    <SiteShell>
      <PageIntro eyebrow="Integrations" title={integration.name}>
        <p className="st-int-meta">
          <StatusBadge live={live} />
          {integration.method}
        </p>
        <p>{integration.intro}</p>
      </PageIntro>

      <section className="st-section st-section-tight" aria-labelledby="data">
        <h2 id="data" className="st-h2-small">
          {live ? "Data SeatTrue reads" : "Data it will read"}
        </h2>
        <ul className="st-int-data">
          {integration.data.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      {live ? (
        <section
          className="st-section st-section-tight"
          aria-labelledby="setup"
        >
          <h2 id="setup" className="st-h2-small">
            Setup
          </h2>
          <ol className="st-steps st-steps-4">
            {integration.setup.map((step) => (
              <li key={step.title}>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </section>
      ) : (
        <section
          className="st-section st-section-tight"
          aria-labelledby="meanwhile"
        >
          <h2 id="meanwhile" className="st-h2-small">
            Until it's live
          </h2>
          <p className="st-fair">{integration.meanwhile}</p>
          <NotifyForm slug={integration.slug} name={integration.name} />
        </section>
      )}

      <section className="st-section st-section-tight">
        <p className="st-fair">
          <Link to="/integrations">All integrations</Link>
        </p>
      </section>
      <AuditCta />
    </SiteShell>
  );
}

/** "Notify me when it's live". Stores the sign-up; no email is sent yet. */
function NotifyForm({ slug, name }: { slug: string; name: string }) {
  const [state, setState] = useState<"idle" | "pending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const company = String(form.get("company") ?? "").trim();
    setError(null);
    setState("pending");
    try {
      // Loaded on submit: the API client isn't needed for first paint.
      const { joinIntegrationWaitlist } = await import("../lib/recon-api");
      await joinIntegrationWaitlist({
        slug,
        email,
        ...(company ? { company } : {}),
      });
      setState("done");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Something went wrong.",
      );
      setState("idle");
    }
  }

  if (state === "done")
    return (
      <p className="st-done" role="status">
        Thanks. You're on the list for {name}.
      </p>
    );

  return (
    <form
      className="st-form st-notify"
      onSubmit={submit}
      aria-busy={state === "pending"}
      aria-label={`Notify me when ${name} is live`}
    >
      <label htmlFor="notify-email">
        Work email
        <input
          id="notify-email"
          name="email"
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          placeholder="you@yourmsp.com"
        />
      </label>
      <label htmlFor="notify-company">
        Company (optional)
        <input id="notify-company" name="company" maxLength={160} />
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
        Notify me when it's live
      </button>
    </form>
  );
}
