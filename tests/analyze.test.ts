import { describe, expect, it } from "vitest";
import { analyze } from "../src/core/analyze";
import type { Holding, Scheme } from "../src/core/types";

const eq = (key: string, pct: number, industry = "Banks"): Holding => ({ key, isin: key, name: key, kind: "equity", pct, industry });
const scheme = (id: string, holdings: Holding[]): Scheme => ({ id, name: id, amc: "T", holdings });

describe("analyze", () => {
  const schemes = {
    f1: scheme("f1", [eq("INA", 50), eq("INB", 30), eq("INC", 20)]),
    f2: scheme("f2", [eq("INA", 20), eq("INB", 30), eq("IND", 50)]),
  };
  const a = analyze(
    [
      { schemeId: "f1", amount: 100_000 },
      { schemeId: "f2", amount: 100_000 },
    ],
    schemes,
    { INA: "L", INB: "M" },
  );

  it("adds up look-through exposure per stock", () => {
    expect(a.total).toBe(200_000);
    const A = a.stocks.find((s) => s.key === "INA")!;
    expect(A.exposure).toBeCloseTo(70_000);
    expect(A.fundCount).toBe(2);
    expect(A.share).toBeCloseTo(0.35);
  });

  it("computes overlap as sum of min weights", () => {
    expect(a.overlap[0][1]).toBeCloseTo(0.5); // min(50,20)+min(30,30)
    expect(a.overlap[1][0]).toBeCloseTo(0.5);
    expect(a.overlap[0][0]).toBe(1);
    expect(a.topPairs[0]).toMatchObject({ a: 0, b: 1, shared: 2 });
  });

  it("measures redundancy and effective stock count", () => {
    // A (70k) + B (60k) are held twice, out of 200k equity
    expect(a.redundancy).toBeCloseTo(130 / 200);
    // shares: .35 .30 .10 .25 -> HHI = .1225+.09+.01+.0625 = .285
    expect(a.effectiveStocks).toBeCloseTo(1 / 0.285, 4);
    expect(a.uniqueStocks).toBe(4);
  });

  it("splits the portfolio by cap using the AMFI map, unknowns stay unclassified", () => {
    expect(a.mix.L).toBeCloseTo(70_000);
    expect(a.mix.M).toBeCloseTo(60_000);
    expect(a.mix.U).toBeCloseTo(70_000); // C and D
    expect(Object.values(a.mix).reduce((x, y) => x + y, 0)).toBeCloseTo(200_000);
  });

  it("treats a fully hedged fund as hedged money, not stock exposure", () => {
    const h = scheme("h", [eq("INA", 60), eq("INB", 30), { key: "fut", name: "fut", kind: "derivative", pct: -90 }, { key: "c", name: "repo", kind: "cash", pct: 10 }]);
    const r = analyze([{ schemeId: "h", amount: 100_000 }], { h });
    expect(r.stocks).toHaveLength(0);
    expect(r.mix.hedged).toBeCloseTo(90_000);
    expect(r.mix.cash).toBeCloseTo(10_000);
  });

  it("puts debt, cash and unexplained remainder into their own buckets", () => {
    const m = scheme("m", [eq("INA", 60), { key: "d", name: "ncd", kind: "debt", pct: 25 }, { key: "c", name: "cash", kind: "cash", pct: 5 }]);
    const r = analyze([{ schemeId: "m", amount: 100_000 }], { m });
    expect(r.mix.debt).toBeCloseTo(25_000);
    expect(r.mix.cash).toBeCloseTo(5_000);
    expect(r.mix.other).toBeCloseTo(10_000);
  });

  it("ignores positions with zero amount or unknown scheme", () => {
    const r = analyze([{ schemeId: "nope", amount: 5 }, { schemeId: "f1", amount: 0 }], schemes);
    expect(r.total).toBe(0);
    expect(r.funds).toHaveLength(0);
  });
});
