import { useEffect, useState } from "react";
import { pct, plural, rupeesShort, shortName } from "../core/format";
import { usePortfolio } from "../core/store";
import { Orbit } from "./Orbit";
import { fundColor } from "./colors";

const still = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Counts up from 0 to `target` so the headline numbers land with the ring's sweep. */
function useCountUp(target: number, ms = 1500): number {
  const [v, setV] = useState(() => (still() ? target : 0));
  useEffect(() => {
    if (still()) return setV(target);
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / ms);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

export function Hero({ onManage }: { onManage: () => void }) {
  const { analysis: a, isDemo, dispatch } = usePortfolio();
  const [focus, setFocus] = useState<string | null>(null);
  const n = a.funds.length;
  const eff = Math.max(1, Math.round(a.effectiveStocks));
  const stocksShown = useCountUp(a.uniqueStocks);
  const effShown = useCountUp(eff);

  return (
    <section className="hero" aria-labelledby="hero-title">
      <Orbit analysis={a} focus={focus} onFocus={setFocus} />

      <div className="hero-copy">
        {n === 0 ? (
          <>
            <h1 id="hero-title">Everything you own, seen from above.</h1>
            <p className="lede">
              Add the mutual funds you hold. Aerie opens up each one, lines up every stock inside them, and shows where they overlap.
              Your numbers never leave this device.
            </p>
            <div className="hero-actions">
              <button className="btn primary" onClick={onManage}>
                Add your funds
              </button>
              <button className="btn ghost" onClick={() => dispatch({ t: "demo" })}>
                See a demo portfolio
              </button>
            </div>
          </>
        ) : (
          <>
            <h1 id="hero-title" aria-label={a.uniqueStocks > 0 ? `You own ${a.uniqueStocks} stocks. It behaves like ${eff}.` : undefined}>
              {a.uniqueStocks > 0 ? (
                <>
                  <span aria-hidden="true">You own {stocksShown.toLocaleString("en-IN")} stocks.</span>
                  <span aria-hidden="true">It behaves like {effShown}.</span>
                </>
              ) : (
                <span>No stocks inside.</span>
              )}
            </h1>
            <p className="lede">
              {a.uniqueStocks === 0 ? (
                <>Your {rupeesShort(a.total)} sits in debt, cash and hedged positions, so there is no stock overlap to show.</>
              ) : n > 1 ? (
                <>
                  {rupeesShort(a.total)} across {plural(n, "fund")}. {pct(a.redundancy, true)} of your stock money sits in companies that two or more of
                  your funds both own.
                </>
              ) : (
                <>{rupeesShort(a.total)} in one fund. Add a second to see how much they overlap.</>
              )}
            </p>
            {isDemo && (
              <div className="hero-actions">
                <button className="btn primary" onClick={onManage}>
                  Use your own funds
                </button>
                <span className="note">Illustrative demo data</span>
              </div>
            )}
          </>
        )}
      </div>

      {n > 0 && (
        <div className="hero-foot">
          <ul className="legend" aria-label="Funds">
            {a.funds.map((f) => (
              <li key={f.id}>
                <button
                  className={"chip" + (focus === f.id ? " on" : "")}
                  aria-pressed={focus === f.id}
                  onClick={() => setFocus(focus === f.id ? null : f.id)}
                >
                  <i style={{ background: fundColor(f.slot) }} />
                  {shortName(f.name, 26)}
                  <span>{rupeesShort(f.amount)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
