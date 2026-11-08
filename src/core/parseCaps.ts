import * as XLSX from "xlsx";
import { isIsin } from "./isin";
import type { CapMap } from "./types";

const CAP_RE = /^\s*(large|mid|small)\s*-?\s*cap\s*$/i;

/**
 * Reads AMFI's half-yearly "Categorization of stocks" workbook into ISIN -> L/M/S.
 * Column positions change between releases, so we look for the column full of ISINs
 * and the column full of "Large Cap / Mid Cap / Small Cap" values instead of trusting headers.
 */
export function parseCapRows(rows: unknown[][]): CapMap {
  const isinHits = new Map<number, number>();
  const capHits = new Map<number, number>();
  for (const r of rows) {
    (r ?? []).forEach((c, j) => {
      const s = typeof c === "string" ? c.trim() : "";
      if (isIsin(s)) isinHits.set(j, (isinHits.get(j) ?? 0) + 1);
      else if (CAP_RE.test(s)) capHits.set(j, (capHits.get(j) ?? 0) + 1);
    });
  }
  const best = (m: Map<number, number>) => [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const ic = best(isinHits);
  const cc = best(capHits);
  const out: CapMap = {};
  if (ic == null || cc == null) return out;
  for (const r of rows) {
    const isin = typeof r?.[ic] === "string" ? (r[ic] as string).trim().toUpperCase() : "";
    const cap = typeof r?.[cc] === "string" ? (r[cc] as string).match(CAP_RE)?.[1]?.toLowerCase() : undefined;
    if (isIsin(isin) && cap) out[isin] = cap === "large" ? "L" : cap === "mid" ? "M" : "S";
  }
  return out;
}

export function parseCapFile(data: ArrayBuffer | Uint8Array): CapMap {
  const wb = XLSX.read(data, { type: "array" });
  let best: CapMap = {};
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, blankrows: false });
    const m = parseCapRows(rows);
    if (Object.keys(m).length > Object.keys(best).length) best = m;
  }
  return best;
}
