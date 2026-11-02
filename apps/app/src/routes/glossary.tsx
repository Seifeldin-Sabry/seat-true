import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { SiteShell } from "../components/site-chrome";
import { glossary } from "../lib/content/glossary";
import { livePosts } from "../lib/content/posts.server";
import { publicHead } from "../lib/seo";
import { pageOgImage, sitePages } from "../lib/site";
import { breadcrumbs, definedTermSet } from "../lib/structured-data";

const page = sitePages.glossary;

/** Which explainer posts are live right now (scheduled ones aren't linked yet). */
const getLiveSlugs = createServerFn({ method: "GET" }).handler(() =>
  livePosts().map((post) => ({ slug: post.slug, title: post.title })),
);

export const Route = createFileRoute("/glossary")({
  loader: () => getLiveSlugs(),
  head: () =>
    publicHead({
      ...page,
      image: pageOgImage("glossary"),
      jsonLd: [
        definedTermSet(glossary),
        breadcrumbs([
          { name: "Home", path: "/" },
          { name: "Glossary", path: "/glossary" },
        ]),
      ],
    }),
  component: GlossaryPage,
});

function GlossaryPage() {
  const live = new Map(Route.useLoaderData().map((p) => [p.slug, p.title]));
  return (
    <SiteShell>
      <section
        className="st-section st-page-head"
        aria-labelledby="glossary-title"
      >
        <p className="st-eyebrow">Glossary</p>
        <h1 id="glossary-title">Microsoft 365 billing terms, defined</h1>
        <p className="st-lede">
          The words MSPs use when the Pax8 bill and the client invoice don't
          agree. Short definitions first, detail underneath.
        </p>
      </section>
      <section className="st-section st-section-tight" aria-label="Terms">
        <div className="st-terms">
          {glossary.map((entry) => {
            const reading = entry.posts.filter((slug) => live.has(slug));
            return (
              <section
                key={entry.slug}
                id={entry.slug}
                className="st-term"
                aria-labelledby={`${entry.slug}-term`}
              >
                <h2 id={`${entry.slug}-term`}>{entry.term}</h2>
                <div>
                  <p className="st-term-definition">{entry.definition}</p>
                  <p>{entry.detail}</p>
                  {reading.length > 0 && (
                    <p className="st-term-more">
                      Read more:{" "}
                      {reading.map((slug, index) => (
                        <span key={slug}>
                          {index > 0 && " · "}
                          <Link to="/blog/$slug" params={{ slug }}>
                            {live.get(slug)}
                          </Link>
                        </span>
                      ))}
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </section>
    </SiteShell>
  );
}
