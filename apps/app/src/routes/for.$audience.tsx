import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  AuditCta,
  FurtherReading,
  PageIntro,
  Sources,
  sitePageHead,
} from "../components/marketing";
import { SiteShell } from "../components/site-chrome";
import { audiences } from "../lib/audiences";
import { getLivePostLinks } from "../lib/content/blog-fns";
import { sitePages } from "../lib/site";
import { faqPage } from "../lib/structured-data";

export const Route = createFileRoute("/for/$audience")({
  loader: async ({ params }) => {
    if (!audiences[params.audience]) throw notFound();
    return { livePosts: await getLivePostLinks() };
  },
  head: ({ params }) => {
    const audience = audiences[params.audience];
    if (!audience) return {};
    const page = sitePages[audience.key];
    return sitePageHead(
      audience.key,
      [{ name: page.eyebrow, path: page.path }],
      [faqPage(audience.faq)],
    );
  },
  component: AudiencePage,
});

function AudiencePage() {
  const { audience: slug } = Route.useParams();
  const { livePosts } = Route.useLoaderData();
  const audience = audiences[slug];
  if (!audience) return null;
  return (
    <SiteShell>
      <PageIntro eyebrow={audience.eyebrow} title={audience.title}>
        <p>{audience.intro}</p>
        <p>
          <a className="st-btn" href="/audit">
            Get my free margin audit
          </a>
        </p>
      </PageIntro>

      <section className="st-section st-section-tight" aria-labelledby="leaks">
        <h2 id="leaks" className="st-h2-small">
          {audience.problemsTitle}
        </h2>
        <div className="st-leaks">
          {audience.problems.map((problem) => (
            <article key={problem.title}>
              <h3>{problem.title}</h3>
              <p>{problem.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="st-section st-section-tight" aria-labelledby="how">
        <h2 id="how" className="st-h2-small">
          {audience.stepsTitle}
        </h2>
        <ol className="st-steps">
          {audience.steps.map((step) => (
            <li key={step.title}>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>
        <p className="st-fair">
          <strong>Works with your existing tools.</strong> Bring the distributor
          bill as a CSV export; nothing to install and nothing written back.{" "}
          <Link to="/integrations">See integrations</Link>.
        </p>
      </section>

      <section className="st-section st-section-tight" aria-labelledby="faq">
        <h2 id="faq" className="st-h2-small">
          Questions
        </h2>
        <div className="st-faq">
          {audience.faq.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <Sources sources={audience.sources} />
      <FurtherReading
        pages={audience.pages}
        posts={audience.posts}
        livePosts={livePosts}
        terms={audience.terms}
      />
      <AuditCta />
    </SiteShell>
  );
}
