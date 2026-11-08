# When an AMC file doesn't load

Aerie's parser is layout-detecting rather than AMC-specific, so a failing file usually means one of its assumptions doesn't hold for that layout. Debugging loop:

1. See what the parser sees:

   ```bash
   npm run ingest -- ~/Downloads/amc-portfolio.xlsx
   ```

   It prints, per sheet: scheme name, date, number of lines, equities found, coverage (sum of % to NAV; it should be close to 100) and warnings.

2. Compare with the file. Typical causes:

   | Symptom | Likely cause | Where to fix |
   | --- | --- | --- |
   | "No portfolio tables found" | Header has no `ISIN` cell, or % column is labelled unusually | `detectHeader` in `src/core/parseAmc.ts` |
   | Scheme name is the sheet name | Name sits in a cell without "fund", "scheme", "plan", "etf" etc. | `detectSchemeName` |
   | Coverage far from 100 | Rows dropped: no ISIN on equities, or numbers stored as text with odd characters | the row loop; `num()` |
   | Equities counted as debt (or the reverse) | New ISIN pattern or section wording | `kindFromIsin` in `src/core/isin.ts`; `classifySection` |
   | Everything 100x too small | % stored as fractions in a file with few rows | the fraction check after the row loop |
   | Industry shows as a rating | Both live in one "Rating / Industry" column; equities carry industry, debt carries rating, which is expected | none |

3. Add a **trimmed, de-identified copy of the layout** to `tests/fixtures.ts` (invented company names, valid-format ISINs; real holdings aren't needed), add a case to `tests/parse.test.ts`, then change the parser until it passes. Keep the older cases green: they encode other AMCs' layouts.

4. `npm test`.

## Conventions worth keeping

- Detect by label and content, never by fixed column index or sheet name.
- A line is a holding only if it has a valid ISIN or a name plus a numeric % / value. Totals and sub-totals are skipped by name.
- Section headings are rows with text and no numbers; they only *set* the section when they match a known category, otherwise the previous section carries on.
