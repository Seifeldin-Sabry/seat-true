/** Money is always integer cents to keep reconciliation exact. */
export type Cents = number;

/** One subscription line from a distributor bill (Pax8 today, others later). */
export type VendorLine = {
  /** Stable distributor-side customer identifier, e.g. Pax8 company ID. */
  customerKey: string;
  customerName: string;
  sku: string;
  productName: string;
  quantity: number;
  /** What the MSP pays the distributor per unit per month. */
  unitCostCents: Cents;
  billingTerm: string;
};

export type ClientStatus = "active" | "offboarded";

export type Client = {
  id: string;
  name: string;
  status: ClientStatus;
  /** Contracted markup over distributor cost, e.g. 20 for +20%. */
  markupPct: number;
};

/** Distributor customer → PSA client. */
export type CustomerMapping = {
  customerKey: string;
  clientId: string;
};

/** What the PSA agreement bills the client for one SKU. */
export type AgreementLine = {
  clientId: string;
  sku: string;
  quantity: number;
  unitPriceCents: Cents;
};

export const exceptionKinds = [
  "unbilled_seats",
  "stale_price",
  "ghost_license",
  "overbilled",
  "unmapped_customer",
] as const;

export type ExceptionKind = (typeof exceptionKinds)[number];

export type ReconException = {
  kind: ExceptionKind;
  clientId: string | null;
  customerKey: string;
  customerName: string;
  sku: string;
  productName: string;
  vendorQuantity: number;
  billedQuantity: number;
  unitCostCents: Cents;
  expectedUnitPriceCents: Cents;
  billedUnitPriceCents: Cents;
  /**
   * Monthly amount at stake. Leakage kinds: revenue the MSP is not collecting.
   * `overbilled`: amount charged to the client without a matching licence (refund risk).
   */
  monthlyImpactCents: Cents;
  summary: string;
};

export type ReconInput = {
  vendorLines: VendorLine[];
  clients: Client[];
  mappings: CustomerMapping[];
  agreements: AgreementLine[];
};

/** Adapter seam: Pax8 CSV now, Pax8 API / Partner Center / other distributors later. */
export type VendorSource = {
  name: string;
  fetchLines(): Promise<VendorLine[]>;
};

/**
 * Adapter seam for PSA API syncs (HaloPSA / Autotask / ConnectWise, not built).
 * Today the billed side comes from a CSV upload (billing-csv.ts) or manual
 * entry, both stored as agreement lines.
 */
export type PsaSource = {
  name: string;
  listClients(): Promise<Client[]>;
  listAgreementLines(): Promise<AgreementLine[]>;
};
