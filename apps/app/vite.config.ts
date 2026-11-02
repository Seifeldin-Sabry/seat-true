import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

export default defineConfig({
  // SITE_URL (the public domain) is the one non-VITE_ variable the client may read.
  envPrefix: ["VITE_", "SITE_URL"],
  server: {
    port: 3000,
    strictPort: true,
  },
  // Native addon for OG images: load it from node_modules, never pre-bundle it.
  optimizeDeps: { exclude: ["@resvg/resvg-js"] },
  ssr: {
    external: ["@resvg/resvg-js"],
    optimizeDeps: { exclude: ["@resvg/resvg-js"] },
  },
  environments: {
    client: {
      build: {
        rolldownOptions: {
          output: {
            codeSplitting: {
              // Every page needs React, the router and Start's client runtime:
              // ship them as one chunk, not a dozen small preloaded files.
              groups: [
                {
                  name: "framework",
                  test: /node_modules[\\/](react|react-dom|scheduler|seroval|@tanstack)[\\/]/,
                },
              ],
            },
          },
        },
      },
    },
  },
  plugins: [
    tanstackStart({
      router: {
        codeSplittingOptions: {
          // App loaders pull in TanStack Query options and the API client;
          // split them out so marketing pages don't preload that code.
          splitBehavior: ({ routeId }) =>
            routeId.startsWith("/app")
              ? [
                  ["loader"],
                  ["component"],
                  ["errorComponent"],
                  ["notFoundComponent"],
                ]
              : undefined,
        },
      },
    }),
    // Pre-compressed assets: the Bun server sends .br/.gz without a CDN in front.
    nitro({ compressPublicAssets: { gzip: true, brotli: true } }),
    viteReact(),
    tailwindcss(),
  ],
});
