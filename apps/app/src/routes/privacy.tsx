import { legal } from "@seattrue/auth-policy/legal";
import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage, LegalTable, OperatorDetails } from "../components/legal";
import { sitePageHead } from "../components/marketing";

export const Route = createFileRoute("/privacy")({
  head: () =>
    sitePageHead("privacy", [{ name: "Privacy policy", path: "/privacy" }]),
  component: PrivacyPage,
});

const belgianDpa = "https://www.dataprotectionauthority.be/";

function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy">
      <p>
        SeatTrue checks what managed service providers (MSPs) pay their
        distributor for Microsoft 365 licences against what they bill their
        clients. This policy explains what personal data SeatTrue processes,
        why, on what legal basis, who else handles it, how long it is kept and
        what rights you have, as Articles 13 and 14 of the EU General Data
        Protection Regulation (GDPR) require.
      </p>

      <h2 id="who-we-are">1. Who we are</h2>
      <p>SeatTrue is operated by:</p>
      <OperatorDetails />
      <p>
        In this policy "SDX Studio", "we" and "us" mean that business. Write to
        the email address above with any privacy question or request.
      </p>

      <h2 id="roles">2. Our two roles</h2>
      <p>
        <strong>We are the controller</strong> for data about our own customers
        and website visitors: account and sign-in data, billing data, the free
        margin audit request form, the waitlists and messages you send us. We
        decide why and how that data is used, and this policy covers it in full.
      </p>
      <p>
        <strong>We are a processor</strong> for the data MSPs upload to
        SeatTrue: their distributor bills, their PSA billing exports, their
        clients' names, licences and prices, and the markups and mappings they
        set. The MSP is the controller of that data. We process it only on the
        MSP's instructions, under our{" "}
        <Link to="/dpa">Data Processing Agreement</Link>.
      </p>
      <p>
        If you work for one of an MSP's clients and want to exercise your rights
        over that data, contact the MSP concerned. If you write to us instead,
        we pass your request to the MSP without undue delay and help it respond.
      </p>

      <h2 id="controller-data">3. Data we control, why and for how long</h2>
      <LegalTable
        caption="Personal data SDX Studio processes as controller"
        head={[
          "Data",
          "What it includes",
          "Purpose",
          "Legal basis",
          "Kept for",
        ]}
        rows={[
          [
            "Account data",
            "Name, work email, password hash (never the password itself), Google account ID and profile picture if you sign in with Google, workspace, role (Owner, Admin or Tech), team invitations, and when the Terms were accepted.",
            "Create and run your account and workspace, sign you in, send account emails (verification, password reset, invitations).",
            "Contract (Art. 6(1)(b) GDPR).",
            "For the life of the account, then deleted as described in section 9.",
          ],
          [
            "Sign-in and security data",
            "Session records with IP address and browser user agent, rate-limit counters keyed by IP address, one-time verification tokens.",
            "Keep you signed in and protect accounts from abuse and brute-force attempts.",
            "Legitimate interests in securing the service (Art. 6(1)(f)).",
            "Sessions until they expire or you sign out; rate-limit counters no longer than 30 days; one-time tokens until used or expired.",
          ],
          [
            "Workspace audit log",
            "Who did what in the workspace: the person's user ID and email, the action, and the values before and after.",
            "Accountability for billing decisions; security investigations.",
            "Contract, and legitimate interests in a reliable record (Art. 6(1)(b) and (f)).",
            "For the life of the workspace.",
          ],
          [
            "Billing data",
            "Company name, billing email and address, VAT number and payment method, held by Stripe. We store the Stripe customer and subscription IDs, plan, status and billing dates, never card numbers.",
            "Charge subscriptions, issue invoices, keep accounting records.",
            "Contract; legal obligation for accounting and tax records (Art. 6(1)(b) and (c)).",
            "Invoices and accounting records for 7 years, as Belgian accounting and tax law requires; the rest for the life of the account.",
          ],
          [
            "Free margin audit requests",
            "Work email, company, number of clients, distributor and PSA.",
            "Reply to you and run the free audit you asked for.",
            "Steps taken at your request before a contract, and legitimate interests in answering business enquiries (Art. 6(1)(b) and (f)).",
            "Up to 24 months after our last contact, unless you become a customer or ask us to delete it sooner.",
          ],
          [
            "Waitlists",
            "Work email, optional company and seat count, and the integration you asked about.",
            "Tell you when SeatTrue or that integration is available and gauge demand.",
            "Legitimate interests in answering your request (Art. 6(1)(f)).",
            "Until we have told you it is available, or until you ask us to remove you, and no longer than 24 months.",
          ],
          [
            "Messages to us",
            "What you write to us by email and our replies.",
            "Answer questions and support requests.",
            "Legitimate interests (Art. 6(1)(f)); contract where you are a customer.",
            "Up to 24 months after the conversation ends.",
          ],
          [
            "Technical logs",
            "Request and error logs with IP address, path and time. Credentials are redacted.",
            "Run, debug and secure the service.",
            "Legitimate interests (Art. 6(1)(f)).",
            "No longer than 30 days.",
          ],
        ]}
      />
      <p>
        Where we rely on legitimate interests, we have weighed them against your
        rights: the data is limited to business contact details and technical
        data, and you can object at any time (section 11). We do not rely on
        consent for any processing today. If we ever ask for consent, you can
        withdraw it at any time without affecting earlier processing.
      </p>
      <p>
        You need to give us account data to use SeatTrue, because we cannot
        provide the service without it. Everything on the audit and waitlist
        forms is voluntary.
      </p>

      <h2 id="customer-data">4. Data we process for MSPs</h2>
      <p>
        As a processor, SeatTrue handles the following for each MSP, only to
        provide the service the MSP signed up for:
      </p>
      <ul>
        <li>
          <strong>Distributor bills</strong> uploaded as CSV files from Pax8 or
          Microsoft Partner Center: customer names and IDs, SKUs, product names,
          quantities, unit costs and billing terms, and the file name. We keep
          only the columns needed for reconciliation.
        </li>
        <li>
          <strong>PSA billing exports</strong> uploaded as CSV files: client
          names, SKUs or product names, quantities and billed prices.
        </li>
        <li>
          <strong>Client records and settings:</strong> client names, PSA IDs,
          status, agreed markups, customer and SKU mappings.
        </li>
        <li>
          <strong>Reconciliation results:</strong> exceptions found, their
          monthly impact, status, and comments with the author's email.
        </li>
      </ul>
      <p>
        Client names are usually company names, but they can identify a person,
        for example a sole trader. The MSP decides what to upload and is
        responsible for having a lawful basis for it. Retention, deletion and
        our other commitments for this data are set out in the{" "}
        <Link to="/dpa">Data Processing Agreement</Link>.
      </p>

      <h2 id="google">5. Sign in with Google</h2>
      <p>
        If you choose to sign in with Google, Google shares your name, email
        address, profile picture and Google account ID with us. We use them only
        to create your account and sign you in, and we request no other Google
        data. Our use of information received from Google APIs adheres to the
        Google API Services User Data Policy, including its Limited Use
        requirements.
      </p>

      <h2 id="sub-processors">6. Sub-processors</h2>
      <p>
        These providers process personal data for us to run SeatTrue. Each is
        bound by data processing terms with confidentiality and security
        obligations.
      </p>
      <LegalTable
        caption="Sub-processors"
        head={["Provider", "What it does", "Where data is processed"]}
        rows={[
          [
            "Fly.io",
            "Application hosting",
            "European Union (Frankfurt, Germany)",
          ],
          [
            "Neon",
            "PostgreSQL database and backups",
            "European Union (AWS eu-central-1, Frankfurt, Germany)",
          ],
          [
            "Upstash",
            "Cache, rate limiting and background job queue",
            "European Union (eu-central-1, Frankfurt, Germany)",
          ],
          ["Resend", "Account and notification emails", "United States"],
          [
            "Stripe",
            "Subscription billing, payments and invoices",
            "European Union and United States",
          ],
          ["Google", "Sign in with Google", "European Union and United States"],
        ]}
      />
      <p>
        We tell workspace Owners by email before we add or replace a
        sub-processor, as set out in the{" "}
        <Link to="/dpa">Data Processing Agreement</Link>.
      </p>
      <p>
        <strong>Tools you export from are not our sub-processors.</strong> Pax8,
        Microsoft Partner Center and your PSA (such as ConnectWise, Autotask or
        HaloPSA) are chosen by the MSP, which has its own agreement with each of
        them. SeatTrue receives only the files the MSP uploads.
      </p>

      <h2 id="transfers">7. Transfers outside the EU</h2>
      <p>
        Your data is hosted and stored in the European Union: the application
        runs on Fly.io in Frankfurt and the database (including backups) is on
        Neon in AWS eu-central-1, Frankfurt. Some providers above (Stripe,
        Google, Resend and the companies behind Fly.io, Neon and Upstash) are US
        companies, and some, such as Resend for email delivery, process data in
        the United States. Where personal data is transferred outside the
        European Economic Area, we rely on the European Commission's adequacy
        decision for the EU-US Data Privacy Framework where the recipient is
        certified under it, and otherwise on the Standard Contractual Clauses
        adopted by the Commission (Implementing Decision (EU) 2021/914) in the
        provider's data processing terms. You can ask us for a copy of the
        relevant safeguards.
      </p>

      <h2 id="sharing">8. Who else sees your data</h2>
      <p>
        Apart from the sub-processors above, we share personal data only when
        the law requires it, to protect our rights or the safety of others, or
        with a buyer if our business is sold, who would be bound by this policy.
        We do not sell personal data and we do not share it for advertising. We
        make no decisions based solely on automated processing that have legal
        or similarly significant effects on you: SeatTrue's reconciliation flags
        billing differences for the MSP to review and decide on.
      </p>

      <h2 id="retention">9. Retention and deletion</h2>
      <ul>
        <li>
          Account and workspace data is kept while the account is open. When a
          subscription ends, the workspace stays available read-only for 30 days
          so you can export it, and is then deleted. A workspace that never
          takes out a subscription is deleted after 90 days in which nobody
          signs in to it. Either way we email the workspace Owner 7 days before
          deletion, and accounts that belong to no other workspace are deleted
          with it. You can also ask us to delete an account or workspace at any
          time.
        </li>
        <li>
          Deleted data leaves our database backups as they age out, within 30
          days.
        </li>
        <li>
          Invoices and accounting records are kept for 7 years, as Belgian
          accounting and tax law requires.
        </li>
        <li>Other periods are listed in the table in section 3.</li>
      </ul>

      <h2 id="security">10. Security</h2>
      <ul>
        <li>All traffic to SeatTrue is encrypted in transit with TLS.</li>
        <li>Our database provider encrypts stored data at rest.</li>
        <li>
          Access and refresh tokens from Sign in with Google are encrypted at
          rest with XChaCha20-Poly1305.
        </li>
        <li>Passwords are stored only as salted hashes.</li>
        <li>
          Role-based access: Owners, Admins and Techs see only their own
          workspace, and only Owners and Admins can change mappings and resolve
          exceptions.
        </li>
        <li>
          Workspace changes are recorded in an audit log, and sign-in endpoints
          are rate limited.
        </li>
        <li>
          Access to production systems is limited to the people who run SeatTrue
          and need it.
        </li>
      </ul>

      <h2 id="rights">11. Your rights</h2>
      <p>Under the GDPR you have the right to:</p>
      <ul>
        <li>access the personal data we hold about you and get a copy;</li>
        <li>have inaccurate data corrected (rectification);</li>
        <li>have your data erased;</li>
        <li>restrict how we use it;</li>
        <li>
          receive data you gave us in a structured, machine-readable format, or
          have it sent to another provider (portability);
        </li>
        <li>
          object to processing based on legitimate interests, and to direct
          marketing at any time;
        </li>
        <li>withdraw consent, where we rely on it.</li>
      </ul>
      <p>
        Email us at {legal.email} to exercise any of them. We answer within one
        month. For complex or numerous requests we may extend that by two more
        months, and if so we tell you why within the first month. We may ask you
        to confirm your identity first. Requests about data we process for an
        MSP are passed to that MSP, as explained in section 2.
      </p>
      <p>
        You also have the right to lodge a complaint with a supervisory
        authority. In Belgium that is the Data Protection Authority
        (Gegevensbeschermingsautoriteit / Autorité de protection des données),
        Drukpersstraat 35 / Rue de la Presse 35, 1000 Brussels,{" "}
        <a href="mailto:contact@apd-gba.be">contact@apd-gba.be</a>,{" "}
        <a href={belgianDpa}>www.dataprotectionauthority.be</a>. We would
        appreciate the chance to resolve your concern first.
      </p>

      <h2 id="cookies">12. Cookies</h2>
      <p>
        SeatTrue sets only strictly necessary cookies: a session cookie that
        keeps you signed in (<code>better-auth.session_token</code>) and
        short-lived cookies that protect the Google sign-in flow. They are
        needed for the service you ask for, so they do not require consent.
      </p>
      <p>
        We use no analytics, advertising or tracking cookies, load no
        third-party tracking scripts, and serve our fonts ourselves. That is why
        there is no cookie banner.
      </p>

      <h2 id="children">13. Business use only</h2>
      <p>
        SeatTrue is a service for businesses. It is not directed at children and
        we do not knowingly collect data about anyone under 16.
      </p>

      <h2 id="changes">14. Changes to this policy</h2>
      <p>
        We update this page when our processing changes and show the date of the
        last update at the top. For material changes we email workspace Owners
        at least 30 days before they take effect.
      </p>

      <p>
        See also our <Link to="/terms">Terms of Service</Link> and{" "}
        <Link to="/dpa">Data Processing Agreement</Link>.
      </p>
    </LegalPage>
  );
}
