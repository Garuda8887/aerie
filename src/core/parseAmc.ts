import * as XLSX from "xlsx";
import { isForeign, isIsin, kindFromIsin, nameKey } from "./isin";
import type { Holding, Kind, ParsedScheme } from "./types";

/**
 * Parses an AMC's monthly portfolio disclosure workbook.
 *
 * SEBI fixes *what* each AMC must publish (instrument, ISIN, industry/rating, quantity,
 * market value, % to NAV) but not the layout, so every AMC differs in preamble length, sheet
 * naming and column order. Instead of one parser per AMC we detect the header row and the
 * columns by their labels, then walk the rows keeping track of section headings
 * ("Equity & Equity related", "Debt Instruments", "Hedging positions through futures", ...).
 */

type Row = unknown[];
const text = (v: unknown) => (v == null ? "" : String(v).replace(/\s+/g, " ").trim());

function num(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  let s = v.replace(/[,%\s]/g, "");
  if (!s || /^(-|--|na|n\.a\.?|nil)$/i.test(s)) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) {
    neg = true;
    s = s.slice(1, -1);
  }
  const n = Number(s);
  return Number.isFinite(n) ? (neg ? -n : n) : null;
}

interface Cols {
  name: number;
  isin: number;
  industry: number;
  qty: number;
  value: number;
  pct: number;
}

function detectHeader(rows: Row[]): { idx: number; cols: Cols } | null {
  const limit = Math.min(rows.length, 80);
  for (let i = 0; i < limit; i++) {
    const cells = (rows[i] ?? []).map((c) => text(c).toLowerCase());
    const isin = cells.findIndex((c) => /\bisin\b/.test(c));
    if (isin < 0) continue;
    const pctCandidates = (c: string, j: number) =>
      j !== isin && /(%|percent)/.test(c) && !/(yield|ytm|coupon|maturity)/.test(c);
    let pct = cells.findIndex((c, j) => pctCandidates(c, j) && /(nav|aum|asset)/.test(c));
    if (pct < 0) pct = cells.findIndex(pctCandidates);
    const value = cells.findIndex(
      (c, j) => j !== isin && j !== pct && /(market|fair value|exposure|value)/.test(c) && !/%/.test(c),
    );
    if (pct < 0 && value < 0) continue;
    let name = cells.findIndex(
      (c, j) => j !== isin && /(name of|instrument|issuer|company|security|scrip)/.test(c) && !/(rating|industry)/.test(c),
    );
    if (name < 0) name = isin > 0 ? isin - 1 : isin + 1;
    return {
      idx: i,
      cols: {
        name,
        isin,
        industry: cells.findIndex((c, j) => j !== name && /(industry|rating|sector)/.test(c)),
        qty: cells.findIndex((c) => /(quantity|qty|no\.? of)/.test(c)),
        value,
        pct,
      },
    };
  }
  return null;
}

type Section = Kind | null;
function classifySection(label: string): Section {
  const s = label.toLowerCase();
  if (/(derivative|future|option|hedg)/.test(s)) return "derivative";
  if (/(reit|invit|real estate invest|infrastructure invest)/.test(s)) return "other";
  if (/(mutual fund unit|etf|exchange traded|units of|fund of fund)/.test(s)) return "units";
  if (/(cash|net receivable|tri-?party|treps|repo|net current)/.test(s)) return "cash";
  if (/(debt|bond|debenture|ncd|g-?sec|government (securit|of india)|treasury|money market|commercial paper|certificate of deposit|gilt|securiti[sz]|pass through|state development)/.test(s))
    return "debt";
  if (/(^\(?[a-z]?\)?\s*equity|equity (&|and) equity|equity shares|equity related)/.test(s)) return "equity";
  return null;
}

const CASH_RE = /(cash|net receivable|payable|tri-?party|treps|\brepo\b|cblo|net current|current asset)/i;
const TOTAL_RE = /^(grand\s+)?total\b|^sub\s*-?\s*total\b|^net assets?\b|\btotal\s*:?\s*$/i;
// the AMC banner ("Axis Mutual Fund") is not a scheme name
const BANNER_RE = /\b(mutual fund|asset management( company)?)\s*(limited|ltd\.?)?$/i;

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};
const pad = (n: number) => String(n).padStart(2, "0");

