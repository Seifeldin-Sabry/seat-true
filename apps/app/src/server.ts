import handler, { createServerEntry } from "@tanstack/react-start/server-entry";

const compressible = /^(text\/|application\/(xml|rss\+xml|json))/;

/** Gzip HTML, feeds and JSON on the fly; static assets are pre-compressed by Nitro. */
function gzipped(request: Request, response: Response): Response {
  const type = response.headers.get("content-type") ?? "";
  if (
    !response.body ||
    response.headers.has("content-encoding") ||
    !compressible.test(type) ||
    type.startsWith("text/event-stream") ||
    !/\bgzip\b/.test(request.headers.get("accept-encoding") ?? "")
  ) {
    return response;
  }
  const headers = new Headers(response.headers);
  headers.set("content-encoding", "gzip");
  headers.delete("content-length");
  headers.append("vary", "accept-encoding");
  return new Response(
    response.body.pipeThrough(new CompressionStream("gzip")),
    {
      status: response.status,
      statusText: response.statusText,
      headers,
    },
  );
}

export default createServerEntry({
  async fetch(request, opts) {
    return gzipped(request, await handler.fetch(request, opts));
  },
});
