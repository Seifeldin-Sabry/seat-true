/**
 * Demo MSP "Northbeam IT": 8 PSA clients plus one distributor customer nobody
 * mapped. Each planted problem below is what the reconciler should surface.
 */
import type { ClientStatus } from "./types";

export type DemoClient = {
  ref: string;
  name: string;
  status: ClientStatus;
  markupPct: number;
  psaId: string;
  pax8CompanyId: string;
};

export type DemoAgreement = {
  clientRef: string;
  sku: string;
  productName: string;
  quantity: number;
  unitPriceCents: number;
};

export const demoMspName = "Northbeam IT";

export const demoClients: DemoClient[] = [
  {
    ref: "harbor",
    name: "Harbor Dental Group",
    status: "active",
    markupPct: 20,
    psaId: "HALO-1041",
    pax8CompanyId: "PX-20931",
  },
  {
    ref: "keystone",
    name: "Keystone Logistics",
    status: "active",
    markupPct: 20,
    psaId: "HALO-1042",
    pax8CompanyId: "PX-20944",
  },
  {
    ref: "brightpath",
    name: "Bright Path Tutoring",
    status: "offboarded",
    markupPct: 15,
    psaId: "HALO-1013",
    pax8CompanyId: "PX-19870",
  },
  {
    ref: "ridgeway",
    name: "Ridgeway Law LLP",
    status: "active",
    markupPct: 25,
    psaId: "HALO-1027",
    pax8CompanyId: "PX-20112",
  },
  {
    ref: "copperline",
    name: "Copperline Builders",
    status: "active",
    markupPct: 20,
    psaId: "HALO-1055",
    pax8CompanyId: "PX-21408",
  },
  {
    ref: "summit",
    name: "Summit Property Management",
    status: "active",
    markupPct: 18,
    psaId: "HALO-1033",
    pax8CompanyId: "PX-20377",
  },
  {
    ref: "lakeside",
    name: "Lakeside Veterinary",
    status: "active",
    markupPct: 20,
    psaId: "HALO-1060",
    pax8CompanyId: "PX-21590",
  },
  {
    ref: "northwind",
    name: "Northwind Accounting",
    status: "active",
    markupPct: 22,
    psaId: "HALO-1019",
    pax8CompanyId: "PX-20005",
  },
];

const price = (costCents: number, markupPct: number) =>
  Math.round(costCents * (1 + markupPct / 100));

// Distributor unit costs (cents/month).
const cost = {
  basic: 600,
  standard: 1250,
  premium: 2200,
  e3: 3600,
  exchange: 400,
  defender: 300,
  teamsPhone: 1000,
  copilot: 3000,
} as const;

export const demoAgreements: DemoAgreement[] = [
  // Harbor: 4 Premium seats added on the bill, agreement still says 38.
  {
    clientRef: "harbor",
    sku: "CFQ7TTC0LCHC",
    productName: "Microsoft 365 Business Premium",
    quantity: 38,
    unitPriceCents: price(cost.premium, 20),
  },
  {
    clientRef: "harbor",
    sku: "CFQ7TTC0HCZS",
    productName: "Microsoft Defender for Business",
    quantity: 42,
    unitPriceCents: price(cost.defender, 20),
  },
  // Keystone: still billing the pre-NCE-increase price for Standard.
  {
    clientRef: "keystone",
    sku: "CFQ7TTC0LDPB",
    productName: "Microsoft 365 Business Standard",
    quantity: 60,
    unitPriceCents: 1440,
  },
  {
    clientRef: "keystone",
    sku: "CFQ7TTC0LH1G",
    productName: "Exchange Online (Plan 1)",
    quantity: 12,
    unitPriceCents: price(cost.exchange, 20),
  },
  // Ridgeway: invoiced for 25 Premium, only 22 exist after two leavers.
  {
    clientRef: "ridgeway",
    sku: "CFQ7TTC0LCHC",
    productName: "Microsoft 365 Business Premium",
    quantity: 25,
    unitPriceCents: price(cost.premium, 25),
  },
  // Copperline: Copilot added in Pax8, never added to the agreement.
  {
    clientRef: "copperline",
    sku: "CFQ7TTC0LDPB",
    productName: "Microsoft 365 Business Standard",
    quantity: 31,
    unitPriceCents: price(cost.standard, 20),
  },
  // Summit: clean.
  {
    clientRef: "summit",
    sku: "CFQ7TTC0LCHC",
    productName: "Microsoft 365 Business Premium",
    quantity: 18,
    unitPriceCents: price(cost.premium, 18),
  },
  {
    clientRef: "summit",
    sku: "CFQ7TTC0HCZS",
    productName: "Microsoft Defender for Business",
    quantity: 18,
    unitPriceCents: price(cost.defender, 18),
  },
  // Lakeside: clean.
  {
    clientRef: "lakeside",
    sku: "CFQ7TTC0LH18",
    productName: "Microsoft 365 Business Basic",
    quantity: 14,
    unitPriceCents: price(cost.basic, 20),
  },
  // Northwind: Teams Phone on the agreement, cancelled at Pax8 months ago.
  {
    clientRef: "northwind",
    sku: "CFQ7TTC0LFLX",
    productName: "Microsoft 365 E3",
    quantity: 26,
    unitPriceCents: price(cost.e3, 22),
  },
  {
    clientRef: "northwind",
    sku: "CFQ7TTC0J1FV",
    productName: "Microsoft Teams Phone Standard",
    quantity: 8,
    unitPriceCents: price(cost.teamsPhone, 22),
  },
];

