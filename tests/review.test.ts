import { describe, expect, it } from "vitest";
import { analyze } from "../src/core/analyze";
import { parseSheetRows } from "../src/core/parseAmc";
import { parseExport } from "../src/core/store";
import type { Scheme } from "../src/core/types";

describe("review fixes", () => {
  it("a negative net-receivables line does not push a fund's mix past 100%", () => {
    const s: Scheme = {
      id: "a",
      name: "Arb Fund",
      amc: "X",
      holdings: [
        { key: "INE002A01018", isin: "INE002A01018", name: "Reliance", kind: "equity", pct: 98 },
        { key: "recv", name: "Net receivables", kind: "cash", pct: -2 },
      ],
    };
    const a = analyze([{ schemeId: "a", amount: 1000 }], { a: s });
    const sum = Object.values(a.funds[0].mix).reduce((x, y) => x + y, 0);
    expect(sum).toBeCloseTo(1000, 6);
  });

  it("parser: banner, stray subtotal, ISIN-bearing company line and overseas bond", () => {
    const rows = [
      ["Delta Mutual Fund"],
      ["Delta Bluechip Fund - Monthly Portfolio Statement as on October 31, 2026"],
      [],
      ["Name of the Instrument", "ISIN", "Industry / Rating", "Quantity", "Market/Fair Value (Rs. in Lacs.)", "% to NAV"],
      ["Equity & Equity related"],
      ["Test Bank Ltd", "INE111A01018", "Banks", 1000, 500, 60],
      ["Future Retail Ltd", "INE555E01014", null, null, null, null], // name contains "future": must not open a derivatives section
      ["Demo Software Ltd", "INE222B01016", "IT - Software", 800, 300, 30],
      ["Equity & Equity related - Total", null, null, null, 800, 90],
      ["Debt Instruments"],
      ["Overseas Bond", "XS0000000009", "Rating", 1, 50, 10],
      ["Grand Total", null, null, null, 1000, 100],
    ];
    const s = parseSheetRows(rows, "S")!;
    expect(s.name).toBe("Delta Bluechip Fund");
    expect(s.holdings.find((h) => h.key === "INE222B01016")?.kind).toBe("equity");
    expect(s.holdings.some((h) => /total/i.test(h.name))).toBe(false);
    expect(s.holdings.find((h) => h.key === "XS0000000009")?.kind).toBe("debt");
    expect(s.coverage).toBeCloseTo(100, 5);
  });

  // Layout copied from a real PPFAS file: fractions, "$0.00%" for tiny positions, then notes and a performance table.
  it("parser: real-file quirks (text '$0.00%' cell, tables below GRAND TOTAL)", () => {
    const rows = [
      [null, "Parag Parikh Test Fund (An open ended scheme)"],
      [null, "Monthly Portfolio Statement as on September 30, 2026"],
      [null, "Name of the Instrument", "ISIN", "Industry / Rating", "Quantity", "Market/Fair Value\r\n (Rs. in Lakhs)", "% to Net\r\n Assets"],
      [null, "Equity & Equity related"],
      ["A1", "Test Bank Limited", "INE040A01034", "Banks", 100, 600, 0.6],
      ["A2", "Demo Power Limited", "INE752E01010", "Power", 100, 300, 0.3],
      ["A3", "Tiny Motors Limited", "INE208A01029", "Autos", 5, 1, "$0.00%"],
      [null, "Sub Total", null, null, null, 901, 0.9],
      [null, "Reverse Repo / TREPS"],
      ["T1", "TRP_011026", null, " ", null, 100, 0.1],
      [null, "GRAND TOTAL", null, null, null, 1001, 1],
      [null, "Lumpsum Investment Performance"],
      [null, "Since Inception (24 July, 2019)", 0.15, 0.16, 0.14, 0.11, 28148.9],
      [null, "Market value of Investment", null, null, null, 262.2, 0.5],
    ];
    const s = parseSheetRows(rows, "S")!;
    expect(s.coverage).toBeCloseTo(100, 1);
    expect(s.holdings.some((h) => /since inception|market value/i.test(h.name))).toBe(false);
    expect(s.holdings.find((h) => h.key === "INE040A01034")?.pct).toBeCloseTo(60, 5);
  });

  // Layout copied from SBI's all-schemes workbook: label/value header cells, Excel serial date, a "Back to Index" link cell.
  it("parser: label/value header with an Excel serial date", () => {
    const rows = [
      [null, null, "SBI Mutual Fund", "007", null, null, null, null, null, "Back to Index"],
      [null, null, "SCHEME NAME :", "SBI Test Fund"],
      [null, null, "PORTFOLIO STATEMENT AS ON :", 46326],
      [null, null, "Name of the Instrument / Issuer", "ISIN", "Rating / Industry^", "Quantity", "Market value\r\n(Rs. in Lakhs)", "% to AUM"],
      [null, null, "EQUITY & EQUITY RELATED"],
      [null, "1", "Test Bank Ltd.", "INE111A01018", "Banks", 1, 600, 60],
      [null, "2", "Demo Soft Ltd", "INE222B01016", "IT - Software", 1, 400, 40],
      [null, null, "Grand Total", null, null, null, 1000, 100],
    ];
    const s = parseSheetRows(rows, "STF")!;
    expect(s.name).toBe("SBI Test Fund");
    expect(s.asOf).toBe("2026-10-31");
    expect(s.coverage).toBeCloseTo(100, 5);
  });

  it("rejects an export whose schemes have no holdings instead of crashing later", () => {
    const bad = JSON.stringify({ app: "aerie", schemes: { a: { id: "a" } }, positions: [{ schemeId: "a", amount: 5 }] });
    expect(parseExport(bad)).toBeNull();
  });
});
