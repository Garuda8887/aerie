import { useState } from "react";
import { MIX_KEYS } from "../core/analyze";
import { monthYear, pct, rupeesShort, shortName } from "../core/format";
import { usePortfolio } from "../core/store";
import { FundSheet } from "./FundSheet";
import { MIX_COLOR, MIX_LABEL, fundColor } from "./colors";
import { tipHandlers } from "./tooltip";

export function FundsSection({ onManage }: { onManage: () => void }) {
  const { analysis: a } = usePortfolio();
  const [open, setOpen] = useState<string | null>(null);
  if (!a.funds.length) return null;

  const notes = (i: number): string[] => {
    const f = a.funds[i];
    const out: string[] = [];
    if (f.hedgedFrac > 0.2) out.push(`${pct(f.hedgedFrac)} of its stock is hedged, so it's left out of overlap`);
    let bestJ = -1;
    for (let j = 0; j < a.funds.length; j++) {
      if (j === i) continue;
      if (a.overlap[i][j] >= 0.7 && a.funds[j].amount >= f.amount && (bestJ < 0 || a.overlap[i][j] > a.overlap[i][bestJ])) bestJ = j;
    }
    if (bestJ >= 0) out.push(`${pct(a.overlap[i][bestJ])} the same as ${shortName(a.funds[bestJ].name, 26)}`);
    return out;
  };

  return (
    <section className="section" aria-labelledby="funds-title">
      <div className="section-head">
        <h2 id="funds-title">Your {a.funds.length === 1 ? "fund" : `${a.funds.length} funds`}, one by one.</h2>
        <p>Open any fund to see every holding and what it adds to your portfolio.</p>
      </div>
      <ul className="funds">
        {a.funds.map((f, i) => {
          const fk = MIX_KEYS.filter((k) => f.mix[k] / f.amount > 0.0005);
          const nn = notes(i);
          return (
            <li key={f.id}>
              <button className="fund-row" onClick={() => setOpen(f.id)}>
                <span className="fr-main">
                  <i style={{ background: fundColor(f.slot) }} />
                  <span>
                    <b>{f.name}</b>
                    <small>
                      {f.demo ? "Demo fund" : f.amc}
                      {monthYear(f.asOf) ? ` · holdings as of ${monthYear(f.asOf)}` : ""} · {f.nHoldings} stocks
                    </small>
                  </span>
                </span>
                <span className="fr-bar" aria-hidden="true">
                  {fk.map((k) => (
                    <span
                      key={k}
                      className={k === "hedged" ? "hatch" : ""}
                      style={{ flexGrow: f.mix[k], background: MIX_COLOR[k] }}
                      {...tipHandlers(() => ({ title: MIX_LABEL[k], color: MIX_COLOR[k], rows: [{ k: "Of this fund", v: pct(f.mix[k] / f.amount) }] }))}
                    />
                  ))}
                </span>
                <span className="fr-amt">
                  <b>{rupeesShort(f.amount)}</b>
                  <small>{pct(f.share)} of total</small>
                </span>
                {nn.length > 0 && <span className="fr-note">{nn.join(" · ")}</span>}
              </button>
            </li>
          );
        })}
      </ul>
      <button className="btn ghost" onClick={onManage}>
        Add or change funds
      </button>
      {open && <FundSheet id={open} onClose={() => setOpen(null)} />}
    </section>
  );
}
