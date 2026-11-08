import { isForeign } from "./isin";
import { MACRO_SECTORS, macroSector, type MacroSector } from "./sectors";
import type { Cap, CapMap, Holding, Position, Scheme } from "./types";

export const MIX_KEYS = ["L", "M", "S", "U", "F", "debt", "cash", "hedged", "other"] as const;
export type MixKey = (typeof MIX_KEYS)[number];
export type Mix = Record<MixKey, number>;
const emptyMix = (): Mix => ({ L: 0, M: 0, S: 0, U: 0, F: 0, debt: 0, cash: 0, hedged: 0, other: 0 });

export interface FundInfo {
  id: string;
  name: string;
  amc: string;
  amount: number;
  /** share of the whole portfolio, 0..1 */
  share: number;
  /** colour slot 0..7 are the validated categorical hues; 8+ fall back to neutral */
  slot: number;
  asOf?: string;
  demo?: boolean;
  /** fraction of the fund's equity that is hedged by short derivatives (arbitrage-style) */
  hedgedFrac: number;
  mix: Mix;
  nHoldings: number;
}

export interface StockAgg {
  key: string;
  name: string;
  industry?: string;
  macro: MacroSector;
  cap: Cap;
  exposure: number;
  /** share of the whole portfolio, 0..1 */
  share: number;
  byFund: Record<string, number>;
  fundCount: number;
}

export interface SectorAgg {
  sector: MacroSector;
  exposure: number;
  byFund: Record<string, number>;
}

export interface Analysis {
  total: number;
  funds: FundInfo[];
  stocks: StockAgg[];
  equityExposure: number;
  uniqueStocks: number;
  effectiveStocks: number;
  /** fraction of equity money sitting in stocks that two or more funds hold */
  redundancy: number;
  mix: Mix;
  sectors: SectorAgg[];
  /** overlap[i][j] in 0..1, same order as `funds` */
  overlap: number[][];
  topPairs: { a: number; b: number; overlap: number; shared: number }[];
}

/** Cap tier for a holding: AMFI list first, then any tier shipped with the data, then foreign/unknown. */
export function resolveCap(h: Holding, capMap: CapMap): Cap {
  return (h.isin && capMap[h.isin]) || h.cap || (isForeign(h.isin) ? "F" : "U");
}

