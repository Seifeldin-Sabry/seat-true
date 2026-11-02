import bricolage800 from "@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-800-normal.woff2?url";
import { brand } from "@seattrue/ui";
import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  HeadContent,
  Link,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { Wordmark } from "../components/wordmark";
import "../styles.css";

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: brand.themeColor },
    ],
    links: [
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      // Headline face: preloaded so big display headings swap in early.
      {
        rel: "preload",
        href: bricolage800,
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },
    ],
  }),
  notFoundComponent: NotFoundPage,
  component: Root,
});

function NotFoundPage() {
  return (
    <div className="not-found-shell">
      <title>{`Page not found · ${brand.name}`}</title>
      <meta name="robots" content="noindex" />
      <header className="not-found-header">
        <Wordmark />
      </header>

      <main className="not-found-content" aria-labelledby="not-found-title">
        <span className="not-found-number" aria-hidden="true">
          404
        </span>
        <div className="not-found-copy">
          <span className="not-found-kicker">Page not found</span>
          <h1 id="not-found-title">Nothing billed to this address.</h1>
          <p>
            The page moved, never existed, or isn’t published yet. Check the
            address, or head somewhere useful.
          </p>
          <div className="not-found-actions">
            <Link to="/" className="not-found-primary">
              SeatTrue home
              <ArrowRight size={17} aria-hidden="true" />
            </Link>
            <Link to="/app" className="not-found-secondary">
              Open my workspace
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

function Root() {
  return (
    <Document>
      <Outlet />
    </Document>
  );
}

function Document({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
