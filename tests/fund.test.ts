import { describe, expect, it } from "vitest";
import { searchFunds, toParsed, type FundEntry } from "../src/core/fundData";

const e = (id: string, name: string, amc = "PPFAS Mutual Fund"): FundEntry => ({ id, name, amc, asOf: "2026-09-30", path: `x/${id}.json` });
const list = [e("a", "Parag Parikh Flexi Cap Fund"), e("b", "Parag Parikh Liquid Fund"), e("c", "Axis Bluechip Fund", "Axis Mutual Fund")];

describe("find a fund", () => {
  it("matches every typed word against fund and AMC name", () => {
    expect(searchFunds(list, "flexi cap").map((f) => f.id)).toEqual(["a"]);
    expect(searchFunds(list, "parag").map((f) => f.id)).toEqual(["a", "b"]);
    expect(searchFunds(list, "axis fund").map((f) => f.id)).toEqual(["c"]);
    expect(searchFunds(list, "").length).toBe(3);
    expect(searchFunds(list, "nothing here")).toEqual([]);
  });

  it("turns a data file into a parsed scheme and rejects malformed ones", () => {
    const ok = toParsed({ holdings: [{ key: "INE1", name: "X", kind: "equity", pct: 60 }, { key: "t", name: "Cash", kind: "cash", pct: 40 }] }, list[0]);
    expect(ok.coverage).toBe(100);
    expect(ok.name).toBe("Parag Parikh Flexi Cap Fund");
    expect(() => toParsed({ holdings: [] }, list[0])).toThrow();
    expect(() => toParsed({ holdings: [{ key: "k", name: "X", kind: "bogus", pct: 1 }] }, list[0])).toThrow();
    expect(() => toParsed({ holdings: [{ key: "k", name: "X", kind: "equity", pct: "5" }] }, list[0])).toThrow();
  });
});
