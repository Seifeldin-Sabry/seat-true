import { createFileRoute, notFound } from "@tanstack/react-router";
import {
  AuditCta,
  FurtherReading,
  PageIntro,
  Sources,
  sitePageHead,
} from "../components/marketing";
import { SiteShell } from "../components/site-chrome";
import { comparisons } from "../lib/compare";
import { getLivePostLinks } from "../lib/content/blog-fns";
import { sitePages } from "../lib/site";

export const Route = createFileRoute("/compare/$competitor")({
  loader: async ({ params }) => {
    const comparison = comparisons[params.competitor];
    if (!comparison) throw notFound();
    return { livePosts: await getLivePostLinks() };
  },
  head: ({ params }) => {
    const comparison = comparisons[params.competitor];
    if (!comparison) return {};
    return sitePageHead(comparison.key, [
      { name: "Compare", path: sitePages[comparison.key].path },
    ]);
  },
  component: ComparePage,
});

function ComparePage() {
  const { competitor } = Route.useParams();
  const { livePosts } = Route.useLoaderData();
  const comparison = comparisons[competitor];
  if (!comparison) return null;
  return (
    <SiteShell>
      <PageIntro eyebrow="Compare" title={comparison.title}>
        <p>{comparison.intro}</p>
      </PageIntro>

      <section className="st-section st-section-tight" aria-label="Which fits">
        <div className="st-choose">
          <div>
            <h2>Choose {comparison.name} if</h2>
            <ul>
              {comparison.chooseThem.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div>
            <h2>Choose SeatTrue if</h2>
            <ul>
              {comparison.chooseUs.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section
        className="st-section st-section-tight"
        aria-labelledby="side-by-side"
      >
        <h2 id="side-by-side" className="st-h2-small">
          Side by side
        </h2>
        <div className="st-table-wrap">
          <table className="st-compare st-compare-two">
            <thead>
              <tr>
                <th scope="col">
                  <span className="sr-only">Check</span>
                </th>
                <th scope="col">{comparison.name}</th>
                <th scope="col" className="st-ours">
                  SeatTrue
                </th>
              </tr>
            </thead>
            <tbody>
              {comparison.rows.map((row) => (
                <tr key={row.check}>
                  <th scope="row">{row.check}</th>
                  <td>{row.them}</td>
                  <td className="st-ours">{row.us}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="st-fair">
          <strong>Where {comparison.name} is stronger.</strong>{" "}
          {comparison.theirStrengths}
        </p>
      </section>

      <Sources sources={comparison.sources} />
      <FurtherReading
        pages={comparison.pages}
        posts={comparison.posts}
        livePosts={livePosts}
        terms={comparison.terms}
      />
      <AuditCta />
    </SiteShell>
  );
}
