// Command-line view of what the parser finds in an AMC workbook.
//   npm run ingest -- path/to/amc-portfolio.xlsx [--json out.json] [--caps amfi-list.xlsx]
// Handy when a new AMC file doesn't load in the app: you can see exactly what the parser saw.
import fs from "node:fs";
import { parseAmcFile } from "../src/core/parseAmc";
import { parseCapFile } from "../src/core/parseCaps";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const file = args.find((a, i) => !a.startsWith("--") && !args[i - 1]?.startsWith("--"));
if (!file) {
  console.error("usage: npm run ingest -- <amc-portfolio.xlsx> [--json out.json] [--caps amfi-list.xlsx]");
  process.exit(1);
}

const schemes = parseAmcFile(fs.readFileSync(file));
if (!schemes.length) {
  console.error("No portfolio tables found (looked for a header row containing ISIN and % to NAV or a market value column).");
  process.exit(2);
}
const caps = flag("--caps") ? parseCapFile(fs.readFileSync(flag("--caps")!)) : {};

for (const s of schemes) {
  const eq = s.holdings.filter((h) => h.kind === "equity");
  const known = eq.filter((h) => h.isin && caps[h.isin]).length;
  console.log(`\n${s.name}  [sheet "${s.sheet}"${s.asOf ? `, as on ${s.asOf}` : ""}]`);
  console.log(`  ${s.holdings.length} lines, ${eq.length} equities, coverage ${s.coverage.toFixed(2)}% of NAV`);
  if (flag("--caps")) console.log(`  ${known}/${eq.length} equities matched in the AMFI cap list`);
  s.warnings.forEach((w) => console.log(`  ! ${w}`));
}

const out = flag("--json");
if (out) {
  fs.writeFileSync(out, JSON.stringify(schemes, null, 2));
  console.log(`\nWrote ${out}`);
}
