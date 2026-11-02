import { createFileRoute } from "@tanstack/react-router";

// Elysia owns everything under /api (routes, Better Auth, Stripe and QStash
// webhooks). The Request goes through untouched so signed raw bodies verify.
async function forwardToApi({ request }: { request: Request }) {
  const { getServerApi } = await import("../server/api");
  return getServerApi().app.fetch(request);
}

export const Route = createFileRoute("/api/$")({
  server: {
    handlers: {
      GET: forwardToApi,
      POST: forwardToApi,
      PUT: forwardToApi,
      PATCH: forwardToApi,
      DELETE: forwardToApi,
      OPTIONS: forwardToApi,
    },
  },
});
