# Aerie

A bird's-eye view of everything you own. Aerie opens up every mutual fund in your portfolio, lines up the stocks inside them, and shows where they overlap, how much is large, mid or small cap, and which sectors you are really betting on.

It is **local-first**: your holdings and amounts stay in your browser. There is no account and no backend. You tell Aerie which funds you hold and how much is in each; it reads the public monthly portfolio data that every AMC is required to publish. Two things reach the network, both optional: **Find a fund** downloads the holdings of the fund you pick from the separate [aerie-data](../aerie-data) set (never your amounts), and **Ask** sends percentages to the AI model you choose, see below.

> **Status: v1.1, project 1 of 2.** This repo is the X-ray (what is inside your funds). Project 2 (your own buy price, units and dates, for returns) will plug into the same `Position` model.

The demo that opens on first load uses fictional funds with generated weights. It is labelled as such in the app.

## What it shows

| Section | Question it answers |
| --- | --- |
| Orbit | One ring: each arc is a fund, rays are its stocks, and ribbons join funds that hold the same stocks. |
| Size | How much of your money is in large, mid and small caps, versus debt, cash and hedged equity? Per fund too. |
| Concentration | Which stocks do you really own the most of once every fund is added up? (Treemap + top ten by fund.) |
| Overlap | How much do any two of your funds duplicate each other? Which stocks sit in several funds? |
| Sectors | Which sectors carry your money, and which funds put it there? |
| Ask (optional) | Plain-language questions about your portfolio, answered by the AI model you choose. Off until you add your own API key. |
| Fund sheets | Every holding of every fund, with its size, sector and the rupees it represents in *your* portfolio. |

Two headline numbers sit at the top: **unique stocks** and **effective stocks** (inverse Herfindahl index of your look-through weights: "as concentrated as holding N stocks in equal amounts").

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # parser + analytics tests
npm run build        # static site in dist/
npm run build:single # one self-contained dist-single/index.html (fonts and JS inlined)
npm run samples      # writes synthetic AMC + AMFI workbooks to ./samples to try the drop flow
```

Deploy `dist/` to any static host (GitHub Pages, Netlify, your homelab). To enable **Find a fund** in a deployed build, host the `data/` folder of [aerie-data](../aerie-data) and build with `VITE_FUND_DATA_URL=https://your-host/path` (no trailing slash needed). Without it the app still works; Find a fund just says the list couldn't load and file upload remains. In `npm run dev`, `../aerie-data/data` is served automatically at `/fund-data`.

## Using it with your own funds