export function analyze(positions: Position[], schemes: Record<string, Scheme>, capMap: CapMap = {}): Analysis {
  const live = positions.filter((p) => schemes[p.schemeId] && p.amount > 0);
  const total = live.reduce((a, p) => a + p.amount, 0);

  const funds: FundInfo[] = [];
  const stockMap = new Map<string, StockAgg>();
  const weights: Map<string, number>[] = []; // per fund: stock key -> net % of NAV
  const mix = emptyMix();

  live.forEach((p, i) => {
    const s = schemes[p.schemeId];
    const fundMix = emptyMix();
    const w = new Map<string, number>();

    let eq = 0, debt = 0, cash = 0, other = 0, deriv = 0;
    for (const h of s.holdings) {
      if (h.kind === "equity") eq += h.pct;
      else if (h.kind === "debt") debt += h.pct;
      else if (h.kind === "cash") cash += h.pct;
      else if (h.kind === "derivative") deriv += h.pct;
      else other += h.pct;
    }
    const hedgedFrac = eq > 0 && deriv < 0 ? Math.min(1, -deriv / eq) : 0;
    // negative net receivables are clamped to 0 in the cash bucket below, so clamp them here too or the mix sums past 100%
    const residual = Math.max(0, 100 - (eq + debt + Math.max(cash, 0) + other));

    for (const h of s.holdings) {
      if (h.kind !== "equity") continue;
      const net = (h.pct * (1 - hedgedFrac)) / 100;
      if (net <= 0) continue;
      const cap = resolveCap(h, capMap);
      const exposure = p.amount * net;
      fundMix[cap] += exposure;
      w.set(h.key, (w.get(h.key) ?? 0) + net * 100);

      let agg = stockMap.get(h.key);
      if (!agg) {
        agg = {
          key: h.key,
          name: h.name,
          industry: h.industry,
          macro: macroSector(h.industry),
          cap,
          exposure: 0,
          share: 0,
          byFund: {},
          fundCount: 0,
        };
        stockMap.set(h.key, agg);
      }
      agg.exposure += exposure;
      agg.byFund[s.id] = (agg.byFund[s.id] ?? 0) + exposure;
    }
    fundMix.hedged = (p.amount * eq * hedgedFrac) / 100;
    fundMix.debt = (p.amount * debt) / 100;
    fundMix.cash = (p.amount * Math.max(cash, 0)) / 100;
    fundMix.other = (p.amount * (other + residual)) / 100;
    for (const k of MIX_KEYS) mix[k] += fundMix[k];

    weights.push(w);
    funds.push({
      id: s.id,
      name: s.name,
      amc: s.amc,
      amount: p.amount,
      share: total ? p.amount / total : 0,
      slot: p.slot ?? i,
      asOf: s.asOf,
      demo: s.demo,
      hedgedFrac,
      mix: fundMix,
      nHoldings: s.holdings.filter((h) => h.kind === "equity").length,
    });
  });

  const stocks = [...stockMap.values()];
  for (const st of stocks) {
    st.fundCount = Object.keys(st.byFund).length;
    st.share = total ? st.exposure / total : 0;
  }
  stocks.sort((a, b) => b.exposure - a.exposure);

  const equityExposure = stocks.reduce((a, s) => a + s.exposure, 0);
  const hhi = equityExposure ? stocks.reduce((a, s) => a + (s.exposure / equityExposure) ** 2, 0) : 0;
  const shared = stocks.filter((s) => s.fundCount >= 2).reduce((a, s) => a + s.exposure, 0);

  const sectorMap = new Map<MacroSector, SectorAgg>();
  for (const st of stocks) {
    let sec = sectorMap.get(st.macro);
    if (!sec) sectorMap.set(st.macro, (sec = { sector: st.macro, exposure: 0, byFund: {} }));
    sec.exposure += st.exposure;
    for (const [f, v] of Object.entries(st.byFund)) sec.byFund[f] = (sec.byFund[f] ?? 0) + v;
  }
  const sectors = [...sectorMap.values()].sort(
    (a, b) => (a.sector === "Other" ? 1 : b.sector === "Other" ? -1 : b.exposure - a.exposure) || MACRO_SECTORS.indexOf(a.sector) - MACRO_SECTORS.indexOf(b.sector),
  );

  // Overlap = how much two funds' stock portfolios match: each fund's weights are scaled to its own
  // stock total, then we add up the smaller weight of every stock both hold (0 = nothing shared, 1 = identical).
  const n = funds.length;
  const overlap = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  const pairs: Analysis["topPairs"] = [];
  const netEq = weights.map((w) => [...w.values()].reduce((a, b) => a + b, 0));
  for (let i = 0; i < n; i++) {
    overlap[i][i] = 1;
    for (let j = i + 1; j < n; j++) {
      let sum = 0, count = 0;
      if (netEq[i] > 0 && netEq[j] > 0) {
        for (const [k, wv] of weights[i]) {
          const o = weights[j].get(k);
          if (o != null) {
            sum += Math.min(wv / netEq[i], o / netEq[j]);
            count++;
          }
        }
      }
      const v = Math.min(1, sum);
      overlap[i][j] = overlap[j][i] = v;
      pairs.push({ a: i, b: j, overlap: v, shared: count });
    }
  }
  pairs.sort((x, y) => y.overlap - x.overlap);

  return {
    total,
    funds,
    stocks,
    equityExposure,
    uniqueStocks: stocks.length,
    effectiveStocks: hhi ? 1 / hhi : 0,
    redundancy: equityExposure ? shared / equityExposure : 0,
    mix,
    sectors,
    overlap,
    topPairs: pairs,
  };
}
