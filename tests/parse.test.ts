import { describe, expect, it } from "vitest";
import { parseAmcFile, parseSheetRows, findDate } from "../src/core/parseAmc";
import { parseCapFile, parseCapRows } from "../src/core/parseCaps";
import { kindFromIsin } from "../src/core/isin";
import { macroSector } from "../src/core/sectors";
import * as F from "./fixtures";

const byKey = (s: NonNullable<ReturnType<typeof parseSheetRows>>, k: string) => s.holdings.find((h) => h.key === k);

describe("parseSheetRows", () => {
  it("reads a SEBI-style sheet: name, date, sections, totals", () => {
    const s = parseSheetRows(F.sebiStyle, "SCH1")!;
    expect(s.name).toBe("Alpha Bluechip Fund");
    expect(s.asOf).toBe("2026-10-31");
    expect(byKey(s, "INE111A01018")).toMatchObject({ kind: "equity", pct: 50, industry: "Banks" });
    expect(byKey(s, "INE444D07015")?.kind).toBe("debt");
    expect(s.holdings.find((h) => h.name === "Triparty Repo")?.kind).toBe("cash");
    expect(s.holdings.some((h) => /total/i.test(h.name))).toBe(false);
    expect(s.coverage).toBeCloseTo(100, 5);
    expect(s.warnings).toEqual([]);
  });

  it("handles a different column order, fractions and foreign ISINs", () => {
    const s = parseSheetRows(F.iciciStyle, "Sheet1")!;
    expect(s.name).toBe("Beta Flexicap Fund (An open ended equity scheme)");
    expect(s.asOf).toBe("2026-10-31");
    expect(byKey(s, "INE111A01018")?.pct).toBeCloseTo(55, 5);
    expect(byKey(s, "US0000000007")?.kind).toBe("equity");
    expect(s.holdings.find((h) => h.name === "Net Current Assets")?.kind).toBe("cash");
    expect(s.warnings.join(" ")).toMatch(/fractions/);
  });

  it("derives % to NAV from market value when there is no % column", () => {
    const s = parseSheetRows(F.valueOnly, "X")!;
    expect(byKey(s, "INE111A01018")?.pct).toBeCloseTo(60, 5);
    expect(byKey(s, "INE222B01016")?.pct).toBeCloseTo(30, 5);
    expect(s.asOf).toBe("2026-09-30");
  });

  it("accepts percent strings and does not rescale them", () => {
    const s = parseSheetRows(F.percentStrings, "X")!;
    expect(byKey(s, "INE111A01018")?.pct).toBe(60);
    expect(s.warnings).toEqual([]);
  });

  it("tags futures as derivatives with negative weights", () => {
    const s = parseSheetRows(F.hedged, "X")!;
    const d = s.holdings.filter((h) => h.kind === "derivative");
    expect(d).toHaveLength(2);
    expect(d.every((h) => h.pct < 0)).toBe(true);
  });

  it("returns null for sheets that are not portfolios", () => {
    expect(parseSheetRows(F.indexSheet, "Index")).toBeNull();
  });
});

describe("parseAmcFile (xlsx round trip)", () => {
  it("skips the index sheet and finds every scheme sheet", () => {
    const buf = F.workbookBuffer({ Index: F.indexSheet, SCH1: F.sebiStyle, SCH2: F.iciciStyle });
    const out = parseAmcFile(buf);
    expect(out.map((s) => s.sheet)).toEqual(["SCH1", "SCH2"]);
    expect(out[0].holdings.length).toBeGreaterThan(5);
  });
});

describe("caps", () => {
  it("maps ISIN to L/M/S regardless of column positions", () => {
    expect(parseCapRows(F.capRows)).toEqual({ INE111A01018: "L", INE222B01016: "M", INE333C01014: "S" });
    const out = parseCapFile(F.workbookBuffer({ List: F.capRows }));
    expect(out.INE111A01018).toBe("L");
  });
});

describe("helpers", () => {
  it("classifies ISINs", () => {
    expect(kindFromIsin("INE111A01018")).toBe("equity");
    expect(kindFromIsin("INE444D07015")).toBe("debt");
    expect(kindFromIsin("INF000A01011")).toBe("units");
    expect(kindFromIsin("IN0020240012")).toBe("debt");
    expect(kindFromIsin("US0000000007")).toBe("equity");
  });
  it("finds dates in several spellings", () => {
    expect(findDate("as on 31st October 2026")).toBe("2026-10-31");
    expect(findDate("October 31, 2026")).toBe("2026-10-31");
    expect(findDate("as at 30/09/2026")).toBe("2026-09-30");
    expect(findDate("nothing here")).toBeUndefined();
  });
  it("folds AMFI industries into macro sectors", () => {
    expect(macroSector("Banks")).toBe("Financials");
    expect(macroSector("IT - Software")).toBe("Technology");
    expect(macroSector("Pharmaceuticals & Biotechnology")).toBe("Healthcare");
    expect(macroSector("Auto Components")).toBe("Auto");
    expect(macroSector("Petroleum Products")).toBe("Energy & Power");
    expect(macroSector("Diversified FMCG")).toBe("Consumer");
    expect(macroSector("Cement & Cement Products")).toBe("Materials");
    expect(macroSector(undefined)).toBe("Other");
  });
});
