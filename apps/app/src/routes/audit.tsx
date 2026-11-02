import { createFileRoute } from "@tanstack/react-router";
import { AuditForm } from "../components/audit-form";
import { PageIntro, sitePageHead } from "../components/marketing";
import { SiteShell } from "../components/site-chrome";

export const Route = createFileRoute("/audit")({
  head: () =>
    sitePageHead("audit", [{ name: "Free margin audit", path: "/audit" }]),
  component: AuditPage,
});

function AuditPage() {
  return (
    <SiteShell>
      <PageIntro
        eyebrow="Free margin audit"
        title="See last month's leak in dollars"
      >
        <p>
          Upload your Pax8 bill and your client billing export; we check every
          line at cost × your agreed markup. We onboard four MSPs a week so
          every audit gets a real person.
        </p>
      </PageIntro>
      <section className="st-section st-section-tight">
        <div className="st-notify">
          <AuditForm cta="Get my free margin audit" />
        </div>
      </section>
    </SiteShell>
  );
}