const money = (cents: number) => (cents / 100).toFixed(2);

const csvRows: [string, string, string, string, number, number, string][] = [
  [
    "PX-20931",
    "Harbor Dental Group",
    "CFQ7TTC0LCHC",
    "Microsoft 365 Business Premium",
    42,
    cost.premium,
    "Monthly",
  ],
  [
    "PX-20931",
    "Harbor Dental Group",
    "CFQ7TTC0HCZS",
    "Microsoft Defender for Business",
    42,
    cost.defender,
    "Monthly",
  ],
  [
    "PX-20944",
    "Keystone Logistics",
    "CFQ7TTC0LDPB",
    "Microsoft 365 Business Standard",
    60,
    cost.standard,
    "Annual",
  ],
  [
    "PX-20944",
    "Keystone Logistics",
    "CFQ7TTC0LH1G",
    "Exchange Online (Plan 1)",
    12,
    cost.exchange,
    "Monthly",
  ],
  [
    "PX-19870",
    "Bright Path Tutoring",
    "CFQ7TTC0LH18",
    "Microsoft 365 Business Basic",
    15,
    cost.basic,
    "Annual",
  ],
  [
    "PX-19870",
    "Bright Path Tutoring",
    "CFQ7TTC0LH1G",
    "Exchange Online (Plan 1)",
    6,
    cost.exchange,
    "Monthly",
  ],
  [
    "PX-20112",
    "Ridgeway Law LLP",
    "CFQ7TTC0LCHC",
    "Microsoft 365 Business Premium",
    22,
    cost.premium,
    "Annual",
  ],
  [
    "PX-21408",
    "Copperline Builders",
    "CFQ7TTC0LDPB",
    "Microsoft 365 Business Standard",
    31,
    cost.standard,
    "Monthly",
  ],
  [
    "PX-21408",
    "Copperline Builders",
    "CFQ7TTC0MM8R",
    "Microsoft 365 Copilot",
    5,
    cost.copilot,
    "Annual",
  ],
  [
    "PX-20377",
    "Summit Property Management",
    "CFQ7TTC0LCHC",
    "Microsoft 365 Business Premium",
    18,
    cost.premium,
    "Annual",
  ],
  [
    "PX-20377",
    "Summit Property Management",
    "CFQ7TTC0HCZS",
    "Microsoft Defender for Business",
    18,
    cost.defender,
    "Monthly",
  ],
  [
    "PX-21590",
    "Lakeside Veterinary",
    "CFQ7TTC0LH18",
    "Microsoft 365 Business Basic",
    14,
    cost.basic,
    "Monthly",
  ],
  [
    "PX-20005",
    "Northwind Accounting",
    "CFQ7TTC0LFLX",
    "Microsoft 365 E3",
    26,
    cost.e3,
    "Annual",
  ],
  // Nobody mapped this customer to a PSA client.
  [
    "PX-21777",
    "Maple & Co. Bakery",
    "CFQ7TTC0LDPB",
    "Microsoft 365 Business Standard",
    9,
    cost.standard,
    "Monthly",
  ],
];

export const demoPax8Csv = [
  "Invoice Date,Company ID,Company Name,SKU,Product Name,Quantity,Unit Price,Total,Billing Term",
  ...csvRows.map(([id, name, sku, product, qty, unitCents, term]) =>
    [
      "2026-11-01",
      id,
      `"${name}"`,
      sku,
      `"${product}"`,
      qty,
      money(unitCents),
      money(unitCents * qty),
      term,
    ].join(","),
  ),
].join("\n");