1. Open **Manage funds**.
2. **Find a fund**: search by fund or AMC name, type how much you hold, press Add. Only funds in aerie-data are listed (see [Which AMCs are listed, and why not all](#which-amcs-are-listed-and-why-not-all)).
3. Not listed? Download the AMC's latest monthly portfolio Excel from [AMFI's portfolio disclosure page](https://www.amfiindia.com/online-center/portfolio-disclosure) or the AMC's own site, pick the AMC, drop the file in, tick the schemes you hold and enter how much is in each. Upload is the main path for most AMCs, and it works for every AMC whose layout the parser can read.

## Which AMCs are listed, and why not all

Find a fund only lists AMCs we can fetch **within their own rules**. There is no common API or file format: every AMC publishes its monthly Excel differently, and many forbid automated copying in their terms, block scripts (HTTP 403), or list files only through JavaScript or forms. We don't work around any of that: no scraping against a `robots.txt`, no disguised user agents, no republishing where the terms ask for consent we don't have.

So the split is:

- **Listed (Find a fund):** AMCs whose files can be fetched politely and whose terms we've read. Currently PPFAS and SBI.
- **Everything else (upload):** you download the AMC's Excel yourself and drop it in. Aerie parses it in your browser, and nothing is uploaded anywhere. A workbook with many schemes (like SBI's) imports in one go.

The listed set grows as AMCs are checked or give permission; the policy and per-AMC status live in [aerie-data](../aerie-data). If your AMC isn't listed, upload is the supported way to use Aerie, not a fallback.
4. Optional but recommended: load AMFI's half-yearly **categorisation of stocks** Excel so every stock gets a Large / Mid / Small tag. Without it, stocks show as "size unknown".

Use **Export JSON** to back up or move your portfolio between browsers.

## Ask an AI model (optional)

The **Ask** section turns the numbers above into answers: "which of my funds duplicate each other?", "what am I really betting on?". It is the only part of Aerie that talks to a server, and only after you choose a provider, paste your own API key and ask a question.

- **Providers:** Claude (Anthropic SDK, with a model picker), plus anything that speaks the OpenAI chat-completions protocol: OpenAI, Google Gemini, OpenRouter, local servers such as Ollama or LM Studio, or any address you type in. For non-Claude providers you type the model id, since those change often.
- **What leaves your browser:** fund and stock names and percentages (share of portfolio, cap, sector, overlap), sent only to the provider you picked. Never rupee amounts, never the Excel files. **What gets sent** under the question box shows the exact text.
- **The key** is kept in this browser's local storage. Anyone who can open your browser profile can read it, so use a key with a spend limit. **Remove key** deletes it. Keys are refused over plain http except to localhost.
- It explains and compares; it is told not to say what to buy or sell.
- A local server must allow this page's origin (CORS), for example `OLLAMA_ORIGINS` for Ollama.
- The request and streaming code is covered by tests with a fake server, not yet by real provider calls.

## How the numbers are computed

- **Look-through exposure** of a stock = your rupees in a fund × the stock's % of that fund's NAV, summed over funds.
- **Hedged equity.** Arbitrage and balanced-advantage funds hold equities and short futures against them. If a fund's short derivatives offset part of its equity, that part is treated as *hedged money*, not stock exposure, and is excluded from overlap. (Proportional scaling; real hedges are stock-specific, so this is an approximation.)
- **Overlap** between two funds: scale each fund's stock weights to sum to 1, then add up the smaller weight of every stock both hold. 0 means nothing shared, 100% means identical portfolios.
- **Redundancy**: share of your equity rupees sitting in stocks held by two or more of your funds.
- **Size**: AMFI's list (top 100 by market cap = large, 101-250 = mid, the rest = small), joined by ISIN. Overseas holdings are tagged separately.
- **Sectors**: AMCs label equities with AMFI's industry classification. Aerie keeps the raw label and folds it into ten macro sectors (`src/core/sectors.ts`).
- Holdings are as of the file's date, usually the previous month-end. Your amount is today's value. The gap is real; expect small differences from a live view.

## How the parser works (and where it will break)

SEBI mandates *what* AMCs disclose (instrument, ISIN, industry/rating, quantity, market value, % to NAV) but not the file layout. Rather than hard-coding one parser per AMC, `src/core/parseAmc.ts`:

1. finds the header row by its labels (a row with an ISIN column and a % or value column),
2. maps columns by label, not position,
3. walks the rows tracking section headings (equity, debt, derivatives, cash...),
4. classifies each line from its ISIN (`INE…01…` equity, `INF…` fund units, other `INE` debt, `IN0…` G-secs) and section,
5. handles % stored as `5.2`, `0.052` or `"5.2%"`, or derives % to NAV from market value when a file has no % column,
6. skips index and summary sheets.

It is tested on synthetic workbooks that imitate the layouts of several AMCs (`tests/fixtures.ts`). **It has not yet been validated against real AMC files**, because the environment this was written in cannot reach AMC websites. Expect to meet layouts it misreads. When that happens:

```bash
npm run ingest -- path/to/file.xlsx            # shows what the parser saw, per sheet
npm run ingest -- path/to/file.xlsx --json out.json
```

then add a trimmed copy of the layout to `tests/fixtures.ts` and fix the parser against it. See [docs/ADDING_AN_AMC.md](docs/ADDING_AN_AMC.md).

## Project layout

```
src/core/       parsing, analytics, formatting, demo data, state (no UI code)
src/components/ one file per dashboard section; Orbit.tsx is the canvas hero
tests/          vitest: parser fixtures and analytics maths
scripts/        ingest.ts (debug a file), make-samples.ts (write sample workbooks)
docs/           data sources, adding an AMC
```

Stack: Vite, React, TypeScript, d3-force and d3-hierarchy for layout, SheetJS (`xlsx`) for Excel, plain CSS. Fonts (Bricolage Grotesque, Geist) are bundled, so it works offline.

## Roadmap

- Validate against real files from the largest AMCs and fix what breaks (highest priority).
- NPS scheme portfolios (published separately by each pension fund manager).
- ETFs and fund-of-funds look-through (units held by one fund are another fund's portfolio).
- Project 2: holdings with units, buy price and date, XIRR and gains, feeding the same `Position` model.
- Auto-refresh of the AMFI cap list.

## Known limitations

- `xlsx@0.18.5` is the last SheetJS build on npm and has published advisories for crafted files. Aerie only reads files you choose, in your own browser, but you can swap in SheetJS's newer CDN build (see docs.sheetjs.com) if you want it patched.
- Debt funds are shown as "Debt" at the bucket level; there is no issuer-level look-through for bonds.
- Colour: funds past the eighth share a neutral colour (the palette is validated for eight hues).

## Disclaimer

Aerie is a way to look at your money. It is not investment advice, and holdings data is only as current and accurate as the AMC files you load.

## License

MIT
