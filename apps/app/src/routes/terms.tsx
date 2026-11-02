import { legal } from "@seattrue/auth-policy/legal";
import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage, OperatorDetails } from "../components/legal";
import { sitePageHead } from "../components/marketing";

export const Route = createFileRoute("/terms")({
  head: () => sitePageHead("terms", [{ name: "Terms", path: "/terms" }]),
  component: TermsPage,
});

function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <h2 id="agreement">1. Who we are and this agreement</h2>
      <p>SeatTrue is provided by:</p>
      <OperatorDetails />
      <p>
        These terms are a contract between SDX Studio ("we", "us") and the
        business that creates a SeatTrue workspace (the "Customer", "you"). They
        include our <Link to="/dpa">Data Processing Agreement</Link> (DPA),
        which forms part of them. Our <Link to="/privacy">Privacy Policy</Link>{" "}
        explains how we handle personal data as a controller. By creating an
        account you accept these terms on behalf of your business, and you
        confirm you have authority to do so.
      </p>

      <h2 id="business-only">2. For businesses only</h2>
      <p>
        SeatTrue is sold only to businesses and professionals, for use in their
        trade or profession. By signing up you confirm you act for a business
        and not as a consumer. Consumer protection rules, including the 14-day
        right of withdrawal for distance contracts, therefore do not apply.
      </p>

      <h2 id="service">3. The service</h2>
      <p>
        SeatTrue compares the Microsoft 365 licences on your distributor bill
        (for example from Pax8 or Microsoft Partner Center) with what you bill
        your clients, at cost times the markup you set, and lists the
        differences. It works from the files you upload. It does not change your
        PSA, your invoices or your distributor subscriptions.
      </p>
      <p>
        Reconciliation results are decision support. They depend on the files
        you upload, the mappings you confirm and the markups you set. You remain
        responsible for your billing, for what you invoice your clients and for
        your agreements with Microsoft, your distributor and your clients.
      </p>

      <h2 id="accounts">4. Accounts and users</h2>
      <ul>
        <li>
          Each workspace has at least one Owner. Owners and Admins can invite
          Admins and Techs, within your plan's user limit.
        </li>
        <li>
          You are responsible for everything done under your workspace,
          including by people you invite, and for keeping sign-in details
          secure. Tell us promptly at {legal.email} if you suspect unauthorised
          access.
        </li>
        <li>Account information you give us must be accurate and current.</li>
      </ul>

      <h2 id="customer-data">5. Your data and your responsibilities</h2>
      <p>
        You keep all rights in the data you upload to or create in SeatTrue
        ("Customer Data"). You give us the right to host, copy, process and
        display Customer Data only to provide, secure and support the service,
        as described in the DPA.
      </p>
      <p>
        You are the controller of the personal data in Customer Data. You are
        responsible for having a lawful basis to upload and process your
        clients' billing data, for giving them the information the law requires,
        and for having the right, under your agreements with your distributor
        and clients, to share that data with us.
      </p>

      <h2 id="acceptable-use">6. Acceptable use</h2>
      <p>You must not use SeatTrue to:</p>
      <ul>
        <li>break the law or infringe anyone's rights;</li>
        <li>store or process data you have no right to use;</li>
        <li>upload malware or harmful code;</li>
        <li>
          probe, scan, overload or bypass the security or limits of the service,
          or access other customers' data;
        </li>
        <li>
          copy, resell or reverse engineer the service, except where the law
          expressly allows it.
        </li>
      </ul>

      <h2 id="free-offers">7. Free audit and setup offers</h2>
      <p>
        Free setup, free audits and similar offers are provided as they are,
        with no obligation to subscribe afterwards. We may change or end these
        offers at any time.
      </p>

      <h2 id="billing">8. Subscriptions and billing</h2>
      <ul>
        <li>
          Prices are those shown on the <Link to="/pricing">pricing page</Link>{" "}
          when you subscribe, in US dollars, excluding VAT. Belgian VAT is added
          where it applies. EU businesses outside Belgium that give us a valid
          VAT number are invoiced without VAT under the reverse-charge
          mechanism.
        </li>
        <li>
          Subscriptions are billed monthly in advance through Stripe and renew
          automatically each month until cancelled. You authorise us to charge
          your payment method on each renewal.
        </li>
        <li>
          Each plan has the client and user limits shown on the pricing page. An
          upgrade applies straight away, and the price difference for the rest
          of the current period is invoiced immediately. A downgrade takes
          effect at the end of the current period, with no credit. If you then
          have more clients or users than the new plan allows, the ones you did
          not choose to keep are locked read-only, never deleted, until you
          upgrade or archive others.
        </li>
        <li>
          We may change our prices with at least 30 days' email notice to
          workspace Owners. A new price applies from your next renewal after the
          notice period. If you do not accept it, cancel before then.
        </li>
      </ul>

      <h2 id="no-refunds">9. No refunds</h2>
      <p>
        Payments are non-refundable. There are no refunds or credits for partial
        months, unused clients or users, downgrades, or cancellation, except
        where mandatory law requires a refund.
      </p>

      <h2 id="cancellation">10. Cancelling</h2>
      <p>
        You can cancel at any time from the billing page. Cancellation takes
        effect at the end of the period you have already paid for: you keep full
        access until then and are not charged again.
      </p>

      <h2 id="late-payment">11. Failed payments, and no interest or fees</h2>
      <ul>
        <li>
          If a payment fails, Stripe retries it and your workspace stays fully
          usable for 7 days, with a notice to update your payment details.
        </li>
        <li>
          After 7 days the workspace becomes read-only until the payment
          succeeds. You can still sign in and see your data. Your data is not
          deleted for non-payment while the subscription is in place, and if the
          subscription ends, section 17 applies.
        </li>
        <li>
          We never charge interest, late fees, penalties or collection costs on
          late payments. SDX Studio waives, to the fullest extent the law
          allows, the late-payment interest and the flat-rate compensation for
          recovery costs it could otherwise claim under the Belgian Act of 2
          August 2002 on combating late payment in commercial transactions (Wet
          van 2 augustus 2002 betreffende de bestrijding van de
          betalingsachterstand bij handelstransacties / Loi du 2 août 2002
          concernant la lutte contre le retard de paiement dans les transactions
          commerciales), and will not claim them. This is a deliberate choice
          and applies to every invoice.
        </li>
      </ul>

      <h2 id="ip">12. Our intellectual property</h2>
      <p>
        We own SeatTrue, its software, design and content, and all related
        intellectual property. While your subscription is active (or you use a
        free offer), we grant you a non-exclusive, non-transferable right to use
        the service for your business under these terms. If you send us ideas or
        feedback, we may use them freely without obligation to you.
      </p>

      <h2 id="third-parties">13. Third-party products</h2>
      <p>
        SeatTrue reads files exported from products such as Microsoft Partner
        Center, Pax8 and PSA tools. Your use of them is governed by your own
        agreements with their providers. We are not responsible for their data,
        errors, outages or changes to their export formats, which may stop an
        import working until we adapt to them. SeatTrue is not affiliated with,
        endorsed or sponsored by Microsoft, Pax8 or any PSA vendor. Microsoft,
        Microsoft 365, Pax8 and other product names are trademarks of their
        respective owners.
      </p>

      <h2 id="availability">14. Availability and changes to the service</h2>
      <p>
        We make reasonable efforts to keep SeatTrue available and your data
        safe, but we do not promise uninterrupted service and offer no service
        level agreement. We may carry out maintenance, which we try to schedule
        to limit disruption. We may improve and change features over time; we
        will not materially reduce the core service during a period you have
        paid for.
      </p>

      <h2 id="confidentiality">15. Confidentiality</h2>
      <p>
        Each party keeps the other's non-public business information
        confidential and uses it only for this agreement, except where it is
        already public, independently known, or must be disclosed by law. The
        DPA sets out our specific obligations for personal data.
      </p>

      <h2 id="warranties">16. Warranties and liability</h2>
      <p>
        Apart from what these terms expressly say, the service is provided "as
        is" and "as available", and we give no other warranties, including of
        fitness for a particular purpose, to the extent the law allows.
      </p>
      <ul>
        <li>
          Our total liability arising from or related to this agreement is
          limited to the fees you paid us in the 12 months before the event
          giving rise to the claim.
        </li>
        <li>
          We are not liable for indirect or consequential loss, including lost
          profit, revenue, business, goodwill or data, or for amounts you did or
          did not invoice your clients.
        </li>
        <li>
          These limits do not apply to liability for fraud, wilful misconduct,
          death or personal injury, or any other liability that the law does not
          allow to be limited or excluded.
        </li>
      </ul>

      <h2 id="termination">17. Suspension, termination and your data</h2>
      <ul>
        <li>
          We may suspend or terminate access, with notice where reasonably
          possible, if you seriously breach these terms, if your use puts the
          service, other customers or third parties at risk, or if the law
          requires it. For other breaches we first give you 14 days to put
          things right.
        </li>
        <li>
          When your subscription ends, for whatever reason, your workspace stays
          available read-only for 30 days. During that time you can see and copy
          your data, and ask us for a full export. After 30 days we delete the
          workspace data. Copies in backups age out within a further 30 days. We
          keep invoices and accounting records for as long as the law requires.
        </li>
        <li>
          Sections that by their nature should survive termination, such as
          payment of amounts due, intellectual property, confidentiality,
          liability and governing law, survive it.
        </li>
      </ul>

      <h2 id="changes">18. Changes to these terms</h2>
      <p>
        We may update these terms. For material changes we email workspace
        Owners at least 30 days before they take effect. If you do not agree,
        you can cancel before the change applies; continuing to use the service
        afterwards means you accept the new terms.
      </p>

      <h2 id="law">19. Governing law and courts</h2>
      <p>
        These terms are governed by Belgian law. Any dispute falls under the
        exclusive jurisdiction of the competent courts of the judicial district
        of SDX Studio's registered office ({legal.address}).
      </p>

      <h2 id="general">20. General</h2>
      <ul>
        <li>
          <strong>Entire agreement:</strong> these terms, the DPA and the prices
          accepted at checkout are the whole agreement between us about SeatTrue
          and replace any earlier understanding.
        </li>
        <li>
          <strong>Severability:</strong> if a provision is invalid, the rest
          still applies, and the invalid provision is replaced by a valid one as
          close as possible to its purpose.
        </li>
        <li>
          <strong>Assignment:</strong> you may not transfer this agreement
          without our written consent. We may transfer it to a successor of our
          business with notice to you.
        </li>
        <li>
          <strong>Notices:</strong> we send notices by email to workspace
          Owners. You send notices to {legal.email}.
        </li>
        <li>
          <strong>No waiver:</strong> not enforcing a right straight away does
          not waive it.
        </li>
        <li>
          <strong>Force majeure:</strong> neither party is liable for delays
          caused by events beyond its reasonable control.
        </li>
      </ul>
    </LegalPage>
  );
}
