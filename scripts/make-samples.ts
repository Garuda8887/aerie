// Writes synthetic AMC-style workbooks to ./samples so you can try the drag-and-drop flow
// without hunting for a real file. The companies in them are invented.
import fs from "node:fs";
import * as F from "../tests/fixtures";

fs.mkdirSync("samples", { recursive: true });
fs.writeFileSync(
  "samples/sample-amc-portfolio.xlsx",
  F.workbookBuffer({ Index: F.indexSheet, ALPHA: F.sebiStyle, BETA: F.iciciStyle, GAMMA: F.valueOnly, DELTA: F.percentStrings, EPSILON: F.hedged }),
);
fs.writeFileSync("samples/sample-amfi-cap-list.xlsx", F.workbookBuffer({ "Categorization": F.capRows }));
console.log("Wrote samples/sample-amc-portfolio.xlsx and samples/sample-amfi-cap-list.xlsx");
