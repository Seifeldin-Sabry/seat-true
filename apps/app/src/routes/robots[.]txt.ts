import { createFileRoute } from "@tanstack/react-router";
import { robotsTxt } from "../lib/feeds";

// Built per request from the live post list: scheduled posts appear at publishAt, no rebuild.
export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: () =>
        new Response(robotsTxt(), {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=300",
          },
        }),
    },
  },
});
