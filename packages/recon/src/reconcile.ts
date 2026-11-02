import type {
  AgreementLine,
  Cents,
  Client,
  ReconException,
  ReconInput,
  VendorLine,
} from "./types";

/** Billed price may sit this far under expected before it counts as stale (rounding noise). */
const PRICE_TOLERANCE = 0.005;

export function expectedUnitPrice(
  unitCostCents: Cents,
  markupPct: number,
): Cents {
  return Math.round(unitCostCents * (1 + markupPct / 100));
}

type VendorGroup = Omit<VendorLine, "quantity"> & { quantity: number };

/** Same customer + SKU can appear on several lines (term changes, mid-month adds). */
function groupVendorLines(lines: VendorLine[]): VendorGroup[] {
  const groups = new Map<string, VendorGroup>();
  for (const line of lines) {
    const key = `${line.customerKey}\u0000${line.sku}`;
    const existing = groups.get(key);
    if (existing) {
      existing.quantity += line.quantity;
      // ponytail: latest line's cost wins; weight by quantity if mixed-term SKUs show up.
      existing.unitCostCents = line.unitCostCents;
    } else {
      groups.set(key, { ...line });
    }
  }
  return [...groups.values()];
}

export function reconcile({
  vendorLines,
  clients,
  mappings,
  agreements,
}: ReconInput): ReconException[] {
  const clientById = new Map(clients.map((client) => [client.id, client]));
  const clientIdByCustomer = new Map(
    mappings.map((mapping) => [mapping.customerKey, mapping.clientId]),
  );
  const agreementByClientSku = new Map<string, AgreementLine>();
  for (const line of agreements) {
    agreementByClientSku.set(`${line.clientId}\u0000${line.sku}`, line);
  }

  const exceptions: ReconException[] = [];
  const matchedAgreements = new Set<string>();

  for (const vendor of groupVendorLines(vendorLines)) {
    if (vendor.quantity <= 0) continue;
    const clientId = clientIdByCustomer.get(vendor.customerKey);
    const client = clientId ? clientById.get(clientId) : undefined;

    if (!client) {
      exceptions.push(
        unmappedException(vendor, "No PSA client is mapped to this customer."),
      );
      continue;
    }

    const agreementKey = `${client.id}\u0000${vendor.sku}`;
    const agreement = agreementByClientSku.get(agreementKey);
    if (agreement) matchedAgreements.add(agreementKey);

    exceptions.push(...compareLine(vendor, client, agreement));
  }

  // Billed SKUs with no licence behind them at all.
  for (const [key, agreement] of agreementByClientSku) {
    if (matchedAgreements.has(key) || agreement.quantity <= 0) continue;
    const client = clientById.get(agreement.clientId);
    if (!client) continue;
    exceptions.push({
      kind: "overbilled",
      clientId: client.id,
      customerKey: "",
      customerName: client.name,
      sku: agreement.sku,
      productName: agreement.sku,
      vendorQuantity: 0,
      billedQuantity: agreement.quantity,
      unitCostCents: 0,
      expectedUnitPriceCents: 0,
      billedUnitPriceCents: agreement.unitPriceCents,
      monthlyImpactCents: agreement.quantity * agreement.unitPriceCents,
      summary: `Billing ${agreement.quantity} × ${agreement.sku} but no matching licence on the distributor bill.`,
    });
  }

  return exceptions.sort((a, b) => b.monthlyImpactCents - a.monthlyImpactCents);
}

function compareLine(
  vendor: VendorGroup,
  client: Client,
  agreement: AgreementLine | undefined,
): ReconException[] {
  const expected = expectedUnitPrice(vendor.unitCostCents, client.markupPct);
  const base = {
    clientId: client.id,
    customerKey: vendor.customerKey,
    customerName: client.name,
    sku: vendor.sku,
    productName: vendor.productName,
    vendorQuantity: vendor.quantity,
    billedQuantity: agreement?.quantity ?? 0,
    unitCostCents: vendor.unitCostCents,
    expectedUnitPriceCents: expected,
    billedUnitPriceCents: agreement?.unitPriceCents ?? 0,
  };

  if (client.status === "offboarded") {
    // Leakage here is cost, not margin: nobody will pay for these seats.
    return [
      {
        ...base,
        kind: "ghost_license",
        monthlyImpactCents: vendor.quantity * vendor.unitCostCents,
        summary: `${client.name} is offboarded but ${vendor.quantity} × ${vendor.productName} is still active.`,
      },
    ];
  }

  const found: ReconException[] = [];
  const billedQuantity = agreement?.quantity ?? 0;
  const billedPrice = agreement?.unitPriceCents ?? expected;

  if (vendor.quantity > billedQuantity) {
    const missing = vendor.quantity - billedQuantity;
    found.push({
      ...base,
      kind: "unbilled_seats",
      monthlyImpactCents: missing * expected,
      summary: `${missing} × ${vendor.productName} on the bill but not invoiced to ${client.name}.`,
    });
  } else if (billedQuantity > vendor.quantity) {
    const extra = billedQuantity - vendor.quantity;
    found.push({
      ...base,
      kind: "overbilled",
      monthlyImpactCents: extra * billedPrice,
      summary: `${client.name} is invoiced for ${extra} more ${vendor.productName} than exist.`,
    });
  }

  if (agreement && billedPrice < expected * (1 - PRICE_TOLERANCE)) {
    const pricedSeats = Math.min(vendor.quantity, billedQuantity);
    found.push({
      ...base,
      kind: "stale_price",
      monthlyImpactCents: pricedSeats * (expected - billedPrice),
      summary: `${vendor.productName} billed at ${formatCents(billedPrice)} but cost + ${client.markupPct}% is ${formatCents(expected)}.`,
    });
  }

  return found;
}

function unmappedException(
  vendor: VendorGroup,
  summary: string,
): ReconException {
  return {
    kind: "unmapped_customer",
    clientId: null,
    customerKey: vendor.customerKey,
    customerName: vendor.customerName,
    sku: vendor.sku,
    productName: vendor.productName,
    vendorQuantity: vendor.quantity,
    billedQuantity: 0,
    unitCostCents: vendor.unitCostCents,
    expectedUnitPriceCents: 0,
    billedUnitPriceCents: 0,
    monthlyImpactCents: vendor.quantity * vendor.unitCostCents,
    summary,
  };
}

export function formatCents(cents: Cents): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

/** Overbilled is client refund risk, not lost revenue; keep it out of the leakage headline. */
export function leakageTotal(exceptions: ReconException[]): Cents {
  return exceptions
    .filter((exception) => exception.kind !== "overbilled")
    .reduce((sum, exception) => sum + exception.monthlyImpactCents, 0);
}
