import { createFileRoute } from "@tanstack/react-router";
import { livePosts } from "../lib/content/posts.server";
import { llmsTxt } from "../lib/feeds";

// Built per request from the live post list: scheduled posts appear at publishAt, no rebuild.
export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET: () =>
        new Response(llmsTxt(livePosts()), {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=300",
          },
        }),
    },
  },
});
