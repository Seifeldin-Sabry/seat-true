# One image: the TanStack Start app with the Elysia API mounted under /api.
# Build context: repository root. The workspace stays in the image so Fly's
# release_command can run Drizzle Kit migrations before new machines start.
# VITE_ values are public and compiled into the browser bundle.
# ponytail: single stage, no dependency-layer cache; add `turbo prune --docker` if builds get slow.
FROM oven/bun:1.4.0
WORKDIR /repo
COPY . .
RUN bun install --frozen-lockfile
ARG VITE_APP_ORIGIN
ARG VITE_WEB_ORIGIN
ENV VITE_APP_ORIGIN=$VITE_APP_ORIGIN \
    VITE_WEB_ORIGIN=$VITE_WEB_ORIGIN
RUN bun run --cwd apps/app build
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
EXPOSE 3000
CMD ["bun", "apps/app/.output/server/index.mjs"]
