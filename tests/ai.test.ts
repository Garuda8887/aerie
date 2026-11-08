import { describe, expect, it } from "vitest";
import { buildContext } from "../src/core/ai";
import { analyze } from "../src/core/analyze";
import { demoPortfolio } from "../src/core/demo";

describe("buildContext", () => {
  const d = demoPortfolio();
  const a = analyze(d.positions, Object.fromEntries(d.schemes.map((s) => [s.id, s])));
  const text = buildContext(a);

  it("names every fund and the top stock", () => {
    expect(text).toContain("Funds (" + a.funds.length + ")");
    expect(text).toContain(a.stocks[0].name);
  });

  it("never leaks rupee amounts", () => {
    expect(text).not.toContain("₹");
    for (const f of a.funds) expect(text).not.toContain(String(Math.round(f.amount)));
  });

  it("handles an empty portfolio", () => {
    expect(buildContext(analyze([], {}))).toBe("The portfolio is empty.");
  });
});
