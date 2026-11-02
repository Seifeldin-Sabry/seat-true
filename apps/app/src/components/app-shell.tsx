import { Button, brand } from "@seattrue/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  CreditCard,
  Gauge,
  History,
  Inbox,
  Link2,
  LogOut,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { authClient } from "../lib/auth-client";
import {
  useCan,
  useSwitchWorkspace,
  workspaceQueryOptions,
} from "../lib/workspace";
import { BillingBanner } from "./billing-banner";
import { Wordmark } from "./wordmark";

const iconStroke = 1.8;
const primaryLinks = [
  { to: "/app", label: "Overview", Icon: Gauge },
  { to: "/app/exceptions", label: "Exceptions", Icon: Inbox },
  { to: "/app/mappings", label: "Mappings", Icon: Link2 },
  { to: "/app/members", label: "Members", Icon: Users },
] as const;

const roleLabels: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  tech: "Tech",
};

export function AppShell({
  children,
  userName,
}: {
  children: ReactNode;
  userName?: string;
}) {
  const queryClient = useQueryClient();
  const workspace = useQuery(workspaceQueryOptions);
  const switchWorkspace = useSwitchWorkspace();
  const can = useCan();
  const links = [
    ...primaryLinks,
    ...(can("audit", "view")
      ? [{ to: "/app/audit", label: "Audit log", Icon: History } as const]
      : []),
  ];
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);

  async function signOut() {
    setIsSigningOut(true);
    setSignOutError(null);
    try {
      const { error } = await authClient.signOut();
      if (error) {
        setSignOutError(error.message || "Could not sign out. Try again.");
        return;
      }
      queryClient.clear();
      window.location.assign("/login");
    } catch {
      setSignOutError("Could not sign out. Try again.");
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <div className="app-shell">
      <aside className="app-sidebar" aria-label="Workspace navigation">
        <div className="sidebar-main">
          <div className="sidebar-wordmark">
            <Wordmark to="/app" tone="on-deep" context="workspace home" />
          </div>

          <div className="sidebar-section-label">
            {workspace.data?.organization?.name ?? "Workspace"}
            {workspace.data?.role && (
              <> · {roleLabels[workspace.data.role] ?? workspace.data.role}</>
            )}
          </div>
          {(workspace.data?.workspaces.length ?? 0) > 1 && (
            <select
              className="workspace-switcher"
              aria-label="Switch workspace"
              value={workspace.data?.organization?.id ?? ""}
              disabled={switchWorkspace.isPending}
              onChange={(event) => switchWorkspace.mutate(event.target.value)}
            >
              {workspace.data?.workspaces.map((entry) => (
                <option
                  key={entry.id}
                  value={entry.id}
                  disabled={entry.suspended}
                >
                  {entry.name}
                  {entry.suspended ? " (suspended)" : ""}
                </option>
              ))}
            </select>
          )}
          <nav aria-label="Primary" className="sidebar-navigation">
            {links.map(({ to, label, Icon }) => (
              <Link
                key={to}
                className="sidebar-link"
                activeProps={{ className: "sidebar-link sidebar-link-active" }}
                activeOptions={{ exact: to === "/app" }}
                to={to}
              >
                <Icon size={18} strokeWidth={iconStroke} aria-hidden="true" />
                <span>{label}</span>
              </Link>
            ))}
            <Link
              className="sidebar-link"
              activeProps={{ className: "sidebar-link sidebar-link-active" }}
              to="/app/billing"
            >
              <CreditCard
                size={18}
                strokeWidth={iconStroke}
                aria-hidden="true"
              />
              <span>Billing</span>
            </Link>
          </nav>
        </div>

        <div className="sidebar-bottom">
          <span className="sidebar-bottom-kicker">Account</span>
          {userName && <p className="sidebar-account-name">{userName}</p>}
          <a href={brand.webUrl} className="sidebar-site-link">
            Visit website
            <ArrowUpRight
              size={15}
              strokeWidth={iconStroke}
              aria-hidden="true"
            />
          </a>
          <Button
            type="button"
            variant="ghost"
            className="signout-button"
            onClick={signOut}
            disabled={isSigningOut}
          >
            <LogOut size={16} strokeWidth={iconStroke} aria-hidden="true" />
            {isSigningOut ? "Signing out…" : "Sign out"}
          </Button>
          {signOutError && (
            <p className="signout-error" role="alert">
              {signOutError}
            </p>
          )}
        </div>
      </aside>

      <div className="app-main-column">
        <header className="app-topbar">
          <div className="mobile-brand">
            <Wordmark to="/app" context="workspace home" />
          </div>
          <div className="breadcrumb">
            <span>Workspace</span>
          </div>
          <a className="topbar-site-link" href={brand.webUrl}>
            Website
            <ArrowUpRight
              size={16}
              strokeWidth={iconStroke}
              aria-hidden="true"
            />
          </a>
        </header>
        <nav className="mobile-nav" aria-label="Primary">
          {links.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === "/app" }}
              activeProps={{ className: "mobile-nav-active" }}
            >
              {label}
            </Link>
          ))}
          <Link
            to="/app/billing"
            activeProps={{ className: "mobile-nav-active" }}
          >
            Billing
          </Link>
          <button type="button" onClick={signOut} disabled={isSigningOut}>
            {isSigningOut ? "Signing out…" : "Sign out"}
          </button>
        </nav>
        {signOutError && (
          <div className="mobile-signout-error" role="alert">
            {signOutError}
          </div>
        )}
        {workspace.data?.suspended && (
          <div className="error-banner" role="alert">
            <div>
              <strong>Your access is suspended</strong>
              <p>
                {workspace.data.organization?.name} is over its plan's seat
                limit. Ask the owner to upgrade, or switch to another workspace.
              </p>
            </div>
          </div>
        )}
        <BillingBanner />
        {children}
      </div>
    </div>
  );
}
