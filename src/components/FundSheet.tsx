import { resolveCap } from "../core/analyze";
import { monthYear, pct, rupeesShort } from "../core/format";
import { macroSector } from "../core/sectors";
import { usePortfolio } from "../core/store";
import { Modal } from "./Modal";
import { MIX_COLOR, MIX_INK, MIX_LABEL } from "./colors";

export function FundSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const { state, analysis: a } = usePortfolio();
  const f = a.funds.find((x) => x.id === id);
  const scheme = state.schemes[id];
  if (!f || !scheme) return null;

  const eq = scheme.holdings.filter((h) => h.kind === "equity").sort((x, y) => y.pct - x.pct);
  const other = (k: string) => scheme.holdings.filter((h) => h.kind === k).reduce((s, h) => s + h.pct, 0);
  const extras = [
    ["Debt", other("debt")],
    ["Cash", other("cash")],
    ["Fund units", other("units")],
    ["Derivatives (net)", other("derivative")],
    ["Other", other("other")],
  ].filter(([, v]) => Math.abs(v as number) > 0.005) as [string, number][];

  return (
    <Modal onClose={onClose} label={scheme.name}>
      <header className="sheet-head">
        <div>
          <h3>{scheme.name}</h3>
          <p>
            {rupeesShort(f.amount)} of yours · {pct(f.share)} of your portfolio
            {monthYear(scheme.asOf) ? ` · holdings as of ${monthYear(scheme.asOf)}` : ""}
          </p>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </header>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Company</th>
              <th>Sector</th>
              <th>Size</th>
              <th className="num">% of fund</th>
              <th className="num">Your money</th>
            </tr>
          </thead>
          <tbody>
            {eq.map((h) => {
              const cap = resolveCap(h, state.capMap);
              return (
                <tr key={h.key}>
                  <td>{h.name}</td>
                  <td>{h.industry ?? macroSector(h.industry)}</td>
                  <td>
                    <span className="tag" style={{ background: MIX_COLOR[cap], color: MIX_INK[cap] }}>
                      {MIX_LABEL[cap].replace(" cap", "").replace("Equity, size unknown", "Unknown")}
                    </span>
                  </td>
                  <td className="num">{h.pct.toFixed(2)}%</td>
                  <td className="num">{rupeesShort((f.amount * h.pct) / 100)}</td>
                </tr>
              );
            })}
          </tbody>
          {extras.length > 0 && (
            <tfoot>
              {extras.map(([label, v]) => (
                <tr key={label}>
                  <td colSpan={3}>{label}</td>
                  <td className="num">{v.toFixed(2)}%</td>
                  <td className="num">{rupeesShort((f.amount * v) / 100)}</td>
                </tr>
              ))}
            </tfoot>
          )}
        </table>
      </div>
    </Modal>
  );
}
