import { describe, expect, test } from "bun:test";
import { demoAgreements, demoClients, demoPax8Csv } from "./demo";
import { CsvFormatError, parseCsv, parsePax8Csv } from "./pax8-csv";
import { expectedUnitPrice, leakageTotal, reconcile } from "./reconcile";
import type { Client, ReconInput, VendorLine } from "./types";

const client: Client = {
  id: "c1",
  name: "Acme",
  status: "active",
  markupPct: 20,
};
const line = (overrides: Partial<VendorLine> = {}): VendorLine => ({
  customerKey: "PX-1",
  customerName: "Acme",
  sku: "BP",
  productName: "Business Premium",
  quantity: 10,
  unitCostCents: 2200,
  billingTerm: "Monthly",
  ...overrides,
});
const input = (overrides: Partial<ReconInput> = {}): ReconInput => ({
  vendorLines: [line()],
  clients: [client],
  mappings: [{ customerKey: "PX-1", clientId: "c1" }],
  agreements: [
    { clientId: "c1", sku: "BP", quantity: 10, unitPriceCents: 2640 },
  ],
  ...overrides,
});

describe("reconcile", () => {
  test("matching bill and agreement produce no exceptions", () => {
    expect(reconcile(input())).toEqual([]);
  });

  test("unbilled seats are priced at cost plus markup", () => {
    const [exception] = reconcile(
      input({ vendorLines: [line({ quantity: 13 })] }),
    );
    expect(exception?.kind).toBe("unbilled_seats");
    expect(exception?.monthlyImpactCents).toBe(3 * 2640);
  });

  test("SKU with no agreement line is fully unbilled", () => {
    const [exception] = reconcile(input({ agreements: [] }));
    expect(exception?.kind).toBe("unbilled_seats");
    expect(exception?.monthlyImpactCents).toBe(10 * 2640);
  });

  test("stale price flags the gap on billed seats only", () => {
    const [exception] = reconcile(
      input({
        agreements: [
          { clientId: "c1", sku: "BP", quantity: 10, unitPriceCents: 2500 },
        ],
      }),
    );
    expect(exception?.kind).toBe("stale_price");
    expect(exception?.monthlyImpactCents).toBe(10 * 140);
  });

  test("price within rounding tolerance is not stale", () => {
    const result = reconcile(
      input({
        agreements: [
          { clientId: "c1", sku: "BP", quantity: 10, unitPriceCents: 2630 },
        ],
      }),
    );
    expect(result).toEqual([]);
  });

  test("offboarded client yields a ghost licence at full cost", () => {
    const [exception, ...rest] = reconcile(
      input({ clients: [{ ...client, status: "offboarded" }] }),
    );
    expect(rest).toEqual([]);
    expect(exception?.kind).toBe("ghost_license");
    expect(exception?.monthlyImpactCents).toBe(10 * 2200);
  });

  test("billing more seats than exist is overbilled", () => {
    const [exception] = reconcile(
      input({ vendorLines: [line({ quantity: 8 })] }),
    );
    expect(exception?.kind).toBe("overbilled");
    expect(exception?.monthlyImpactCents).toBe(2 * 2640);
  });

  test("agreement line with no licence at all is overbilled", () => {
    const [exception] = reconcile(input({ vendorLines: [] }));
    expect(exception?.kind).toBe("overbilled");
    expect(exception?.vendorQuantity).toBe(0);
    expect(exception?.monthlyImpactCents).toBe(10 * 2640);
  });

  test("unmapped customer is reported at distributor cost", () => {
    const result = reconcile(input({ mappings: [] }));
    // The client's agreement now has no licence behind it, so it surfaces too.
    expect(result.map((exception) => exception.kind).sort()).toEqual([
      "overbilled",
      "unmapped_customer",
    ]);
    const exception = result.find(
      (candidate) => candidate.kind === "unmapped_customer",
    );
    expect(exception?.clientId).toBeNull();
    expect(exception?.monthlyImpactCents).toBe(10 * 2200);
  });

  test("duplicate vendor lines for one SKU are summed", () => {
    const result = reconcile(
      input({ vendorLines: [line({ quantity: 6 }), line({ quantity: 4 })] }),
    );
    expect(result).toEqual([]);
  });

  test("results sort by impact and leakage excludes overbilled", () => {
    const result = reconcile(
      input({
        vendorLines: [line({ quantity: 12 }), line({ sku: "X", quantity: 1 })],
        agreements: [
          { clientId: "c1", sku: "BP", quantity: 10, unitPriceCents: 2640 },
          { clientId: "c1", sku: "OLD", quantity: 5, unitPriceCents: 1000 },
        ],
      }),
    );
    expect(result.map((exception) => exception.monthlyImpactCents)).toEqual([
      5280, 5000, 2640,
    ]);
    expect(leakageTotal(result)).toBe(5280 + 2640);
  });

  test("expected price rounds to whole cents", () => {
    expect(expectedUnitPrice(1250, 18)).toBe(1475);
    expect(expectedUnitPrice(333, 15)).toBe(383);
  });
});

