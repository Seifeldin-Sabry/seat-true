import { brand } from "@seattrue/ui";
import { createFileRoute } from "@tanstack/react-router";
import { livePost } from "../lib/content/posts.server";
import { integrationBySlug } from "../lib/integrations";
import { type SitePageKey, sitePages } from "../lib/site";
import { type OgCard, renderOgImage } from "../server/og-image";

/** Rendered PNGs, keyed by path. Inputs are fixed per deploy, so this never goes stale. */
const cache = new Map<string, Uint8Array<ArrayBuffer>>();

function cardFor(path: string): OgCard | null {
  const page = /^page\/([A-Za-z]+)\.png$/.exec(path)?.[1];
  if (page && Object.hasOwn(sitePages, page)) {
    const site = sitePages[page as SitePageKey];
    return {
      eyebrow: site.eyebrow,
      title: site.headline,
      footer: new URL(brand.siteUrl).host,
    };
  }
  const integrationSlug = /^integration\/([a-z0-9-]+)\.png$/.exec(path)?.[1];
  const integration = integrationSlug
    ? integrationBySlug.get(integrationSlug)
    : undefined;
  if (integration) {
    return {
      eyebrow: `Integrations · ${integration.status === "live" ? "Live" : "Coming soon"}`,
      title: integration.name,
      footer: new URL(brand.siteUrl).host,
    };
  }
  const slug = /^blog\/([a-z0-9-]+)\.png$/.exec(path)?.[1];
  // Scheduled posts have no image until they're live, so the title can't leak.
  const post = slug ? livePost(slug)?.post : null;
  if (post) {
    return {
      eyebrow: `Blog · ${post.readingMinutes} min read`,
      title: post.title,
      footer: post.author,
    };
  }
  return null;
}

export const Route = createFileRoute("/og/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const path = params._splat ?? "";
        const card = cardFor(path);
        if (!card) return new Response("Not found", { status: 404 });
        let png = cache.get(path);
        if (!png) {
          png = await renderOgImage(card);
          cache.set(path, png);
        }
        return new Response(png, {
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "public, max-age=86400",
          },
        });
      },
    },
  },
});
