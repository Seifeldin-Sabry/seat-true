# Build context: repository root. Full workspace stays in the image so the
# release_command can run Drizzle Kit migrations before new machines start.
# ponytail: no dependency-layer cache; add `turbo prune --docker` if builds get slow.
FROM oven/bun:1.4.0
WORKDIR /repo
COPY . .
RUN bun install --frozen-lockfile
RUN bun run --cwd apps/api build
ENV NODE_ENV=production
EXPOSE 3001
# Decrypts .env.production at boot with the DOTENV_PRIVATE_KEY_PRODUCTION Fly secret.
CMD ["./node_modules/.bin/dotenvx", "run", "-f", ".env.production", "--", "bun", "apps/api/dist/server.js"]
