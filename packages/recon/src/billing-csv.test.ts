import { describe, expect, test } from "bun:test";
import {
  applySkuAliases,
  billedLinesToAgreements,
  normalizeClientName,
  parseBillingCsv,
  skuAliasKey,
} from "./billing-csv";
import { CsvFormatError, parsePax8Csv } from "./pax8-csv";
import { reconcile } from "./reconcile";
import type { Client } from "./types";

describe("parseBillingCsv", () => {
  test("reads the generic columns, currency strings and an optional period", () => {
    const { lines, errors } = parseBillingCsv(
      '﻿Client,SKU,Product Name,Quantity,Unit Price,Period\r\n"Acme, Inc",BP,Business Premium,"1,200","$1,234.50",2026-11\r\n',
    );
    expect(errors).toEqual([]);
    expect(lines).toEqual([
      {
        rowNumber: 2,
        clientName: "Acme, Inc",
        sku: "BP",
        productName: "Business Premium",
        quantity: 1200,
        unitPriceCents: 123450,
        period: "2026-11",
      },
    ]);
  });

  test("accepts ConnectWise, Autotask and HaloPSA style headers (assumed names)", () => {
    const connectwise = parseBillingCsv(
      "Company Name,Product ID,Description,Quantity,Unit Price\nAcme,BP,Business Premium,3,26.40",
    );
    const autotask = parseBillingCsv(
      "Account Name,Service Code,Service Name,Units,Unit Charge\nAcme,BP,Business Premium,3,26.40",
    );
    const halo = parseBillingCsv(
      "client_name,item_code,description,qty,price\nAcme,BP,Business Premium,3,€26.40",
    );
    for (const { lines, errors } of [connectwise, autotask, halo]) {
      expect(errors).toEqual([]);
      expect(lines).toMatchObject([
        { clientName: "Acme", sku: "BP", quantity: 3, unitPriceCents: 2640 },
      ]);
    }
  });

  test("reports every bad row with its row number and skips totals rows", () => {
    const { lines, errors } = parseBillingCsv(
      [
        "Client,SKU,Qty,Unit Price",
        "Acme,BP,2.5,10",
        ",BP,1,10",
        "Acme,,1,10",
        "Acme,BP,1,abc",
        "Acme,BP,1,",
        "Acme,BP,1,-5",
        "Acme,BP,-1,5",
        "Acme,BP,4,$10.00",
        ",,,$999.00",
      ].join("\n"),
    );
    expect(lines.map((line) => line.rowNumber)).toEqual([9]);
    expect(errors.map((error) => error.rowNumber)).toEqual([
      2, 3, 4, 5, 6, 7, 8,
    ]);
    expect(errors[0]?.message).toContain("whole number");
    expect(errors[3]?.message).toContain("not a price");
  });

  test("rejects missing columns and multi-period files", () => {
    expect(() => parseBillingCsv("")).toThrow(CsvFormatError);
    expect(() => parseBillingCsv("Client,SKU,Quantity\nA,B,1")).toThrow(
      "Missing columns: unit price",
    );
    // Distributor cost columns are not mistaken for a billed price.
    expect(() => parseBillingCsv("Client,SKU,Quantity,Cost\nA,B,1,10")).toThrow(
      "unit price",
    );
    expect(() =>
      parseBillingCsv(
        "Client,SKU,Qty,Price,Period\nA,B,1,10,2026-10\nA,B,1,10,2026-11",
      ),
    ).toThrow("2 billing periods");
  });
});

describe("billedLinesToAgreements", () => {
  test("sums duplicate client + SKU lines at a weighted price and returns unmatched rows", () => {
    const { lines } = parseBillingCsv(
      "Client,SKU,Qty,Price\nAcme,BP,2,20\nACME ,BP,2,30\nNobody,BP,1,10",
    );
    const ids = new Map([["acme", "c1"]]);
    const result = billedLinesToAgreements(lines, (name) =>
      ids.get(normalizeClientName(name)),
    );
    expect(result.agreements).toEqual([
      {
        clientId: "c1",
        sku: "BP",
        productName: "BP",
        quantity: 4,
        unitPriceCents: 2500,
      },
    ]);
    expect(result.unmatched.map((line) => line.clientName)).toEqual(["Nobody"]);
  });
});

