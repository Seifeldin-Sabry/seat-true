import { legal } from "@seattrue/auth-policy/legal";
import type { ReactNode } from "react";
import { PageIntro } from "./marketing";
import { SiteShell } from "./site-chrome";

/** Shell for /privacy, /terms and /dpa: title, last-updated line, prose body. */
export function LegalPage({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <SiteShell>
      <PageIntro eyebrow="Legal" title={title}>
        <p>Last updated: {legal.lastUpdated}</p>
      </PageIntro>
      <article className="st-article">
        <div className="st-prose">{children}</div>
      </article>
    </SiteShell>
  );
}

/** Who "we" are, with the registered office and contact address. */
export function OperatorDetails() {
  return (
    <ul>
      <li>
        <strong>{legal.operator}</strong>, enterprise number{" "}
        {legal.enterpriseNumber}, {legal.country}
      </li>
      <li>Registered office: {legal.address}</li>
      <li>Email: {legal.email}</li>
    </ul>
  );
}

export function LegalTable({
  caption,
  head,
  rows,
}: {
  caption: string;
  head: string[];
  rows: ReactNode[][];
}) {
  return (
    <table className="st-legal-table" aria-label={caption}>
      <thead>
        <tr>
          {head.map((cell) => (
            <th key={cell} scope="col">
              {cell}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static legal table rows never reorder
          <tr key={rowIndex}>
            {row.map((cell, cellIndex) =>
              cellIndex === 0 ? (
                // biome-ignore lint/suspicious/noArrayIndexKey: static cells
                <th key={cellIndex} scope="row">
                  {cell}
                </th>
              ) : (
                // biome-ignore lint/suspicious/noArrayIndexKey: static cells
                <td key={cellIndex} data-label={head[cellIndex]}>
                  {cell}
                </td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
