import { brand } from "@seattrue/ui";
import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { Wordmark } from "./wordmark";
import "../auth-styles.css";

/** Demo rows: the same exceptions the "Northbeam IT" demo run produces. */
const exampleRows: { client: string; kind: string; amount: string }[] = [
  { client: "Copperline Builders", kind: "Unbilled seats", amount: "$180.00" },
  { client: "Bright Path Tutoring", kind: "Ghost licences", amount: "$114.00" },
  { client: "Harbor Dental Group", kind: "Unbilled seats", amount: "$105.60" },
  { client: "Keystone Logistics", kind: "Stale price", amount: "$36.00" },
];

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-shell">
      <main className="auth-main" aria-labelledby="auth-title">
        <header className="auth-header">
          <Wordmark />
        </header>
        <div className="auth-form-wrap">{children}</div>
        <footer className="auth-footer">
          <span>
            © {new Date().getFullYear()} {brand.name}
          </span>
          <Link to="/">Back to site</Link>
        </footer>
      </main>

      <aside className="auth-panel" aria-labelledby="auth-panel-title">
        <p className="auth-panel-eyebrow">
          Margin gate for Microsoft resellers
        </p>
        <h2 id="auth-panel-title">Find the seats you never billed</h2>
        <p className="auth-panel-copy">
          Every Microsoft line on your Pax8 bill, checked against what you
          invoice each client at cost × the markup you agreed.
        </p>

        <figure className="auth-inbox">
          <div className="auth-inbox-head">
            <span>Exceptions inbox</span>
            <span className="auth-inbox-tag">Example</span>
          </div>
          <table>
            <caption className="sr-only">
              Example exceptions from a demo workspace
            </caption>
            <thead>
              <tr>
                <th scope="col">Client</th>
                <th scope="col">Exception</th>
                <th scope="col">Per month</th>
              </tr>
            </thead>
            <tbody>
              {exampleRows.map((row) => (
                <tr key={row.client}>
                  <th scope="row">{row.client}</th>
                  <td>{row.kind}</td>
                  <td>{row.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <figcaption>
            Demo workspace “Northbeam IT”, one Pax8 bill. Not customer data.
          </figcaption>
        </figure>

        <ul className="auth-panel-points">
          <li>
            <Check size={16} aria-hidden="true" /> Runs on a CSV export. Nothing
            writes to Pax8 or your PSA.
          </li>
          <li>
            <Check size={16} aria-hidden="true" /> Every exception carries a
            monthly dollar figure.
          </li>
          <li>
            <Check size={16} aria-hidden="true" /> Techs flag, admins approve,
            before invoices go out.
          </li>
        </ul>
      </aside>
    </div>
  );
}
