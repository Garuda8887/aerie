/** Cap tier of a listed company, per AMFI's half-yearly categorisation. */
export type Cap = "L" | "M" | "S" | "F" | "U"; // Large, Mid, Small, Foreign, Unclassified

/** What a line in a portfolio disclosure is. */
export type Kind = "equity" | "debt" | "cash" | "derivative" | "units" | "other";

export interface Holding {
  /** ISIN when the file gives one; otherwise a normalised name key. */
  key: string;
  isin?: string;
  name: string;
  /** Raw "Industry / Rating" cell from the AMC file. */
  industry?: string;
  kind: Kind;
  /** Percent of the scheme's NAV. Negative for short derivative positions. */
  pct: number;
  /** Cap tier already known (e.g. demo data). Otherwise resolved from the AMFI list. */
  cap?: Cap;
}

export interface Scheme {
  id: string;
  name: string;
  amc: string;
  /** "as on" date found in the file, ISO yyyy-mm-dd when parseable. */
  asOf?: string;
  holdings: Holding[];
  demo?: boolean;
}

/** One fund the person owns. `amount` is rupees currently in it. */
export interface Position {
  schemeId: string;
  amount: number;
  /** Stable colour slot so a fund keeps its colour when others are added or removed. */
  slot?: number;
}

export type CapMap = Record<string, "L" | "M" | "S">;

export interface ParsedScheme {
  sheet: string;
  name: string;
  asOf?: string;
  holdings: Holding[];
  /** Sum of all pct values found, to sanity check against ~100. */
  coverage: number;
  warnings: string[];
}
