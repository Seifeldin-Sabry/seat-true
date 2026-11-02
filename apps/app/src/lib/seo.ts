import { brand } from "@seattrue/ui";
import { absoluteUrl } from "./site";
import { jsonLdScript } from "./structured-data";

/** Head for signed-in and account pages: titled, never indexed. */
export function privateHead(title: string) {
  return {
    meta: [
      { title: `${title} · ${brand.name}` },
      { name: "robots", content: "noindex, nofollow" },
    ],
  };
}

type PublicHead = {
  title: string;
  description: string;
  path: string;
  image: string;
  type?: "website" | "article";
  jsonLd?: Record<string, unknown>[];
  article?: { publishedTime: string; modifiedTime: string; tags: string[] };
};

/** Server-rendered meta for an indexable page: canonical, OG, Twitter, JSON-LD. */
export function publicHead(page: PublicHead) {
  const url = absoluteUrl(page.path);
  const meta: Record<string, string>[] = [
    { title: page.title },
    { name: "description", content: page.description },
    { name: "robots", content: "index, follow, max-image-preview:large" },
    { property: "og:site_name", content: brand.name },
    { property: "og:type", content: page.type ?? "website" },
    { property: "og:title", content: page.title },
    { property: "og:description", content: page.description },
    { property: "og:url", content: url },
    { property: "og:image", content: page.image },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: page.title },
    { property: "og:locale", content: "en_US" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: page.title },
    { name: "twitter:description", content: page.description },
    { name: "twitter:image", content: page.image },
  ];
  if (page.article) {
    meta.push(
      {
        property: "article:published_time",
        content: page.article.publishedTime,
      },
      { property: "article:modified_time", content: page.article.modifiedTime },
      ...page.article.tags.map((tag) => ({
        property: "article:tag",
        content: tag,
      })),
    );
  }
  return {
    meta,
    links: [
      { rel: "canonical", href: url },
      {
        rel: "alternate",
        type: "application/rss+xml",
        title: `${brand.name} blog`,
        href: absoluteUrl("/rss.xml"),
      },
    ],
    scripts: (page.jsonLd ?? []).map(jsonLdScript),
  };
}
