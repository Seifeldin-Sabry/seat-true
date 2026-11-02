import { brand } from "@seattrue/ui";
import { Link } from "@tanstack/react-router";

/** The SeatTrue lockup: orange "S" tile + Bricolage name. One source for every surface. */
export function Wordmark({
  to = "/",
  tone = "ink",
  label = `${brand.name} home`,
}: {
  to?: "/" | "/app";
  tone?: "ink" | "on-deep";
  label?: string;
}) {
  return (
    <Link to={to} className={`wordmark wordmark-${tone}`} aria-label={label}>
      <span className="wordmark-tile" aria-hidden="true">
        S
      </span>
      <span aria-hidden="true">{brand.name}</span>
    </Link>
  );
}
