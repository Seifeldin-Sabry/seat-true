import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AuditCta,
  PageIntro,
  StatusBadge,
  sitePageHead,
} from "../components/marketing";
import { SiteShell } from "../components/site-chrome";
import {
  integrationCategories,
  integrationPath,
  integrations,
} from "../lib/integrations";
import { sitePages } from "../lib/site";
import { itemList } from "../lib/structured-data";

const page = sitePages.integrations;

export const Route = createFileRoute("/integrations/")({
  head: () =>
    sitePageHead(
      "integrations",
      [{ name: "Integrations", path: page.path }],
      [
        itemList(
          "SeatTrue integrations",
          integrations.map((integration) => ({
            name: integration.name,
            path: integrationPath(integration.slug),
            description: `${integration.status === "live" ? "Live" : "Coming soon"} · ${integration.method}. ${integration.pulls}`,
          })),
        ),
      ],
    ),
  component: IntegrationsPage,
});

function IntegrationsPage() {
  return (
    <SiteShell>
      <PageIntro eyebrow="Integrations" title={page.headline}>
        <p>
          SeatTrue reads the distributor bill and checks it against what you
          invoice. Live means it ships and is tested today. Everything else is
          marked coming soon.
        </p>
      </PageIntro>

      <section
        className="st-section st-section-tight"
        aria-label="All integrations"
      >
        {integrationCategories.map((category) => (
          <section
            key={category.id}
            className="st-int-group"
            aria-labelledby={`cat-${category.id}`}
          >
            <h2 id={`cat-${category.id}`} className="st-h2-small">
              {category.label}
            </h2>
            <ul className="st-int-grid">
              {integrations
                .filter((integration) => integration.category === category.id)
                .map((integration) => (
                  <li key={integration.slug} className="st-int-card">
                    <h3>
                      <Link
                        to="/integrations/$slug"
                        params={{ slug: integration.slug }}
                      >
                        {integration.name}
                      </Link>
                    </h3>
                    <p className="st-int-meta">
                      <StatusBadge live={integration.status === "live"} />
                      {integration.method}
                    </p>
                    <p className="st-int-pulls">{integration.pulls}</p>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </section>
      <AuditCta />
    </SiteShell>
  );
}
