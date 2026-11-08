import { MIX_KEYS } from "../core/analyze";
import { pct, rupeesShort, shortName } from "../core/format";
import { usePortfolio } from "../core/store";
import { MIX_COLOR, MIX_INK, MIX_LABEL, fundColor } from "./colors";
import { tipHandlers } from "./tooltip";

export function SizeSection({ onManage }: { onManage: () => void }) {
  const { analysis: a } = usePortfolio();
  if (!a.total) return null;
  const { mix, total } = a;
  const equity = mix.L + mix.M + mix.S + mix.U + mix.F;
  const sizeKnown = mix.L + mix.M + mix.S;
  const keys = MIX_KEYS.filter((k) => mix[k] / total > 0.0005);

  let title: string;
  let sub: string;
  if (equity === 0) {
    title = "None of your money is in stocks right now.";
    sub = "Everything sits in debt, cash or hedged positions.";
  } else if (sizeKnown / equity < 0.25) {
    title = `${pct(equity / total)} of your money is in stocks, but we can't split it by company size yet.`;
    sub = "Load AMFI's half-yearly list of large, mid and small caps and this fills in.";
  } else {
    const top = (["L", "M", "S"] as const).reduce((m, k) => (mix[k] > mix[m] ? k : m), "L" as "L" | "M" | "S");
    const name = { L: "large caps", M: "mid caps", S: "small caps" }[top];
    title = `${pct(mix[top] / total)} of your money is in ${name}.`;
    const rest = (["L", "M", "S"] as const).filter((k) => k !== top && mix[k] > 0);
    sub =
      rest.map((k) => `${pct(mix[k] / total)} in ${MIX_LABEL[k].toLowerCase()}s`).join(", ") +
      `. ${pct((total - equity) / total)} is debt, cash or hedged.`;
  }

  const sorted = [...a.funds].sort((x, y) => y.amount - x.amount);
  const showCapCta = sizeKnown / Math.max(equity, 1) < 0.25 && equity > 0;

  return (
    <section className="section" aria-labelledby="size-title">
      <div className="section-head">
        <h2 id="size-title">{title}</h2>
        <p>{sub}</p>
        {showCapCta && (
          <button className="btn ghost" onClick={onManage}>
            Load the AMFI cap list
          </button>
        )}
      </div>

      <div className="mixbar" role="img" aria-label={keys.map((k) => `${MIX_LABEL[k]} ${pct(mix[k] / total)}`).join(", ")}>
        {keys.map((k) => (
          <div
            key={k}
            className={"mixseg" + (k === "hedged" ? " hatch" : "")}
            style={{ flexGrow: mix[k], background: MIX_COLOR[k], color: MIX_INK[k] }}
            {...tipHandlers(() => ({
              title: MIX_LABEL[k],
              color: MIX_COLOR[k],
              rows: [
                { k: "Amount", v: rupeesShort(mix[k]) },
                { k: "Share of portfolio", v: pct(mix[k] / total) },
              ],
            }))}
          >
            {mix[k] / total > 0.07 && (
              <>
                <b>{pct(mix[k] / total)}</b>
                <span>{MIX_LABEL[k]}</span>
              </>
            )}
          </div>
        ))}
      </div>
      <ul className="mixkey">
        {keys.map((k) => (
          <li key={k}>
            <i style={{ background: MIX_COLOR[k] }} className={k === "hedged" ? "hatch" : ""} />
            {MIX_LABEL[k]} <span>{rupeesShort(mix[k])}</span>
          </li>
        ))}
      </ul>

      <h3 className="sub">How each fund is built</h3>
      <ul className="fundmix">
        {sorted.map((f) => {
          const fk = MIX_KEYS.filter((k) => f.mix[k] / f.amount > 0.0005);
          return (
            <li key={f.id}>
              <span className="fm-name">
                <i style={{ background: fundColor(f.slot) }} />
                {shortName(f.name, 30)}
              </span>
              <div className="fm-bar">
                {fk.map((k) => (
                  <span
                    key={k}
                    className={"fm-seg" + (k === "hedged" ? " hatch" : "")}
                    style={{ flexGrow: f.mix[k], background: MIX_COLOR[k] }}
                    {...tipHandlers(() => ({
                      title: shortName(f.name, 34),
                      color: fundColor(f.slot),
                      rows: [
                        { k: MIX_LABEL[k], v: pct(f.mix[k] / f.amount), color: MIX_COLOR[k] },
                        { k: "Amount", v: rupeesShort(f.mix[k]) },
                      ],
                    }))}
                  />
                ))}
              </div>
              <span className="fm-amt">{rupeesShort(f.amount)}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
