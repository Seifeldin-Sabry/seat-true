import { createFileRoute } from "@tanstack/react-router";
import { livePosts } from "../lib/content/posts.server";
import { sitemapXml } from "../lib/feeds";

// Built per request from the live post list: scheduled posts appear at publishAt, no rebuild.
export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: () =>
        new Response(sitemapXml(livePosts()), {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=300",
          },
        }),
    },
  },
});