export function findDate(s: string): string | undefined {
  let m = s.match(/\b(\d{1,2})(?:st|nd|rd|th)?[\s\-\/.,]+([A-Za-z]{3})[A-Za-z]*[\s\-\/.,]+(\d{4})\b/);
  if (m && MONTHS[m[2].toLowerCase()]) return `${m[3]}-${pad(MONTHS[m[2].toLowerCase()])}-${pad(+m[1])}`;
  m = s.match(/\b([A-Za-z]{3})[A-Za-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/);
  if (m && MONTHS[m[1].toLowerCase()]) return `${m[3]}-${pad(MONTHS[m[1].toLowerCase()])}-${pad(+m[2])}`;
  m = s.match(/\b(\d{1,2})[\-\/.](\d{1,2})[\-\/.](\d{4})\b/);
  if (m && +m[2] >= 1 && +m[2] <= 12) return `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
  return undefined;
}

const FUND_WORD = /(fund|scheme|etf|fof|yojana|\bplan\b|index|fixed maturity)/i;

function detectSchemeName(pre: string[], sheet: string): string {
  for (const raw of pre) {
    let s = raw
      .replace(/^(name of the )?scheme( name)?\s*[:\-]\s*/i, "")
      .replace(/^(monthly\s+)?portfolio( statement| of| for| details)?( of| for)?\s*/i, "")
      .replace(/\s*[\-–(]?\s*(monthly\s+)?portfolio.*$/i, "")
      .replace(/\s+as (on|at|of)\b.*$/i, "")
      .trim();
    if (s.length >= 6 && s.length <= 120 && FUND_WORD.test(s) && !BANNER_RE.test(s) && !/^(statement|disclosure|back to)/i.test(s) && !/investment manager|asset management company/i.test(s)) return s;
  }
  return sheet.trim();
}

export function parseSheetRows(rows: Row[], sheet: string): ParsedScheme | null {
  const header = detectHeader(rows);
  if (!header) return null;
  const { cols } = header;
  const warnings: string[] = [];

  const pre = rows
    .slice(0, header.idx)
    .flatMap((r) => (r ?? []).map(text))
    .filter(Boolean);
  // Some AMCs (SBI) lay the header out as label/value pairs: "SCHEME NAME :" | name, "PORTFOLIO STATEMENT AS ON :" | 46326 (an Excel date).
  const labelled = (label: RegExp): unknown => {
    for (const r of rows.slice(0, header.idx)) {
      const row = r ?? [];
      const j = row.findIndex((c) => label.test(text(c)));
      const v = j < 0 ? undefined : row.slice(j + 1).find((c) => text(c) !== "");
      if (v != null) return v;
    }
    return undefined;
  };
  const name = text(labelled(/^scheme name\s*:?$/i)) || detectSchemeName(pre, sheet);
  const dateCell = labelled(/\bas (on|at|of)\s*:?$/i);
  const serial =
    typeof dateCell === "number" && dateCell > 20000 && dateCell < 80000
      ? new Date(Date.UTC(1899, 11, 30) + dateCell * 864e5).toISOString().slice(0, 10)
      : undefined;
  const asOf = serial ?? findDate(pre.join(" | ")) ?? findDate(sheet);

  let section: Section = null;
  const raw: { h: Omit<Holding, "pct">; pct: number | null; value: number | null }[] = [];
  let totalValue: number | null = null;
  let sawPercentString = false;

  for (let i = header.idx + 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const label = text(r[cols.name]) || r.map(text).find(Boolean) || "";
    if (!label && !text(r[cols.isin])) continue;

    const isinCell = text(r[cols.isin]).toUpperCase();
    const pctCell = cols.pct >= 0 ? r[cols.pct] : null;
    // only a real "5.2%" proves percentages are stored as percentages; footnote-style cells like "$0.00%" (= under 0.01%) don't
    if (typeof pctCell === "string" && /^\s*-?\d+(\.\d+)?\s*%\s*$/.test(pctCell)) sawPercentString = true;
    // "$0.00%" and "< 0.01%" mean a negligible position; don't let it fall through to the market-value derivation
    const tinyCell = typeof pctCell === "string" && /^\s*\$|less than|^\s*</i.test(pctCell);
    const pct = cols.pct >= 0 ? (tinyCell ? 0 : num(pctCell)) : null;
    const value = cols.value >= 0 ? num(r[cols.value]) : null;

    if (TOTAL_RE.test(label) && !isIsin(isinCell)) {
      if (/^grand/i.test(label) && value != null) totalValue = value;
      if (/^grand/i.test(label) && raw.length) break; // everything below is notes and performance tables
      continue;
    }

    if (isIsin(isinCell) && (pct != null || value != null)) {
      let kind: Kind = kindFromIsin(isinCell);
      if (section === "derivative" || section === "other") kind = section;
      else if (kind === "debt" && section === "units") kind = "units";
      else if (isForeign(isinCell) && (section === "debt" || section === "units")) kind = section; // overseas bond or ETF, not a stock
      const industry = cols.industry >= 0 ? text(r[cols.industry]) : "";
      raw.push({
        h: { key: isinCell, isin: isinCell, name: label, industry: industry || undefined, kind },
        pct,
        value,
      });
      continue;
    }

    if (pct == null && value == null) {
      // a company line with an ISIN but no numbers is not a section heading
      const s = isIsin(isinCell) ? null : classifySection(label);
      if (s) section = s;
      continue;
    }

    // numeric row without an ISIN: cash lines, futures, deposits
    let kind: Kind;
    if (CASH_RE.test(label)) kind = "cash";
    else if (section === "derivative") kind = "derivative";
    else if (section === "debt") kind = "debt";
    else kind = "other";
    raw.push({ h: { key: nameKey(label) || label, name: label, kind }, pct, value });
  }

  if (!raw.length) return null;

  // % to NAV: from the column, or derived from market value.
  const denom = totalValue ?? raw.reduce((a, x) => a + (x.value ?? 0), 0);
  let holdings: Holding[] = raw
    .map((x) => {
      const pct = x.pct ?? (x.value != null && denom ? (x.value / denom) * 100 : null);
      return pct == null ? null : ({ ...x.h, pct } as Holding);
    })
    .filter((h): h is Holding => !!h);

  // Some AMCs store 5.23% as 0.0523. If the long side adds to ~1, scale up.
  const longSum = holdings.filter((h) => h.pct > 0 && h.kind !== "derivative").reduce((a, h) => a + h.pct, 0);
  if (!sawPercentString && holdings.length >= 3 && longSum > 0 && longSum <= 1.6) {
    holdings = holdings.map((h) => ({ ...h, pct: h.pct * 100 }));
    warnings.push("Percentages looked like fractions; scaled by 100.");
  }

  // merge duplicate lines (same security in more than one lot)
  const merged = new Map<string, Holding>();
  for (const h of holdings) {
    const k = `${h.kind}|${h.key}`;
    const prev = merged.get(k);
    if (prev) prev.pct += h.pct;
    else merged.set(k, { ...h });
  }
  holdings = [...merged.values()];

  const coverage = holdings.filter((h) => h.kind !== "derivative").reduce((a, h) => a + h.pct, 0);
  if (Math.abs(coverage - 100) > 3) warnings.push(`Holdings add up to ${coverage.toFixed(1)}% of NAV; the file may be partial.`);

  return { sheet, name, asOf, holdings, coverage, warnings };
}

export function parseWorkbook(wb: XLSX.WorkBook): ParsedScheme[] {
  const out: ParsedScheme[] = [];
  for (const sheet of wb.SheetNames) {
    const ws = wb.Sheets[sheet];
    if (!ws) continue;
    const rows = XLSX.utils.sheet_to_json<Row>(ws, { header: 1, defval: null, blankrows: false, raw: true });
    const parsed = parseSheetRows(rows, sheet);
    if (parsed) out.push(parsed);
  }
  return out;
}

export function readWorkbook(data: ArrayBuffer | Uint8Array): XLSX.WorkBook {
  return XLSX.read(data, { type: "array", cellDates: false });
}

export function parseAmcFile(data: ArrayBuffer | Uint8Array): ParsedScheme[] {
  return parseWorkbook(readWorkbook(data));
}
