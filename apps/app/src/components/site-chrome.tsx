import { brand } from "@seattrue/ui";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Wordmark } from "./wordmark";

/** Marketing pages: skip link, sticky header, content, footer link mesh. */
export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="st">
      <a className="st-skip" href="#main">
        Skip to content
      </a>
      <header className="st-header">
        <Wordmark />
        <nav className="st-nav" aria-label="Site">
          <Link to="/pricing">Pricing</Link>
          <Link to="/blog">Blog</Link>
          <Link to="/glossary">Glossary</Link>
          <Link to="/login" search={{ redirect: "/app" }}>
            Sign in
          </Link>
        </nav>
        <a className="st-btn st-btn-small" href="/#audit">
          Free audit
        </a>
      </header>
      <main id="main">{children}</main>
      <footer className="st-footer">
        <nav className="st-footer-mesh" aria-label="Footer">
          <div>
            <h2>Product</h2>
            <a href="/#audit">Free margin audit</a>
            <Link to="/pricing">Pricing</Link>
            <Link to="/login" search={{ redirect: "/app" }}>
              Sign in
            </Link>
          </div>
          <div>
            <h2>Compare</h2>
            <Link to="/compare/$competitor" params={{ competitor: "gradient" }}>
              vs Gradient Reconcile
            </Link>
            <Link
              to="/compare/$competitor"
              params={{ competitor: "pax8-psa-sync" }}
            >
              vs Pax8-to-PSA sync
            </Link>
            <Link
              to="/compare/$competitor"
              params={{ competitor: "spreadsheet" }}
            >
              vs a spreadsheet
            </Link>
          </div>
          <div>
            <h2>For</h2>
            <Link to="/for/$audience" params={{ audience: "pax8-msps" }}>
              Pax8 partners
            </Link>
            <Link to="/for/$audience" params={{ audience: "halopsa-msps" }}>
              HaloPSA MSPs
            </Link>
          </div>
          <div>
            <h2>Learn</h2>
            <Link to="/blog">Blog</Link>
            <Link to="/glossary">Glossary</Link>
            <a href="/rss.xml">RSS feed</a>
          </div>
        </nav>
        <p className="st-footer-legal">
          © {new Date().getFullYear()} {brand.name} · Built by SDX Studio
        </p>
      </footer>
    </div>
  );
}
