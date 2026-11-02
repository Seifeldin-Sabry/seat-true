import type { ExceptionDto } from "./recon-api";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function formatCents(cents: number): string {
  return usd.format(cents / 100);
}

export const exceptionKindLabels: Record<ExceptionDto["kind"], string> = {
  unbilled_seats: "Unbilled seats",
  stale_price: "Stale price / markup",
  ghost_license: "Ghost licence",
  overbilled: "Overbilled",
  unmapped_customer: "Unmapped customer",
};

export const exceptionStatusLabels: Record<ExceptionDto["status"], string> = {
  open: "Open",
  approved: "Approved",
  billed: "Billed",
  dismissed: "Dismissed",
};
