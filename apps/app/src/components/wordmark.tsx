import { brand } from "@seattrue/ui";
import { Link } from "@tanstack/react-router";

/**
 * The SeatTrue lockup: orange "S" tile + Bricolage name. One source for every
 * surface. The tile letter is CSS content so the accessible name starts with
 * the visible text ("SeatTrue home").
 */
export function Wordmark({
  to = "/",
  tone = "ink",
  context = "home",
}: {
  to?: "/" | "/app";
  tone?: "ink" | "on-deep";
  context?: string;
}) {
  return (
    <Link to={to} className={`wordmark wordmark-${tone}`}>
      <span className="wordmark-tile" aria-hidden="true" />
      <span>{brand.name}</span>
      <span className="sr-only"> {context}</span>
    </Link>
  );
}
