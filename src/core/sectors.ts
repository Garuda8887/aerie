/**
 * AMCs label equities with AMFI's industry classification ("Banks", "IT - Software", ...).
 * We keep the raw label for detail and fold it into ten macro sectors for the overview.
 */
export const MACRO_SECTORS = [
  "Financials",
  "Technology",
  "Healthcare",
  "Consumer",
  "Auto",
  "Industrials",
  "Energy & Power",
  "Materials",
  "Telecom & Media",
  "Real Estate",
  "Other",
] as const;
export type MacroSector = (typeof MACRO_SECTORS)[number];

const RULES: [RegExp, MacroSector][] = [
  [/bank|financ|insur|capital market|fintech|nbfc|housing fin|asset manag/i, "Financials"],
  [/\bit\b|software|information tech|computer|data process|internet|e-?commerce|digital/i, "Technology"],
  [/pharma|health|hospital|biotech|diagnostic|medical|life science/i, "Healthcare"],
  [/fmcg|food|beverage|personal|household|retail|consumer|textile|apparel|leisure|hotel|restaurant|tobacco|agricultur|jewel|footwear|paint/i, "Consumer"],
  [/automobile|auto comp|auto ancill|two wheel|tractor|\bauto\b/i, "Auto"],
  [/construct|industrial|electrical equip|aerospace|defen[cs]e|transport|logistic|capital goods|engineering|commercial serv|infrastructure|shipping|airline/i, "Industrials"],
  [/petrol|oil|\bgas\b|power|fuel|energy|utilit|renewable/i, "Energy & Power"],
  [/cement|metal|steel|chemical|fertili|paper|mining|mineral|packag|ferrous/i, "Materials"],
  [/telecom|media|entertain|broadcast|publish/i, "Telecom & Media"],
  [/realty|real estate|reit/i, "Real Estate"],
];

export function macroSector(industry?: string): MacroSector {
  if (!industry) return "Other";
  for (const [re, sector] of RULES) if (re.test(industry)) return sector;
  return "Other";
}
