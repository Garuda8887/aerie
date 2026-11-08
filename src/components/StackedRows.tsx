import type { FundInfo } from "../core/analyze";
import { pct, rupeesShort, shortName } from "../core/format";
import { fundColor } from "./colors";
import { tipHandlers } from "./tooltip";

export interface SRow {
  key: string;
  label: string;
  sub?: string;
  total: number;
  byFund: Record<string, number>;
}

export function FundLegend({ funds }: { funds: FundInfo[] }) {
  return (
    <ul className="fund-legend" aria-label="Fund colours">
      {funds.map((f) => (
        <li key={f.id}>
          <i style={{ background: fundColor(f.slot) }} />
          {shortName(f.name, 24)}
        </li>
      ))}
    </ul>
  );
}

/** Horizontal bars, one per row, each split by the funds that contribute to it. */
export function StackedRows({ rows, funds, portfolioTotal, denominator, valueLabel }: {
  rows: SRow[];
  funds: FundInfo[];
  portfolioTotal: number;
  /** what the row percentage is out of; defaults to the whole portfolio */
  denominator?: number;
  valueLabel?: string;
}) {
  const max = Math.max(...rows.map((r) => r.total), 1);
  const den = denominator ?? portfolioTotal;
  const slot = new Map(funds.map((f) => [f.id, f]));
  return (
    <ol className="srows">
      {rows.map((r) => (
        <li key={r.key} className="srow">
          <div className="srow-label">
            <span className="srow-name">{r.label}</span>
            {r.sub && <span className="srow-sub">{r.sub}</span>}
          </div>
          <div className="srow-track" aria-hidden="true">
            <div className="srow-bar" style={{ width: `${(r.total / max) * 100}%` }}>
              {Object.entries(r.byFund)
                .sort((a, b) => b[1] - a[1])
                .map(([fid, v]) => {
                  const f = slot.get(fid);
                  return (
                    <span
                      key={fid}
                      className="seg"
                      style={{ flexGrow: v, background: fundColor(f?.slot ?? 99) }}
                      {...tipHandlers(() => ({
                        title: r.label,
                        color: fundColor(f?.slot ?? 99),
                        rows: [
                          { k: shortName(f?.name ?? "", 30), v: rupeesShort(v) },
                          { k: "Share of this row", v: pct(v / r.total) },
                          { k: valueLabel ?? "Share of portfolio", v: pct(v / den) },
                        ],
                      }))}
                    />
                  );
                })}
            </div>
          </div>
          <div className="srow-val">
            <b>{pct(r.total / den)}</b>
            <span>{rupeesShort(r.total)}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}