describe("Pax8 bill + client billing export, end to end", () => {
  test("a real upload yields stale_price, unbilled_seats and overbilled", () => {
    const vendorLines = parsePax8Csv(
      [
        "Company ID,Company Name,SKU,Product Name,Quantity,Cost",
        "PX-1,Acme Pax8,BP,Business Premium,12,$22.00",
        "PX-1,Acme Pax8,E3,Office 365 E3,5,$23.00",
        "PX-2,Beta Pax8,BS,Business Standard,4,$12.50",
      ].join("\n"),
    );
    const clients: Client[] = [
      { id: "c1", name: "Acme Corp", status: "active", markupPct: 20 },
      { id: "c2", name: "Beta LLC", status: "active", markupPct: 20 },
    ];
    const { lines, errors } = parseBillingCsv(
      [
        "Company Name,Product ID,Description,Quantity,Unit Price,Period",
        // 10 billed vs 12 on the bill → unbilled_seats.
        "Acme Corp,BP,Business Premium,10,$26.40,2026-11",
        // Billed at $25.00 vs cost $23.00 + 20% = $27.60 → stale_price.
        "Acme Corp,E3,Office 365 E3,5,$25.00,2026-11",
        // 6 billed vs 4 on the bill → overbilled.
        "beta llc,BS,Business Standard,6,$15.00,2026-11",
        // Billed with no licence at all → overbilled.
        "Beta LLC,TEAMS,Teams Phone,2,$10.00,2026-11",
      ].join("\n"),
    );
    expect(errors).toEqual([]);
    const byName = new Map(
      clients.map((client) => [normalizeClientName(client.name), client.id]),
    );
    const { agreements, unmatched } = billedLinesToAgreements(lines, (name) =>
      byName.get(normalizeClientName(name)),
    );
    expect(unmatched).toEqual([]);

    const exceptions = reconcile({
      vendorLines,
      clients,
      mappings: [
        { customerKey: "PX-1", clientId: "c1" },
        { customerKey: "PX-2", clientId: "c2" },
      ],
      agreements,
    });
    expect(
      exceptions
        .map((exception) => [
          exception.kind,
          exception.sku,
          exception.monthlyImpactCents,
        ])
        .sort(),
    ).toEqual(
      [
        ["unbilled_seats", "BP", 2 * 2640],
        ["stale_price", "E3", 5 * (2760 - 2500)],
        ["overbilled", "BS", 2 * 1500],
        ["overbilled", "TEAMS", 2 * 1000],
      ].sort(),
    );
  });
});

describe("applySkuAliases", () => {
  const vendorLines = parsePax8Csv(
    "Company ID,Company Name,SKU,Product Name,Quantity,Cost\nPX-1,Acme,CFQ7TTC0LCHC,Business Premium,10,$22.00",
  );
  const clients: Client[] = [
    { id: "c1", name: "Acme", status: "active", markupPct: 20 },
  ];
  const premium = {
    clientId: "c1",
    sku: "M365-BP",
    productName: "Business Premium",
    quantity: 10,
    unitPriceCents: 2640,
  };
  const billed = [
    // PSA product ID differs from the Pax8 SKU.
    premium,
    // Managed services: not on the distributor bill at all.
    {
      clientId: "c1",
      sku: "MSP-GOLD",
      productName: "Managed Services Gold",
      quantity: 1,
      unitPriceCents: 150000,
    },
  ];
  const run = (aliases: Map<string, string>) =>
    reconcile({
      vendorLines,
      clients,
      mappings: [{ customerKey: "PX-1", clientId: "c1" }],
      agreements: applySkuAliases(billed, aliases),
    }).map((exception) => `${exception.kind}:${exception.sku}`);

  test("without aliases the PSA SKU looks unbilled and overbilled", () => {
    expect(run(new Map()).sort()).toEqual([
      "overbilled:M365-BP",
      "overbilled:MSP-GOLD",
      "unbilled_seats:CFQ7TTC0LCHC",
    ]);
  });

  test("an aliased SKU (or name) gives no false unbilled or overbilled", () => {
    expect(
      run(
        new Map([
          [skuAliasKey("m365 bp"), "CFQ7TTC0LCHC"],
          [skuAliasKey("Managed Services Gold"), ""],
        ]),
      ),
    ).toEqual([]);
  });

  test("lines aliased onto one SKU are summed", () => {
    expect(
      applySkuAliases(
        [
          { ...premium, quantity: 4, unitPriceCents: 2000 },
          { ...premium, sku: "BP-2", quantity: 4, unitPriceCents: 3000 },
        ],
        new Map([
          ["m365bp", "X"],
          ["bp2", "X"],
        ]),
      ),
    ).toEqual([
      {
        clientId: "c1",
        sku: "X",
        productName: "Business Premium",
        quantity: 8,
        unitPriceCents: 2500,
      },
    ]);
  });
});
