import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from "react";
import { analyze, type Analysis } from "./analyze";
import { demoPortfolio } from "./demo";
import type { CapMap, ParsedScheme, Position, Scheme } from "./types";

const KEY = "aerie.v1";

export interface State {
  schemes: Record<string, Scheme>;
  positions: Position[];
  capMap: CapMap;
  capCount: number;
}

type Action =
  | { t: "demo" }
  | { t: "clear" }
  | { t: "add"; amc: string; items: { parsed: ParsedScheme; name: string; amount: number }[] }
  | { t: "amount"; id: string; amount: number }
  | { t: "remove"; id: string }
  | { t: "caps"; map: CapMap }
  | { t: "load"; state: State };

/** Shape check for anything read from storage or an imported file; analyze() assumes this shape and throws on anything else. */
function valid(s: unknown): s is State {
  const o = s as State | null;
  return (
    !!o &&
    typeof o.schemes === "object" &&
    o.schemes !== null &&
    Object.values(o.schemes).every((x) => Array.isArray(x?.holdings)) &&
    Array.isArray(o.positions) &&
    o.positions.every((p) => typeof p?.schemeId === "string" && Number.isFinite(p.amount))
  );
}

function initial(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as State;
      if (valid(s)) return s;
    }
  } catch {
    /* storage can be blocked (private mode, sandboxed iframe) */
  }
  return fromDemo({ schemes: {}, positions: [], capMap: {}, capCount: 0 });
}

function fromDemo(base: State): State {
  const d = demoPortfolio();
  return {
    ...base,
    schemes: Object.fromEntries(d.schemes.map((s) => [s.id, s])),
    positions: d.positions,
  };
}

const lowestFreeSlot = (positions: Position[]) => {
  const used = new Set(positions.map((p) => p.slot));
  let i = 0;
  while (used.has(i)) i++;
  return i;
};

function reducer(s: State, a: Action): State {
  switch (a.t) {
    case "demo":
      // never overwrite a real portfolio
      return s.positions.some((p) => !s.schemes[p.schemeId]?.demo) ? s : fromDemo({ ...s });
    case "clear":
      return { ...s, schemes: {}, positions: [] };
    case "add": {
      // The first real fund replaces the demo funds.
      let schemes = { ...s.schemes };
      let positions = [...s.positions];
      if (positions.some((p) => schemes[p.schemeId]?.demo)) {
        positions = positions.filter((p) => !schemes[p.schemeId]?.demo);
        schemes = Object.fromEntries(Object.entries(schemes).filter(([, v]) => !v.demo));
      }
      for (const it of a.items) {
        const id = `${a.amc}|${it.name}`.toLowerCase().replace(/[^a-z0-9|]+/g, "-");
        schemes[id] = { id, name: it.name, amc: a.amc, asOf: it.parsed.asOf, holdings: it.parsed.holdings };
        if (positions.some((p) => p.schemeId === id)) positions = positions.map((p) => (p.schemeId === id ? { ...p, amount: it.amount } : p));
        else positions.push({ schemeId: id, amount: it.amount, slot: lowestFreeSlot(positions) });
      }
      return { ...s, schemes, positions };
    }
    case "amount":
      return { ...s, positions: s.positions.map((p) => (p.schemeId === a.id ? { ...p, amount: a.amount } : p)) };
    case "remove": {
      const { [a.id]: _gone, ...rest } = s.schemes;
      return { ...s, schemes: rest, positions: s.positions.filter((p) => p.schemeId !== a.id) };
    }
    case "caps":
      return { ...s, capMap: a.map, capCount: Object.keys(a.map).length };
    case "load":
      return a.state;
  }
}

interface Ctx {
  state: State;
  analysis: Analysis;
  isDemo: boolean;
  dispatch: (a: Action) => void;
}
const C = createContext<Ctx | null>(null);

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initial);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state]);
  const analysis = useMemo(() => analyze(state.positions, state.schemes, state.capMap), [state]);
  const isDemo = state.positions.length > 0 && state.positions.every((p) => state.schemes[p.schemeId]?.demo);
  return <C.Provider value={{ state, analysis, isDemo, dispatch }}>{children}</C.Provider>;
}

export function usePortfolio() {
  const v = useContext(C);
  if (!v) throw new Error("usePortfolio outside provider");
  return v;
}

/** Portable snapshot for backup or for feeding into other tools. */
export function exportJson(state: State): string {
  return JSON.stringify({ app: "aerie", version: 1, ...state }, null, 2);
}
export function parseExport(text: string): State | null {
  try {
    const o = JSON.parse(text);
    if (o?.app === "aerie" && valid(o)) {
      return { schemes: o.schemes, positions: o.positions, capMap: o.capMap ?? {}, capCount: Object.keys(o.capMap ?? {}).length };
    }
  } catch {
    /* fall through */
  }
  return null;
}
