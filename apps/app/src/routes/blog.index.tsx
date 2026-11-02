import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell } from "../components/site-chrome";
import { getBlogIndex } from "../lib/content/blog-fns";
import { formatPostDate } from "../lib/format-date";
import { publicHead } from "../lib/seo";
import { pageOgImage, sitePages } from "../lib/site";
import { breadcrumbs } from "../lib/structured-data";

const page = sitePages.blog;

export const Route = createFileRoute("/blog/")({
  loader: () => getBlogIndex(),
  head: () =>
    publicHead({
      ...page,
      image: pageOgImage("blog"),
      jsonLd: [
        breadcrumbs([
          { name: "Home", path: "/" },
          { name: "Blog", path: "/blog" },
        ]),
      ],
    }),
  component: BlogIndexPage,
});

function BlogIndexPage() {
  const { posts, nextPublishAt } = Route.useLoaderData();
  return (
    <SiteShell>
      <section className="st-section st-page-head" aria-labelledby="blog-title">
        <p className="st-eyebrow">Blog</p>
        <h1 id="blog-title">Microsoft 365 billing, reconciled</h1>
        <p className="st-lede">
          How MSPs reconcile the Pax8 bill, manage NCE seats and keep Microsoft
          365 margin intact. Checklists, definitions and fair comparisons.
        </p>
      </section>
      <section className="st-section st-section-tight" aria-label="Articles">
        {posts.length === 0 ? (
          <div className="st-empty">
            <h2>First articles are on their way</h2>
            <p>
              {nextPublishAt
                ? `The first article goes live on ${formatPostDate(nextPublishAt)}. `
                : ""}
              Subscribe to the <a href="/rss.xml">RSS feed</a> or read the{" "}
              <Link to="/glossary">glossary</Link> meanwhile.
            </p>
          </div>
        ) : (
          <ol className="st-post-list">
            {posts.map((post) => (
              <li key={post.slug}>
                <article>
                  <p className="st-post-meta">
                    <time dateTime={post.publishAt}>
                      {formatPostDate(post.publishAt)}
                    </time>{" "}
                    · {post.readingMinutes} min read
                  </p>
                  <h2>
                    <Link to="/blog/$slug" params={{ slug: post.slug }}>
                      {post.title}
                    </Link>
                  </h2>
                  <p>{post.description}</p>
                </article>
              </li>
            ))}
          </ol>
        )}
      </section>
    </SiteShell>
  );
}
