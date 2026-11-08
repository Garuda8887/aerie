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

  it("rejects an export whose schemes have no holdings instead of crashing later", () => {
    const bad = JSON.stringify({ app: "aerie", schemes: { a: { id: "a" } }, positions: [{ schemeId: "a", amount: 5 }] });
    expect(parseExport(bad)).toBeNull();
  });
});
