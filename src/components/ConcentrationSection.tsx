import { useEffect, useRef, useState } from "react";
import { hierarchy, treemap, treemapSquarify } from "d3-hierarchy";
import type { StockAgg } from "../core/analyze";
import { pct, rupeesShort, shortName } from "../core/format";
import { usePortfolio } from "../core/store";
import { FundLegend, StackedRows } from "./StackedRows";
import { MIX_COLOR, MIX_INK, MIX_LABEL, fundColor } from "./colors";
import { hideTip, showTip } from "./tooltip";

const clean = (n: string) => n.replace(/\b(limited|ltd\.?)\b/gi, "").replace(/\s+/g, " ").trim();
const joinNames = (xs: string[]) => (xs.length <= 1 ? xs.join("") : xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1]);

interface Leaf {
  name: string;
  value: number;
  stock?: StockAgg;
  rest?: number;
}

function Treemap({ stocks, total, onPick }: { stocks: StockAgg[]; total: number; onPick?: (k: string | null) => void }) {
  const { analysis: a } = usePortfolio();
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(800);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const h = Math.round(Math.max(300, Math.min(520, w * 0.62)));

  const top = stocks.slice(0, 44);
  const rest = stocks.slice(44);
  const leaves: Leaf[] = top.map((s) => ({ name: s.name, value: s.exposure, stock: s }));
  if (rest.length) leaves.push({ name: `${rest.length} smaller holdings`, value: rest.reduce((x, s) => x + s.exposure, 0), rest: rest.length });

  const root = hierarchy<{ children?: Leaf[] } & Partial<Leaf>>({ children: leaves }).sum((d) => d.value ?? 0);
  treemap<typeof root.data>().size([w, h]).paddingInner(2).round(true).tile(treemapSquarify)(root);
  const fundById = new Map(a.funds.map((f) => [f.id, f]));

  return (
    <div ref={ref} className="treemap">
      <svg width={w} height={h} role="img" aria-label="Treemap of your look-through stock holdings, sized by rupees">
        {root.leaves().map((n, i) => {
          const d = n.data as Leaf;
          const x0 = (n as unknown as { x0: number }).x0;
          const y0 = (n as unknown as { y0: number }).y0;
          const cw = (n as unknown as { x1: number }).x1 - x0;
          const ch = (n as unknown as { y1: number }).y1 - y0;
          const cap = d.stock?.cap ?? "other";
          const fill = d.stock ? MIX_COLOR[d.stock.cap] : MIX_COLOR.other;
          const ink = d.stock ? MIX_INK[d.stock.cap] : MIX_INK.other;
          const showName = cw > 66 && ch > 30;
          const showPct = cw > 66 && ch > 48;
          return (
            <g
              key={i}
              data-tip=""
              transform={`translate(${x0},${y0})`}
              onPointerDown={(e) => e.pointerType === "touch" && e.currentTarget.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: e.clientX, clientY: e.clientY }))}
              onPointerMove={(e) => {
                onPick?.(d.stock?.key ?? null);
                showTip(
                  d.stock
                    ? {
                        title: d.stock.name,
                        rows: [
                          { k: "Size", v: MIX_LABEL[d.stock.cap], color: fill },
                          { k: "Sector", v: d.stock.industry ?? d.stock.macro },
                          { k: "Your money in it", v: `${rupeesShort(d.stock.exposure)} · ${pct(d.stock.share)}` },
                          ...Object.entries(d.stock.byFund)
                            .sort((p, q) => q[1] - p[1])
                            .map(([fid, v]) => ({ k: shortName(fundById.get(fid)?.name ?? "", 24), v: rupeesShort(v), color: fundColor(fundById.get(fid)?.slot ?? 99) })),
                        ],
                      }
                    : { title: d.name, rows: [{ k: "Together", v: `${rupeesShort(d.value)} · ${pct(d.value / total)}` }] },
                  e.clientX,
                  e.clientY,
                );
              }}
              onPointerLeave={(e) => {
                if (e.pointerType === "touch") return;
                onPick?.(null);
                hideTip();
              }}
            >
              <rect width={cw} height={ch} rx={3} fill={fill} opacity={cap === "other" ? 0.6 : 1} />
              {showName && (
                <text x={8} y={19} fill={ink} fontSize={12.5} fontWeight={600}>
                  {clip(clean(d.name), Math.floor((cw - 14) / 6.6))}
                </text>
              )}
              {showPct && (
                <text x={8} y={36} fill={ink} fontSize={12} opacity={0.82}>
                  {pct(d.value / total)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, Math.max(1, n - 1)).trimEnd() + "…" : s);

export function ConcentrationSection() {
  const { analysis: a } = usePortfolio();
  if (!a.stocks.length) return null;
  const top3 = a.stocks.slice(0, 3);
  const top3share = top3.reduce((x, s) => x + s.share, 0);
  const n10 = Math.min(10, a.stocks.length);
  const top10 = a.stocks.slice(0, n10);
  const top10share = top10.reduce((x, s) => x + s.exposure, 0) / a.equityExposure;

  const capsPresent = [...new Set(a.stocks.map((s) => s.cap))];
  const order = ["L", "M", "S", "F", "U"] as const;

  return (
    <section className="section" aria-labelledby="conc-title">
      <div className="section-head">
        <h2 id="conc-title">
          {joinNames(top3.map((s) => clean(s.name)))} {top3.length === 1 ? "makes up" : "make up"} {pct(top3share)} of everything you own.
        </h2>
        <p>
          Add up what every fund holds and {n10} stocks account for {pct(top10share)} of your equity money. Box area is rupees, so a stock
          held by several funds shows up as one big box.
        </p>
      </div>

      <div className="conc-grid">
        <div>
          <Treemap stocks={a.stocks} total={a.total} />
          <ul className="mixkey">
            {order
              .filter((k) => capsPresent.includes(k))
              .map((k) => (
                <li key={k}>
                  <i style={{ background: MIX_COLOR[k] }} />
                  {MIX_LABEL[k]}
                </li>
              ))}
          </ul>
        </div>
        <div>
          <h3 className="sub flush">Your ten biggest, by fund</h3>
          <FundLegend funds={a.funds} />
          <StackedRows
            rows={top10.map((s) => ({ key: s.key, label: clean(s.name), sub: s.fundCount > 1 ? `in ${s.fundCount} funds` : undefined, total: s.exposure, byFund: s.byFund }))}
            funds={a.funds}
            portfolioTotal={a.total}
          />
        </div>
      </div>
    </section>
  );
}
