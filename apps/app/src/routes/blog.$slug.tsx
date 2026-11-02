import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { SiteShell } from "../components/site-chrome";
import { getBlogPost } from "../lib/content/blog-fns";
import { formatPostDate } from "../lib/format-date";
import { publicHead } from "../lib/seo";
import { pagesForPost, postOgImage, sitePages } from "../lib/site";
import { article, breadcrumbs, faqPage } from "../lib/structured-data";

export const Route = createFileRoute("/blog/$slug")({
  // The server decides visibility per request: a scheduled post is a 404.
  loader: ({ params }) => getBlogPost({ data: params.slug }),
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const { post } = loaderData;
    const path = `/blog/${post.slug}`;
    const image = postOgImage(post.slug);
    return publicHead({
      title: post.title,
      description: post.description,
      path,
      image,
      type: "article",
      article: {
        publishedTime: post.publishAt,
        modifiedTime: post.updatedAt,
        tags: post.tags,
      },
      jsonLd: [
        article(post, image),
        breadcrumbs([
          { name: "Home", path: "/" },
          { name: "Blog", path: "/blog" },
          { name: post.title, path },
        ]),
        faqPage(post.faq),
      ],
    });
  },
  component: PostPage,
});

function PostPage() {
  const { post, related, glossary } = Route.useLoaderData();
  const updated = post.updatedAt !== post.publishAt;
  return (
    <SiteShell>
      <article className="st-article" aria-labelledby="post-title">
        <nav className="st-crumbs" aria-label="Breadcrumb">
          <ol>
            <li>
              <Link to="/">Home</Link>
            </li>
            <li>
              <Link to="/blog">Blog</Link>
            </li>
            <li aria-current="page">{post.title}</li>
          </ol>
        </nav>
        <header className="st-article-head">
          <h1 id="post-title">{post.title}</h1>
          <p className="st-post-meta">
            By {post.author} ·{" "}
            <time dateTime={post.publishAt}>
              {formatPostDate(post.publishAt)}
            </time>
            {updated && (
              <>
                {" "}
                · Updated{" "}
                <time dateTime={post.updatedAt}>
                  {formatPostDate(post.updatedAt)}
                </time>
              </>
            )}{" "}
            · {post.readingMinutes} min read
          </p>
        </header>
        <div
          className="st-prose"
          // Trusted: markdown committed to this repo, rendered on the server.
          // biome-ignore lint/security/noDangerouslySetInnerHtml: see above
          dangerouslySetInnerHTML={{ __html: post.html }}
        />

        <aside className="st-article-cta" aria-labelledby="post-cta">
          <h2 id="post-cta">Check last month's Pax8 bill</h2>
          <p>
            Upload one export and see unbilled seats, stale prices and ghost
            licences in dollars. Free, before you decide anything.
          </p>
          <a className="st-btn" href="/audit">
            Get my free margin audit <ArrowRight size={18} aria-hidden="true" />
          </a>
        </aside>

        {glossary.length > 0 && (
          <section className="st-article-aside" aria-labelledby="post-terms">
            <h2 id="post-terms">Terms in this article</h2>
            <ul className="st-chips">
              {glossary.map((entry) => (
                <li key={entry.slug}>
                  <Link to="/glossary" hash={entry.slug}>
                    {entry.term}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="st-article-aside" aria-labelledby="post-product">
          <h2 id="post-product">SeatTrue for your setup</h2>
          <ul className="st-related">
            {pagesForPost(post.slug).map((key) => (
              <li key={key}>
                <a href={sitePages[key].path}>{sitePages[key].headline}</a>
              </li>
            ))}
          </ul>
        </section>

        {related.length > 0 && (
          <section className="st-article-aside" aria-labelledby="post-related">
            <h2 id="post-related">Related articles</h2>
            <ul className="st-related">
              {related.map((other) => (
                <li key={other.slug}>
                  <Link to="/blog/$slug" params={{ slug: other.slug }}>
                    {other.title}
                  </Link>
                  <span>{other.readingMinutes} min read</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>
    </SiteShell>
  );
}
