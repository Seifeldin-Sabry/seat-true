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
  plugins: [
    tanstackStart(),
    // Pre-compressed assets: the Bun server sends .br/.gz without a CDN in front.
    nitro({ compressPublicAssets: { gzip: true, brotli: true } }),
    viteReact(),
    tailwindcss(),
  ],
});