describe("parsePax8Csv", () => {
  test("handles quotes, CRLF and BOM", () => {
    const rows = parseCsv('﻿a,"b, ""c"""\r\n1,2\r\n');
    expect(rows).toEqual([
      ["﻿a", 'b, "c"'],
      ["1", "2"],
    ]);
  });

  test("maps aliased headers and money to cents", () => {
    const lines = parsePax8Csv(
      '﻿Customer ID,Customer Name,Product SKU,Qty,Partner Cost\nPX-9,"Big, Co",S1,3,$12.50\n',
    );
    expect(lines).toEqual([
      {
        customerKey: "PX-9",
        customerName: "Big, Co",
        sku: "S1",
        productName: "S1",
        quantity: 3,
        unitCostCents: 1250,
        billingTerm: "Monthly",
      },
    ]);
  });

  test("rejects missing columns and bad values", () => {
    expect(() => parsePax8Csv("Company ID,SKU\nPX,S")).toThrow(CsvFormatError);
    expect(() =>
      parsePax8Csv(
        "Company ID,Company Name,SKU,Quantity,Unit Price\nPX,A,S,2.5,1",
      ),
    ).toThrow("quantity");
    expect(() =>
      parsePax8Csv(
        "Company ID,Company Name,SKU,Quantity,Unit Price\nPX,A,S,2,abc",
      ),
    ).toThrow("not a price");
  });
});

describe("demo data", () => {
  test("surfaces every planted problem", () => {
    const clients = demoClients.map(({ ref, name, status, markupPct }) => ({
      id: ref,
      name,
      status,
      markupPct,
    }));
    const result = reconcile({
      vendorLines: parsePax8Csv(demoPax8Csv),
      clients,
      mappings: demoClients.map((demo) => ({
        customerKey: demo.pax8CompanyId,
        clientId: demo.ref,
      })),
      agreements: demoAgreements.map(
        ({ clientRef, sku, quantity, unitPriceCents }) => ({
          clientId: clientRef,
          sku,
          quantity,
          unitPriceCents,
        }),
      ),
    });

    const found = result.map(
      (exception) =>
        `${exception.kind}:${exception.clientId ?? exception.customerKey}:${exception.monthlyImpactCents}`,
    );
    expect(found.sort()).toEqual(
      [
        "unbilled_seats:copperline:18000",
        "unmapped_customer:PX-21777:11250",
        "unbilled_seats:harbor:10560",
        "overbilled:northwind:9760",
        "ghost_license:brightpath:9000",
        "overbilled:ridgeway:8250",
        "stale_price:keystone:3600",
        "ghost_license:brightpath:2400",
      ].sort(),
    );
    expect(leakageTotal(result)).toBe(54810);
  });
});

describe("distributor export variants", () => {
  test("prefers Pax8 cost over SRP price", () => {
    const [line] = parsePax8Csv(
      "companyId,companyName,sku,quantity,price,cost\nPX,A,S,2,15.00,12.50",
    );
    expect(line?.unitCostCents).toBe(1250);
  });

  test("reads Partner Center reconciliation columns", () => {
    const [line] = parsePax8Csv(
      "CustomerId,CustomerName,SkuId,SkuName,Quantity,BillableQuantity,UnitPrice,EffectiveUnitPrice,TermAndBillingCycle\nT1,Acme,0002,Business Premium,'1,'7,'24.00,'22.00,1 Year Monthly",
    );
    expect(line).toMatchObject({
      customerKey: "T1",
      sku: "0002",
      productName: "Business Premium",
      quantity: 7,
      unitCostCents: 2200,
      billingTerm: "1 Year Monthly",
    });
  });
});
