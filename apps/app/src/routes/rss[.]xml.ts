import { createFileRoute } from "@tanstack/react-router";
import { livePosts } from "../lib/content/posts.server";
import { rssXml } from "../lib/feeds";

// Built per request from the live post list: scheduled posts appear at publishAt, no rebuild.
export const Route = createFileRoute("/rss.xml")({
  server: {
    handlers: {
      GET: () =>
        new Response(rssXml(livePosts()), {
          headers: {
            "Content-Type": "application/rss+xml; charset=utf-8",
            "Cache-Control": "public, max-age=300",
          },
        }),
    },
  },
});
