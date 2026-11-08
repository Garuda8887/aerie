import { describe, expect, it } from "vitest";
import { analyze } from "../src/core/analyze";
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

  it("rejects an export whose schemes have no holdings instead of crashing later", () => {
    const bad = JSON.stringify({ app: "aerie", schemes: { a: { id: "a" } }, positions: [{ schemeId: "a", amount: 5 }] });
    expect(parseExport(bad)).toBeNull();
  });
});
