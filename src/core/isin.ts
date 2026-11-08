import type { Kind } from "./types";

/**
 * Indian ISINs: IN + E/F/0.. + issuer(4) + security type(2) + serial(2) + check digit.
 * - INE….01…  equity shares
 * - INE….other debentures, bonds, preference shares, etc.
 * - INF…      mutual fund / ETF units
 * - IN00…IN9… government securities, T-bills, state development loans
 * Anything not starting with IN is treated as a foreign listing (ADR/GDR/overseas equity).
 */
export const ISIN_RE = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/;

export function isIsin(v: unknown): v is string {
  return typeof v === "string" && ISIN_RE.test(v.trim().toUpperCase());
}

export function kindFromIsin(isin: string): Kind {
  const s = isin.trim().toUpperCase();
  if (!s.startsWith("IN")) return "equity"; // overseas equity
  if (s.startsWith("INE")) return s.slice(7, 9) === "01" ? "equity" : "debt";
  if (s.startsWith("INF")) return "units";
  return "debt"; // G-secs, T-bills, SDLs
}

export const isForeign = (isin?: string) => !!isin && !isin.trim().toUpperCase().startsWith("IN");

export function nameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(limited|ltd\.?|corporation|corp\.?|inc\.?|plc)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
