import { pct, shortName } from "../core/format";
import { usePortfolio } from "../core/store";
import { fundColor, overlapFill } from "./colors";
import { tipHandlers } from "./tooltip";

const clean = (n: string) => n.replace(/\b(limited|ltd\.?)\b/gi, "").replace(/\s+/g, " ").trim();

export function OverlapSection() {
  const { analysis: a } = usePortfolio();
  const n = a.funds.length;
  if (n === 0) return null;

  const best = a.topPairs[0];
  const title =
    n < 2
      ? "Add a second fund to see how much they overlap."
      : best.overlap < 0.1
        ? "Your funds barely overlap. Each one is doing its own job."
        : `${shortName(a.funds[best.a].name, 26)} and ${shortName(a.funds[best.b].name, 26)} hold ${pct(best.overlap)} the same stocks.`;
  const sub =
    n < 2
      ? "Overlap is how much of two funds' stock portfolios match, counting the smaller weight of every shared stock."
      : `${pct(a.redundancy, true)} of your equity money sits in stocks that two or more of your funds both own. Overlap compares two funds\u2019 stock portfolios: for every stock both own, take the smaller of its two weights and add them up.`;

  const shared = a.stocks
    .filter((s) => s.fundCount >= 2)
    .sort((x, y) => y.fundCount - x.fundCount || y.exposure - x.exposure)
    .slice(0, 9);

  const sharedBetween = (i: number, j: number) => {
    const A = a.funds[i];
    const B = a.funds[j];
    return a.stocks
      .filter((s) => s.byFund[A.id] && s.byFund[B.id])
      .sort((x, y) => Math.min(y.byFund[A.id] / A.amount, y.byFund[B.id] / B.amount) - Math.min(x.byFund[A.id] / A.amount, x.byFund[B.id] / B.amount));
  };

  return (
    <section className="section" aria-labelledby="ov-title">
      <div className="section-head">
        <h2 id="ov-title">{title}</h2>
        <p>{sub}</p>
      </div>

      {n >= 2 && (
        <div className="ov-grid">
          <div className="matrix" style={{ gridTemplateColumns: `minmax(104px, 170px) repeat(${n}, minmax(34px, 1fr))` }} role="table" aria-label="Fund overlap matrix">
            <div />
            {a.funds.map((f, j) => (
              <div key={f.id} className="mx-col" role="columnheader" title={f.name}>
                <i style={{ background: fundColor(f.slot) }} />
                {j + 1}
              </div>
            ))}
            {a.funds.map((f, i) => (
              <div key={f.id} className="mx-row" role="row">
                <div className="mx-label" role="rowheader" title={f.name}>
                  <i style={{ background: fundColor(f.slot) }} />
                  <span className="mx-i">{i + 1}</span>
                  <span className="mx-name">{shortName(f.name, 30)}</span>
                </div>
                {a.funds.map((g, j) => {
                  if (i === j) return <div key={g.id} className="mx-cell self" role="cell" aria-hidden="true" />;
                  const v = a.overlap[i][j];
                  const { bg, ink } = overlapFill(v);
                  return (
                    <div
                      key={g.id}
                      className="mx-cell"
                      role="cell"
                      aria-label={`${f.name} and ${g.name}: ${pct(v)} overlap`}
                      style={{ background: bg, color: ink }}
                      {...tipHandlers(() => {
                        const sh = sharedBetween(i, j);
                        return {
                          title: `${shortName(f.name, 20)} × ${shortName(g.name, 20)}`,
                          rows: [
                            { k: "Overlap", v: pct(v) },
                            { k: "Stocks in both", v: String(sh.length) },
                            ...sh.slice(0, 4).map((s) => ({ k: clean(s.name), v: "" })),
                          ],
                        };
                      })}
                    >
                      {Math.round(v * 100)}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <ol className="mx-key" aria-hidden="true">
            {a.funds.map((f, i) => (
              <li key={f.id}>
                <i style={{ background: fundColor(f.slot) }} />
                {i + 1} {shortName(f.name, 30)}
              </li>
            ))}
          </ol>
          <div>
            <h3 className="sub flush">Stocks several of your funds own</h3>
            <ul className="heldby">
              {shared.map((s) => (
                <li key={s.key}>
                  <span className="hb-name">{clean(s.name)}</span>
                  <span className="hb-dots" aria-label={`Held by ${s.fundCount} of ${n} funds`}>
                    {a.funds.map((f) => (
                      <i
                        key={f.id}
                        className={s.byFund[f.id] ? "on" : ""}
                        style={s.byFund[f.id] ? { background: fundColor(f.slot) } : undefined}
                        {...tipHandlers(() => ({ title: f.name, color: fundColor(f.slot), note: s.byFund[f.id] ? "Holds " + clean(s.name) : "Does not hold " + clean(s.name) }))}
                      />
                    ))}
                  </span>
                  <b>{pct(s.share)}</b>
                </li>
              ))}
              {shared.length === 0 && <li className="empty">No stock appears in more than one fund.</li>}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}
