import { brand } from "@seattrue/ui";
import type { Post, PostMeta } from "./content/blog";
import { glossary } from "./content/glossary";
import { absoluteUrl, plans, refundPolicy, sitePages } from "./site";

/**
 * sitemap.xml, rss.xml, llms.txt and llms-full.txt. Pure: callers pass the
 * posts that are live at request time, so scheduled posts never appear.
 */

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function latest(dates: string[], fallback: string): string {
  return dates.reduce((max, date) => (date > max ? date : max), fallback);
}

export function sitemapXml(posts: PostMeta[]): string {
  const newestPost = latest(
    posts.map((post) => post.updatedAt),
    sitePages.blog.updatedAt,
  );
  const entries = [
    ...Object.values(sitePages).map((page) => ({
      loc: absoluteUrl(page.path),
      lastmod: page.path === "/blog" ? newestPost : page.updatedAt,
    })),
    ...posts.map((post) => ({
      loc: absoluteUrl(`/blog/${post.slug}`),
      lastmod: post.updatedAt,
    })),
  ];
  const urls = entries
    .map(
      (entry) =>
        `  <url>\n    <loc>${xmlEscape(entry.loc)}</loc>\n    <lastmod>${entry.lastmod.slice(0, 10)}</lastmod>\n  </url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function rssXml(posts: PostMeta[]): string {
  const items = posts
    .map((post) => {
      const url = absoluteUrl(`/blog/${post.slug}`);
      return [
        "    <item>",
        `      <title>${xmlEscape(post.title)}</title>`,
        `      <link>${xmlEscape(url)}</link>`,
        `      <guid isPermaLink="true">${xmlEscape(url)}</guid>`,
        `      <description>${xmlEscape(post.description)}</description>`,
        `      <pubDate>${new Date(post.publishAt).toUTCString()}</pubDate>`,
        ...post.tags.map(
          (tag) => `      <category>${xmlEscape(tag)}</category>`,
        ),
        "    </item>",
      ].join("\n");
    })
    .join("\n");
  const lastBuild = posts[0]
    ? new Date(
        latest(
          posts.map((post) => post.updatedAt),
          posts[0].updatedAt,
        ),
      )
    : null;
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xmlEscape(`${brand.name} blog`)}</title>
    <link>${xmlEscape(absoluteUrl("/blog"))}</link>
    <atom:link href="${xmlEscape(absoluteUrl("/rss.xml"))}" rel="self" type="application/rss+xml"/>
    <description>${xmlEscape(sitePages.blog.description)}</description>
    <language>en</language>
${lastBuild ? `    <lastBuildDate>${lastBuild.toUTCString()}</lastBuildDate>\n` : ""}${items}
  </channel>
</rss>
`;
}

const productFacts = `## What it is

${brand.name} is Microsoft 365 license reconciliation for MSPs. Each month it checks every Microsoft line on the distributor bill (Pax8 today; Partner Center reconciliation files also work) against what the MSP invoices each client, on quantity and on price: distributor cost × the markup agreed with that client.

It raises five kinds of exception, each with a monthly dollar figure: unbilled seats, stale price or markup, ghost licences (clients you've offboarded), overbilling, and unmapped distributor customers. The team approves, marks billed or dismisses each one in an exceptions inbox before invoices go out, with an audit log of who decided what.

## Who it's for

MSPs that resell Microsoft 365 through Pax8 and bill clients from a PSA such as HaloPSA, ConnectWise or Autotask. Roles: owners, admins (ops/finance) and technicians.

## How it works today

- Input: CSV exports of the distributor bill and PSA agreement lines. No API access needed; it never writes to Pax8 or the PSA.
- A Pax8 API connection and HaloPSA sync are planned, not live.
- Sign-in requires a company email address.

## Pricing

${plans.map((plan) => `- ${plan.name}: $${plan.priceUsd}/month flat. ${plan.summary}.`).join("\n")}
- Free margin audit first, on one month's export.
- ${refundPolicy}

## How it differs

- Native Pax8-to-PSA syncs keep seat quantities in step; their documentation doesn't describe checking price or markup. ${brand.name} checks both.
- Gradient MSP covers more distributors, vendors and PSAs. ${brand.name} is narrower (Microsoft lines), checks price against each client's markup, and costs a flat $149 or $249 a month.
- A spreadsheet works if someone rebuilds it every month; ${brand.name} keeps the mappings and markups and shows only the exceptions.

## Links

- Home: ${absoluteUrl("/")}
- Pricing: ${absoluteUrl("/pricing")}
- Compare with Gradient: ${absoluteUrl("/compare/gradient")}
- Compare with a Pax8-to-PSA sync: ${absoluteUrl("/compare/pax8-psa-sync")}
- Compare with a spreadsheet: ${absoluteUrl("/compare/spreadsheet")}
- For Pax8 MSPs: ${absoluteUrl("/for/pax8-msps")}
- For HaloPSA MSPs: ${absoluteUrl("/for/halopsa-msps")}
- Glossary: ${absoluteUrl("/glossary")}
- Blog RSS: ${absoluteUrl("/rss.xml")}
`;

export function llmsTxt(posts: PostMeta[]): string {
  const postLines = posts.length
    ? posts
        .map(
          (post) =>
            `- [${post.title}](${absoluteUrl(`/blog/${post.slug}`)}): ${post.description}`,
        )
        .join("\n")
    : "- No articles published yet.";
  return `# ${brand.name}

> ${sitePages.home.description}

${productFacts}
## Articles

${postLines}

## Glossary

${glossary.map((entry) => `- [${entry.term}](${absoluteUrl(`/glossary#${entry.slug}`)}): ${entry.definition}`).join("\n")}

Full text of every published article: ${absoluteUrl("/llms-full.txt")}
`;
}

export function llmsFullTxt(posts: Post[]): string {
  const articles = posts
    .map(
      (post) =>
        `## ${post.title}\n\nURL: ${absoluteUrl(`/blog/${post.slug}`)}\nPublished: ${post.publishAt.slice(0, 10)} · Updated: ${post.updatedAt.slice(0, 10)}\n\n${post.markdown}`,
    )
    .join("\n\n---\n\n");
  return `# ${brand.name}: full text

${productFacts}
# Articles

${articles || "No articles published yet."}
`;
}

export function robotsTxt(): string {
  const aiCrawlers = [
    "GPTBot",
    "ClaudeBot",
    "PerplexityBot",
    "Google-Extended",
  ];
  return `${aiCrawlers.map((bot) => `User-agent: ${bot}\nAllow: /\nDisallow: /app\nDisallow: /api\n`).join("\n")}
User-agent: *
Allow: /
Disallow: /app
Disallow: /api

Sitemap: ${absoluteUrl("/sitemap.xml")}
`;
}
