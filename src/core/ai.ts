import Anthropic from "@anthropic-ai/sdk";
import type { Analysis } from "./analyze";
import { pct, shortName } from "./format";

export const SYSTEM = `You help a retail investor in India understand what their mutual funds hold, using a look-through summary of their portfolio.

The summary shows percentages of the whole portfolio, never rupee amounts. Answer from it and say so when it does not contain what was asked. Stock-level figures are each fund's disclosed holdings scaled by how much the person has in that fund. Holdings are as of each fund's file date, and hedged equity in arbitrage-style funds is already removed.

Be plain and brief: short paragraphs, specific fund and stock names, no jargon without a half-sentence of explanation. Describe what the portfolio is, where it is concentrated and where funds duplicate each other. Do not tell the person what to buy, sell or switch; if they ask, lay out the facts that bear on the decision and say that the call is theirs.`;

/**
 * What the model sees. Names and percentages only: no rupee amounts, no file contents.
 * The UI shows this text to the person before anything is sent.
 */
export function buildContext(a: Analysis): string {
  if (!a.funds.length) return "The portfolio is empty.";
  const names = a.funds.map((f) => shortName(f.name, 40));
  const lines: string[] = [];

  lines.push(`Funds (${a.funds.length}):`);
  a.funds.forEach((f, i) => {
    const m = f.mix;
    const eq = m.L + m.M + m.S + m.U + m.F;
    const note = f.hedgedFrac > 0.05 ? `, ${pct(f.hedgedFrac)} of its equity is hedged` : "";
    lines.push(
      `- ${names[i]}: ${pct(f.share)} of portfolio, ${f.nHoldings} stocks, ${pct(f.amount ? eq / f.amount : 0)} equity${note}${f.asOf ? `, as of ${f.asOf}` : ""}`,
    );
  });

  lines.push("", `Look-through: ${a.uniqueStocks} unique stocks, behaving like ${a.effectiveStocks.toFixed(0)} equal-sized ones.`);
  lines.push(`${pct(a.redundancy, true)} of the equity money is in stocks held by two or more funds.`);

  const mix = Object.entries(a.mix)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${LABEL[k] ?? k} ${pct(v / a.total)}`);
  lines.push("", `Mix: ${mix.join(", ")}.`);

  lines.push("", "Top stocks (share of whole portfolio, cap, sector, number of funds holding):");
  for (const s of a.stocks.slice(0, 25)) {
    lines.push(`- ${s.name}: ${pct(s.share)}, ${LABEL[s.cap] ?? s.cap}, ${s.macro}, in ${s.fundCount} of ${a.funds.length} funds`);
  }

  if (a.equityExposure) {
    lines.push("", "Sectors (share of stock money):");
    for (const s of a.sectors) lines.push(`- ${s.sector}: ${pct(s.exposure / a.equityExposure)}`);
  }

  if (a.topPairs.length) {
    lines.push("", "Most overlapping fund pairs (0% = nothing shared, 100% = identical):");
    for (const p of a.topPairs.slice(0, 6)) lines.push(`- ${names[p.a]} + ${names[p.b]}: ${pct(p.overlap, true)}, ${p.shared} stocks in common`);
  }
  return lines.join("\n");
}

const LABEL: Record<string, string> = { L: "large cap", M: "mid cap", S: "small cap", U: "size unknown", F: "overseas", debt: "debt", cash: "cash", hedged: "hedged equity", other: "other" };

export interface Turn {
  role: "user" | "assistant";
  content: string;
}

/** Streams an answer; resolves with the full text. Throws an Error with a message fit for the UI. */
export async function ask(apiKey: string, model: string, context: string, history: Turn[], onText: (t: string) => void, signal?: AbortSignal): Promise<string> {
  // ponytail: key is typed by the person and sent straight from their browser; no proxy, so it can't be hidden from DevTools.
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  try {
    const stream = client.beta.messages.stream(
      {
        model,
        max_tokens: 16000,
        // Haiku has no server-side refusal fallback; every other listed model does.
        ...(model.includes("haiku") ? {} : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }),
        system: [{ type: "text", text: SYSTEM }],
        messages: [
          { role: "user", content: `My portfolio, as a look-through summary:\n\n${context}` },
          { role: "assistant", content: "Got it. What would you like to know?" },
          ...history,
        ],
      },
      { signal },
    );
    stream.on("text", onText);
    const msg = await stream.finalMessage();
    if (msg.stop_reason === "refusal") throw new Error("The model declined to answer that. Try asking it differently.");
    return msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  } catch (e) {
    if (signal?.aborted) throw e;
    if (e instanceof Anthropic.AuthenticationError) throw new Error("That API key was rejected. Check it and try again.");
    if (e instanceof Anthropic.RateLimitError) throw new Error("Rate limited. Wait a moment and ask again.");
    if (e instanceof Anthropic.APIConnectionError) throw new Error("Could not reach the API. Check your connection.");
    if (e instanceof Anthropic.APIError) throw new Error(`The API returned an error (${e.status}): ${e.message}`);
    throw e;
  }
}
