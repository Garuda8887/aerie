import * as XLSX from "xlsx";

/**
 * Synthetic AMC-style sheets. Company names and ISINs are invented (valid format, not real).
 * They imitate the *layouts* seen across AMC disclosures: preamble length, column order,
 * section headings, % stored as number / fraction / string, value-only files.
 */

export const sebiStyle = [
  ["Alpha Bluechip Fund"],
  ["Portfolio Statement as on October 31, 2026"],
  [],
  ["Name of the Instrument", "ISIN", "Industry / Rating", "Quantity", "Market/Fair Value (Rs. in Lacs.)", "% to NAV"],
  ["Equity & Equity related"],
  ["(a) Listed / awaiting listing on Stock Exchanges"],
  ["Test Bank Ltd", "INE111A01018", "Banks", 1000, 500.5, 50.0],
  ["Demo Software Ltd", "INE222B01016", "IT - Software", 800, 300.3, 30.0],
  ["Sample Motors Ltd", "INE333C01014", "Automobiles", 400, 100.1, 10.0],
  ["Sub Total", null, null, null, 900.9, 90.0],
  ["Debt Instruments"],
  ["Gamma Finance Ltd NCD", "INE444D07015", "CRISIL AAA", 10, 50, 5.0],
  ["Money Market Instruments"],
  ["Triparty Repo", null, null, null, 40, 4.0],
  ["Net Receivables / (Payables)", null, null, null, 9.1, 1.0],
  ["Grand Total", null, null, null, 1000, 100.0],
];

export const iciciStyle = [
  ["Beta Flexicap Fund (An open ended equity scheme)"],
  ["Monthly Portfolio Statement as on 31-Oct-2026"],
  [],
  [],
  ["Company/Issuer/Instrument Name", "ISIN", "Coupon", "Industry/Rating", "Quantity", "Exposure/Market Value(Rs.Lakh)", "% to NAV", "Yield"],
  ["Equity & Equity Related Instruments"],
  ["Test Bank Ltd", "INE111A01018", null, "Banks", 100, 55, 0.55, null],
  ["Sample Motors Ltd", "INE333C01014", null, "Automobiles", 50, 25, 0.25, null],
  ["Overseas Tech Inc", "US0000000007", null, "IT - Software", 5, 10, 0.1, null],
  ["Cash & Cash Equivalents"],
  ["Net Current Assets", null, null, null, null, 10, 0.1, null],
];

export const valueOnly = [
  ["Gamma Index Fund"],
  ["Scheme Portfolio as at 30/09/2026"],
  ["Security Name", "ISIN", "Industry", "Qty", "Market Value (Rs Lakhs)"],
  ["Test Bank Ltd", "INE111A01018", "Banks", 10, 600],
  ["Demo Software Ltd", "INE222B01016", "IT - Software", 10, 300],
  ["Cash and Others", null, null, null, 100],
  ["Grand Total", null, null, null, 1000],
];

export const percentStrings = [
  ["Delta Large Cap Fund"],
  ["Name of the Instrument", "ISIN", "Rating / Industry", "% to Net Assets"],
  ["Test Bank Ltd", "INE111A01018", "Banks", "60.00%"],
  ["Demo Software Ltd", "INE222B01016", "IT - Software", "35.00%"],
  ["Net Receivables", null, null, "5.00%"],
];

export const hedged = [
  ["Epsilon Arbitrage Fund"],
  ["Name of the Instrument", "ISIN", "Industry / Rating", "Quantity", "Market Value", "% to NAV"],
  ["Equity & Equity related"],
  ["Test Bank Ltd", "INE111A01018", "Banks", 1, 1, 60.0],
  ["Demo Software Ltd", "INE222B01016", "IT - Software", 1, 1, 30.0],
  ["Hedging positions through Futures"],
  ["Test Bank Ltd-Nov26", null, null, -1, -1, -60.0],
  ["Demo Software Ltd-Nov26", null, null, -1, -1, -30.0],
  ["Triparty Repo", null, null, null, 10, 10.0],
];

export const indexSheet = [["Scheme Name", "Sheet"], ["Alpha Bluechip Fund", "SCH1"]];

export function workbookBuffer(sheets: Record<string, unknown[][]>): Uint8Array {
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  return new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }));
}

export const capRows = [
  ["Sr. No.", "Company name", "ISIN", "BSE Symbol", "Average Market Cap (Rs. Cr.)", "Categorization"],
  [1, "Test Bank Ltd", "INE111A01018", "TB", 900000, "Large Cap"],
  [2, "Demo Software Ltd", "INE222B01016", "DS", 80000, "Mid Cap"],
  [3, "Sample Motors Ltd", "INE333C01014", "SM", 2000, "Small Cap"],
];
