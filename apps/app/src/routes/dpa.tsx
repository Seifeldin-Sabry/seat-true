import { legal } from "@seattrue/auth-policy/legal";
import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage, LegalTable, OperatorDetails } from "../components/legal";
import { sitePageHead } from "../components/marketing";

export const Route = createFileRoute("/dpa")({
  head: () =>
    sitePageHead("dpa", [{ name: "Data Processing Agreement", path: "/dpa" }]),
  component: DpaPage,
});

function DpaPage() {
  return (
    <LegalPage title="Data Processing Agreement">
      <h2 id="parties">1. Parties and scope</h2>
      <p>
        This Data Processing Agreement ("DPA") is between the business that uses
        SeatTrue (the "Customer", controller) and the processor:
      </p>
      <OperatorDetails />
      <p>
        It forms part of the <Link to="/terms">Terms of Service</Link> and
        applies whenever SDX Studio processes personal data on the Customer's
        behalf while providing SeatTrue. It implements Article 28(3) of the
        General Data Protection Regulation (EU) 2016/679 ("GDPR"). Terms such as
        "personal data", "processing", "controller", "processor", "data subject"
        and "personal data breach" have the meaning given in the GDPR. If this
        DPA and the Terms conflict on data protection, this DPA prevails.
      </p>

      <h2 id="details">2. Details of the processing</h2>
      <LegalTable
        caption="Details of the processing"
        head={["Item", "Details"]}
        rows={[
          [
            "Subject matter",
            "Providing SeatTrue, the Microsoft 365 billing reconciliation service, to the Customer.",
          ],
          [
            "Duration",
            "The term of the Customer's subscription or free use, plus the 30-day export period and deletion set out in section 10.",
          ],
          [
            "Nature",
            "Receiving uploaded CSV files, parsing, storing, matching, comparing, displaying and deleting their contents.",
          ],
          [
            "Purpose",
            "Reconciling the Customer's distributor bills against its client billing, at cost times the Customer's markup, and tracking the exceptions found.",
          ],
          [
            "Types of personal data",
            "Client names (which can identify a person, such as a sole trader), client and PSA identifiers, licence SKUs, quantities, costs and prices linked to those clients; the Customer's team members' names and emails in comments and the audit log.",
          ],
          [
            "Special categories",
            "None are needed. The Customer must not upload special categories of data (Art. 9 GDPR) to SeatTrue.",
          ],
          [
            "Data subjects",
            "Staff and owners of the Customer's clients, where client data identifies them, and the Customer's own team members.",
          ],
        ]}
      />

      <h2 id="instructions">3. Instructions</h2>
      <p>
        SDX Studio processes the personal data only on the Customer's documented
        instructions, including with regard to transfers outside the European
        Economic Area, unless EU or Member State law requires otherwise; in that
        case it informs the Customer before processing, unless that law
        prohibits it. The Terms, this DPA and the Customer's configuration and
        use of SeatTrue are the Customer's documented instructions. SDX Studio
        tells the Customer immediately if, in its opinion, an instruction
        infringes the GDPR or other data protection law.
      </p>

      <h2 id="confidentiality">4. Confidentiality</h2>
      <p>
        SDX Studio ensures that everyone it authorises to process the personal
        data is bound by confidentiality, by contract or by law, and processes
        it only as needed to provide, support and secure the service.
      </p>

      <h2 id="security">5. Security</h2>
      <p>
        SDX Studio takes the technical and organisational measures required by
        Article 32 GDPR, appropriate to the risk, including:
      </p>
      <ul>
        <li>encryption of all traffic in transit with TLS;</li>
        <li>encryption at rest of the database by its provider;</li>
        <li>
          role-based access control that keeps each workspace separate and
          limits who can change mappings and resolve exceptions;
        </li>
        <li>passwords stored only as salted hashes;</li>
        <li>rate limiting of sign-in and other sensitive endpoints;</li>
        <li>an audit log of changes in each workspace;</li>
        <li>
          production access limited to the people who run the service and need
          it;
        </li>
        <li>
          database backups, and regular review of these measures as the service
          changes.
        </li>
      </ul>

      <h2 id="sub-processors">6. Sub-processors</h2>
      <ul>
        <li>
          The Customer gives SDX Studio general written authorisation to engage
          sub-processors. The current list is in the{" "}
          <Link to="/privacy" hash="sub-processors">
            Privacy Policy
          </Link>
          .
        </li>
        <li>
          SDX Studio informs workspace Owners by email at least 30 days before
          adding or replacing a sub-processor. The Customer may object on
          reasonable data protection grounds within that period. If we cannot
          resolve the objection, the Customer may cancel its subscription before
          the change takes effect.
        </li>
        <li>
          SDX Studio imposes on each sub-processor, by contract, data protection
          obligations that give the same level of protection as this DPA, and
          remains liable to the Customer for its sub-processors' performance of
          those obligations.
        </li>
        <li>
          Products the Customer exports data from (such as Pax8, Microsoft
          Partner Center and PSA tools) are not sub-processors of SDX Studio;
          the Customer engages them directly.
        </li>
      </ul>

      <h2 id="transfers">7. Transfers outside the EEA</h2>
      <p>
        Where a sub-processor processes personal data outside the European
        Economic Area, SDX Studio ensures a valid transfer mechanism under
        Chapter V GDPR: the EU-US Data Privacy Framework adequacy decision where
        the recipient is certified under it, or otherwise the Standard
        Contractual Clauses (Commission Implementing Decision (EU) 2021/914).
      </p>

      <h2 id="assistance">8. Assistance</h2>
      <ul>
        <li>
          <strong>Data subject requests:</strong> taking into account the nature
          of the processing, SDX Studio helps the Customer, by appropriate
          technical and organisational measures where possible, to respond to
          requests to exercise rights under Chapter III GDPR. If a data subject
          contacts SDX Studio directly, it forwards the request to the Customer
          without undue delay and does not answer it itself unless the Customer
          instructs it to.
        </li>
        <li>
          <strong>Security and compliance:</strong> SDX Studio helps the
          Customer meet its obligations under Articles 32 to 36 GDPR (security,
          breach notification, data protection impact assessments and prior
          consultation), taking into account the nature of the processing and
          the information available to it.
        </li>
      </ul>

      <h2 id="breach">9. Personal data breaches</h2>
      <p>
        SDX Studio notifies the Customer without undue delay after becoming
        aware of a personal data breach affecting the Customer's personal data.
        The notice describes, as far as then known, the nature of the breach,
        the categories and approximate number of data subjects and records
        concerned, the likely consequences, and the measures taken or proposed,
        with further information provided as it becomes available. SDX Studio
        takes reasonable steps to contain the breach and limit its effects.
      </p>

      <h2 id="deletion">10. Deletion or return at the end</h2>
      <p>
        When the Customer's subscription ends, the workspace stays available
        read-only for 30 days so the Customer can export its data, or ask us for
        a full copy. After those 30 days SDX Studio deletes the personal data,
        and copies in backups age out within a further 30 days, unless EU or
        Member State law requires it to be kept. The Customer can ask for
        earlier deletion at any time.
      </p>

      <h2 id="audits">11. Information and audits</h2>
      <p>
        SDX Studio makes available to the Customer all information necessary to
        demonstrate compliance with Article 28 GDPR, and allows for and
        contributes to audits, including inspections, by the Customer or an
        auditor it mandates. Audits are requested in writing with at least 30
        days' notice, take place no more than once a year unless a supervisory
        authority requires it or a personal data breach has occurred, are
        carried out during business hours without disrupting the service or
        exposing other customers' data, are subject to confidentiality, and are
        at the Customer's cost. SDX Studio may first answer with written
        information where that is enough to show compliance.
      </p>

      <h2 id="general">12. Liability and general terms</h2>
      <p>
        Each party's liability under this DPA is subject to the limits in the
        Terms of Service, except where the GDPR does not allow it. This DPA
        lasts as long as SDX Studio processes personal data for the Customer.
        Questions about this DPA go to {legal.email}.
      </p>
    </LegalPage>
  );
}
