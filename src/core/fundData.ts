import type { Holding, Kind, ParsedScheme } from "./types";

/**
 * The fund list lives in the separate aerie-data repo as plain JSON (index.json + one file per scheme).
 * Deployed builds set VITE_FUND_DATA_URL to wherever that is hosted; `vite dev` serves ../aerie-data/data at ./fund-data.
 */
const BASE = ((import.meta.env.VITE_FUND_DATA_URL as string | undefined) ?? "./fund-data").replace(/\/$/, "");

export interface FundEntry {
  id: string;
  name: string;
  amc: string;
  asOf: string;
  path: string;
}

const KINDS: Kind[] = ["equity", "debt", "cash", "derivative", "units", "other"];

async function getJson(path: string): Promise<unknown> {
  const r = await fetch(`${BASE}/${path}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

let index: Promise<FundEntry[]> | null = null;
export function loadFundIndex(): Promise<FundEntry[]> {
  index ??= getJson("index.json")
    .then((j) => {
      const list = (j as { schemes?: unknown }).schemes;
      if (!Array.isArray(list)) throw new Error("bad index");
      return list.filter(isEntry);
    })
    .catch((e) => {
      index = null; // let the next open retry
      throw e;
    });
  return index;
}

// The path comes from a remote file, so keep it inside the data folder.
const safePath = (p: unknown): p is string => typeof p === "string" && /^[\w.-]+(\/[\w.-]+)*$/.test(p) && !p.includes("..");
const isEntry = (e: any): e is FundEntry =>
  !!e && typeof e.id === "string" && typeof e.name === "string" && typeof e.amc === "string" && typeof e.asOf === "string" && safePath(e.path);

export async function loadFund(e: FundEntry): Promise<ParsedScheme> {
  return toParsed(await getJson(e.path), e);
}

/** Validates a scheme file from the data set; throws on anything the analysis code couldn't handle. */
export function toParsed(j: unknown, e: FundEntry): ParsedScheme {
  const raw = (j as { holdings?: unknown } | null)?.holdings;
  if (!Array.isArray(raw) || !raw.length) throw new Error("no holdings");
  const holdings: Holding[] = raw.map((h: any) => {
    if (typeof h?.key !== "string" || typeof h?.name !== "string" || !Number.isFinite(h?.pct) || !KINDS.includes(h?.kind)) throw new Error("bad holding");
    return { key: h.key, isin: typeof h.isin === "string" ? h.isin : undefined, name: h.name, industry: typeof h.industry === "string" ? h.industry : undefined, kind: h.kind, pct: h.pct };
  });
  const coverage = holdings.filter((h) => h.kind !== "derivative").reduce((a, h) => a + h.pct, 0);
  return { sheet: e.id, name: e.name, asOf: e.asOf, holdings, coverage, warnings: [] };
}

/** Every word typed must appear in the fund or AMC name. */
export function searchFunds(list: FundEntry[], q: string): FundEntry[] {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  return list.filter((f) => {
    const hay = `${f.name} ${f.amc}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}
