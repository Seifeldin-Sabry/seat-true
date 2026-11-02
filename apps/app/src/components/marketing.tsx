import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { glossary } from "../lib/content/glossary";
import { publicHead } from "../lib/seo";
import { pageOgImage, type SitePageKey, sitePages } from "../lib/site";
import { breadcrumbs } from "../lib/structured-data";

/** Head for a registered marketing page plus its breadcrumb trail. */
export function sitePageHead(
  key: SitePageKey,
  trail: { name: string; path: string }[],
  jsonLd: Record<string, unknown>[] = [],
) {
  const page = sitePages[key];
  return publicHead({
    ...page,
    image: pageOgImage(key),
    jsonLd: [...jsonLd, breadcrumbs([{ name: "Home", path: "/" }, ...trail])],
  });
}

export function PageIntro({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="st-section st-page-head" aria-labelledby="page-title">
      <p className="st-eyebrow">{eyebrow}</p>
      <h1 id="page-title">{title}</h1>
      <div className="st-lede">{children}</div>
    </section>
  );
}

export function AuditCta({ title = "See last month's leak in dollars" }) {
  return (
    <section className="st-section">
      <div className="st-article-cta st-cta-band">
        <h2>{title}</h2>
        <p>
          Upload one Pax8 export. We map customers with you and send back every
          exception with a monthly dollar figure. Free, before you decide
          anything.
        </p>
        <a className="st-btn" href="/#audit">
          Get my free margin audit <ArrowRight size={18} aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}

export type Source = { label: string; href: string; note?: string };

export function Sources({ sources }: { sources: Source[] }) {
  return (
    <section className="st-section st-section-tight" aria-labelledby="sources">
      <h2 id="sources" className="st-h2-small">
        Sources
      </h2>
      <ol className="st-sources">
        {sources.map((source) => (
          <li key={source.href}>
            <a href={source.href} rel="noopener">
              {source.label}
            </a>
            {source.note && <span> · {source.note}</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Internal link mesh: live posts, glossary terms, compare and for-pages. */
export function FurtherReading({
  posts,
  livePosts,
  terms,
  pages,
}: {
  posts: string[];
  livePosts: { slug: string; title: string }[];
  terms: string[];
  pages: SitePageKey[];
}) {
  const live = livePosts.filter((post) => posts.includes(post.slug));
  const entries = glossary.filter((entry) => terms.includes(entry.slug));
  return (
    <section
      className="st-section st-section-tight"
      aria-labelledby="further-reading"
    >
      <h2 id="further-reading" className="st-h2-small">
        Further reading
      </h2>
      <ul className="st-related">
        {pages.map((key) => (
          <li key={key}>
            <a href={sitePages[key].path}>{sitePages[key].headline}</a>
          </li>
        ))}
        {live.map((post) => (
          <li key={post.slug}>
            <Link to="/blog/$slug" params={{ slug: post.slug }}>
              {post.title}
            </Link>
          </li>
        ))}
      </ul>
      {entries.length > 0 && (
        <ul className="st-chips st-chips-spaced">
          {entries.map((entry) => (
            <li key={entry.slug}>
              <Link to="/glossary" hash={entry.slug}>
                {entry.term}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
