import { useEffect, useRef } from "react";
import type { Analysis, FundInfo, StockAgg } from "../core/analyze";
import { pct, rupeesShort, shortName } from "../core/format";
import { fundColor, rgba } from "./colors";
import { hideTip, showTip } from "./tooltip";

/**
 * The hero. One ring, read clockwise from the top:
 *  - each arc is a fund, its length is the share of your money in it;
 *  - the rays outside an arc are the stocks inside that fund (longer ray = bigger holding);
 *  - a bright ray is a stock another fund of yours also holds;
 *  - a ribbon inside the ring joins two funds, and its width is the money they both put in shared stocks.
 */

const TAU = Math.PI * 2;
const START = -Math.PI / 2;
const GAP = 0.05;
const RING = 12;
const MAX_TICKS = 64;
const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const smooth = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};
const reduceMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

interface Arc { f: FundInfo; i: number; a0: number; a1: number; mid: number; color: string }
interface Tick { stock: StockAgg; arc: number; ang: number; width: number; shared: boolean; x0: number; y0: number; x1: number; y1: number; len: number }
interface Ribbon { i: number; j: number; value: number; shared: StockAgg[]; path: Path2D; ax: number; ay: number; bx: number; by: number }
interface Model { cx: number; cy: number; R: number; arcs: Arc[]; ticks: Tick[]; ribbons: Ribbon[]; labels: boolean }
type Hover = { k: "fund"; i: number } | { k: "ribbon"; r: number } | { k: "stock"; key: string } | null;

function build(a: Analysis, w: number, h: number): Model {
  const labels = w >= 900;
  let cx: number, cy: number, R: number;
  if (labels) {
    const x0 = w * 0.42;
    cx = (x0 + w) / 2;
    cy = h / 2 + 18;
    R = Math.max(120, Math.min((w - x0) / 2 - 175, h / 2 - 120, 340));
  } else {
    cx = w / 2;
    cy = h * 0.69;
    R = Math.max(70, Math.min(w / 2 - 52, 150));
  }

  const n = a.funds.length;
  const span = TAU - n * GAP;
  const arcs: Arc[] = [];
  let at = START + GAP / 2;
  a.funds.forEach((f, i) => {
    const len = f.share * span;
    arcs.push({ f, i, a0: at, a1: at + len, mid: at + len / 2, color: fundColor(f.slot) });
    at += len + GAP;
  });

  // rays: the stocks inside each fund
  const ticks: Tick[] = [];
  const tickMax = labels ? 40 : 30;
  arcs.forEach((arc) => {
    const list = a.stocks.filter((s) => s.byFund[arc.f.id]).sort((x, y) => y.byFund[arc.f.id] - x.byFund[arc.f.id]).slice(0, MAX_TICKS);
    const sum = list.reduce((t, s) => t + s.byFund[arc.f.id], 0);
    if (!sum) return;
    const pad = Math.min(0.012, (arc.a1 - arc.a0) * 0.05);
    const room = arc.a1 - arc.a0 - pad * 2;
    let acc = arc.a0 + pad;
    for (const s of list) {
      const ex = s.byFund[arc.f.id];
      const da = (ex / sum) * room;
      const ang = acc + da / 2;
      acc += da;
      const len = Math.min(tickMax, 5 + 74 * Math.sqrt(ex / arc.f.amount));
      const r0 = R + RING / 2 + 7;
      ticks.push({
        stock: s,
        arc: arc.i,
        ang,
        width: Math.max(1, Math.min(3, da * R - 1)),
        shared: s.fundCount > 1,
        x0: cx + Math.cos(ang) * r0,
        y0: cy + Math.sin(ang) * r0,
        x1: cx + Math.cos(ang) * (r0 + len),
        y1: cy + Math.sin(ang) * (r0 + len),
        len,
      });
    }
  });

  // ribbons: money two funds both hold in the same stocks
  const pair = new Map<string, { i: number; j: number; v: number; s: StockAgg[] }>();
  const idx = new Map(a.funds.map((f, i) => [f.id, i]));
  for (const s of a.stocks) {
    if (s.fundCount < 2) continue;
    const held = Object.entries(s.byFund).map(([id, v]) => [idx.get(id)!, v] as const).sort((x, y) => x[0] - y[0]);
    for (let p = 0; p < held.length; p++)
      for (let q = p + 1; q < held.length; q++) {
        const key = held[p][0] + "|" + held[q][0];
        const e = pair.get(key) ?? { i: held[p][0], j: held[q][0], v: 0, s: [] };
        e.v += Math.min(held[p][1], held[q][1]);
        e.s.push(s);
        pair.set(key, e);
      }
  }
  const pairs = [...pair.values()].sort((x, y) => y.v - x.v);
  const rScale = span / (a.total || 1); // radians per rupee, same scale as the arcs
  // how much arc each fund needs for its ribbons, shrunk if a stock is counted in several pairs
  const need = new Array<number>(n).fill(0);
  for (const e of pairs) {
    need[e.i] += e.v * rScale;
    need[e.j] += e.v * rScale;
  }
  const shrink = arcs.map((arc, i) => (need[i] > 0 ? Math.min(1, ((arc.a1 - arc.a0) * 0.9) / need[i]) : 1));
  const cursor = arcs.map((arc, i) => arc.a0 + ((arc.a1 - arc.a0) - Math.min(need[i] * shrink[i], (arc.a1 - arc.a0) * 0.9)) / 2);
  // order each fund's ribbons so they leave toward their partner and don't cross needlessly
  const slot = new Map<string, [number, number]>();
  arcs.forEach((_, f) => {
    const mine = pairs
      .filter((e) => e.i === f || e.j === f)
      .sort((x, y) => ((((y.i === f ? y.j : y.i) - f + n) % n) - (((x.i === f ? x.j : x.i) - f + n) % n)));
    for (const e of mine) {
      const wdt = e.v * rScale * shrink[f];
      slot.set(`${e.i}|${e.j}|${f}`, [cursor[f], cursor[f] + wdt]);
      cursor[f] += wdt;
    }
  });
  const rr = R - RING / 2 - 3;
  const pt = (ang: number, r = rr) => [cx + Math.cos(ang) * r, cy + Math.sin(ang) * r] as const;
  const ribbons: Ribbon[] = pairs.map((e) => {
    const [a0, a1] = slot.get(`${e.i}|${e.j}|${e.i}`)!;
    const [b0, b1] = slot.get(`${e.i}|${e.j}|${e.j}`)!;
    const am = (a0 + a1) / 2;
    const bm = (b0 + b1) / 2;
    const [ax, ay] = pt(am);
    const [bx, by] = pt(bm);
    const qx = cx + ((ax + bx) / 2 - cx) * 0.18;
    const qy = cy + ((ay + by) / 2 - cy) * 0.18;
    const path = new Path2D();
    path.moveTo(...pt(a0));
    path.arc(cx, cy, rr, a0, a1);
    path.quadraticCurveTo(qx, qy, ...pt(b0));
    path.arc(cx, cy, rr, b0, b1);
    path.quadraticCurveTo(qx, qy, ...pt(a0));
    path.closePath();
    return { i: e.i, j: e.j, value: e.v, shared: e.s, path, ax, ay, bx, by };
  });

  return { cx, cy, R, arcs, ticks, ribbons, labels };
}

interface Props {
  analysis: Analysis;
  focus: string | null;
  onFocus: (id: string | null) => void;
}

export function Orbit({ analysis, focus, onFocus }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const focusRef = useRef(focus);
  const onFocusRef = useRef(onFocus);
  focusRef.current = focus;
  onFocusRef.current = onFocus;

  useEffect(() => {
    const el = wrap.current;
    const cv = canvas.current;
    if (!el || !cv) return;
    const ctx = cv.getContext("2d");
    const hit = document.createElement("canvas").getContext("2d");
    if (!ctx || !hit) return;

    const still = reduceMotion();
    const t0 = performance.now();
    let w = el.clientWidth;
    let h = el.clientHeight;
    let dpr = Math.min(2, window.devicePixelRatio || 1);
    let m = build(analysis, w, h);
    let hover: Hover = null;
    let running = true;
    let raf = 0;
    const n = analysis.funds.length;

    const draw = (now: number) => {
      const p = still ? 1 : (now - t0) / 1900;
      const sweep = START + ease(p) * TAU;
      const { cx, cy, R, arcs, ticks, ribbons } = m;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      // who is lit
      const fi = hover?.k === "fund" ? hover.i : hover ? -1 : arcs.findIndex((a) => a.f.id === focusRef.current);
      const stockKey = hover?.k === "stock" ? hover.key : null;
      const ribIdx = hover?.k === "ribbon" ? hover.r : -1;
      const any = fi >= 0 || stockKey != null || ribIdx >= 0;

      // quiet backdrop: a halo and two survey rings
      const halo = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 1.9);
      halo.addColorStop(0, "rgba(70,84,190,0.20)");
      halo.addColorStop(1, "rgba(70,84,190,0)");
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "rgba(255,255,255,0.055)";
      ctx.lineWidth = 1;
      for (const r of [R + 62, R + 104]) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, TAU);
        ctx.stroke();
      }

      // ribbons
      const rv = smooth((p - 0.45) / 0.5);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ribbons.forEach((r, k) => {
        const lit = ribIdx === k || (fi >= 0 && (r.i === fi || r.j === fi)) || (stockKey != null && r.shared.some((s) => s.key === stockKey));
        const a = (any ? (lit ? 0.62 : 0.035) : 0.2) * rv;
        const g = ctx.createLinearGradient(r.ax, r.ay, r.bx, r.by);
        g.addColorStop(0, rgba(arcs[r.i].color, a));
        g.addColorStop(1, rgba(arcs[r.j].color, a));
        ctx.fillStyle = g;
        ctx.fill(r.path);
        if (lit && any) {
          ctx.strokeStyle = rgba("#ffffff", 0.22 * rv);
          ctx.lineWidth = 1;
          ctx.stroke(r.path);
        }
      });
      ctx.restore();

      // centre hub
      const hub = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.42);
      hub.addColorStop(0, "rgba(11,16,32,0.96)");
      hub.addColorStop(0.7, "rgba(11,16,32,0.9)");
      hub.addColorStop(1, "rgba(11,16,32,0)");
      ctx.fillStyle = hub;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.42, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = smooth((p - 0.6) / 0.4);
      ctx.textAlign = "center";
      ctx.fillStyle = "#f0efec";
      const big = Math.max(20, Math.min(40, R * 0.2));
      ctx.font = `560 ${big}px 'Bricolage Grotesque Variable', system-ui, sans-serif`;
      ctx.fillText(rupeesShort(analysis.total), cx, cy + big * 0.12);
      ctx.fillStyle = "#9b9aab";
      ctx.font = "400 12.5px 'Geist Variable', system-ui, sans-serif";
      ctx.fillText(`in ${n} ${n === 1 ? "fund" : "funds"}`, cx, cy + big * 0.12 + 20);
      ctx.globalAlpha = 1;

      // arcs
      ctx.lineCap = "round";
      ctx.lineWidth = RING;
      const cap = (RING / 2) / R;
      arcs.forEach((a, i) => {
        const end = Math.min(a.a1 - cap, sweep);
        const start = a.a0 + cap;
        const on = !any || fi === i || (ribIdx >= 0 && (ribbons[ribIdx].i === i || ribbons[ribIdx].j === i)) || (stockKey != null && ticks.some((t) => t.arc === i && t.stock.key === stockKey));
        ctx.globalAlpha = on ? 1 : 0.3;
        ctx.strokeStyle = a.color;
        ctx.shadowColor = a.color;
        ctx.shadowBlur = on && any ? 22 : 10;
        ctx.beginPath();
        if (end > start) ctx.arc(cx, cy, R, start, end);
        else if (sweep > start) ctx.arc(cx, cy, R, start, start + 0.001);
        ctx.stroke();
        ctx.shadowBlur = 0;
      });
      ctx.globalAlpha = 1;

      // rays
      for (const t of ticks) {
        if (t.ang > sweep) continue;
        const grow = ease((sweep - t.ang) / 0.7 + (still ? 1 : 0));
        const on = !any || fi === t.arc || (stockKey != null && t.stock.key === stockKey) || (ribIdx >= 0 && (ribbons[ribIdx].i === t.arc || ribbons[ribIdx].j === t.arc) && t.shared && ribbons[ribIdx].shared.includes(t.stock));
        const x1 = t.x0 + (t.x1 - t.x0) * grow;
        const y1 = t.y0 + (t.y1 - t.y0) * grow;
        const color = arcs[t.arc].color;
        const tw = still || !t.shared ? 0 : Math.sin(now * 0.0016 + t.ang * 9) * 0.12;
        ctx.globalAlpha = on ? 1 : 0.14;
        ctx.strokeStyle = t.shared ? rgba("#f6f4ff", 0.95 + tw) : rgba(color, 0.62);
        ctx.lineWidth = t.width;
        ctx.lineCap = "butt";
        ctx.beginPath();
        ctx.moveTo(t.x0, t.y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
        if (t.shared && grow > 0.9) {
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(x1, y1, 1.9 + (stockKey === t.stock.key ? 1.4 : 0), 0, TAU);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      // names around the ring (wide screens; phones get the chips below)
      if (m.labels) {
        ctx.globalAlpha = smooth((p - 0.7) / 0.3);
        const placed: { x: number; y: number }[] = [];
        arcs.forEach((a, i) => {
          if (a.a1 - a.a0 < 0.1) return;
          const rl = R + RING / 2 + 7 + 40 + 18;
          const x = cx + Math.cos(a.mid) * rl;
          const y = cy + Math.sin(a.mid) * rl;
          if (placed.some((q) => Math.abs(q.x - x) < 150 && Math.abs(q.y - y) < 34)) return;
          placed.push({ x, y });
          const c = Math.cos(a.mid);
          ctx.textAlign = c > 0.3 ? "left" : c < -0.3 ? "right" : "center";
          const on = !any || fi === i;
          ctx.globalAlpha = (on ? 1 : 0.35) * smooth((p - 0.7) / 0.3);
          ctx.fillStyle = "#f0efec";
          ctx.font = "500 13px 'Geist Variable', system-ui, sans-serif";
          ctx.fillText(shortName(a.f.name, 22), x, y);
          ctx.fillStyle = "#9b9aab";
          ctx.font = "400 12px 'Geist Variable', system-ui, sans-serif";
          ctx.fillText(`${rupeesShort(a.f.amount)} · ${pct(a.f.share)}`, x, y + 16);
        });
        ctx.globalAlpha = 1;
      }
    };

    const frame = (t: number) => {
      if (!running) return;
      draw(t);
      raf = requestAnimationFrame(frame);
    };
    const resize = () => {
      w = el.clientWidth;
      h = el.clientHeight;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      cv.style.width = w + "px";
      cv.style.height = h + "px";
      m = build(analysis, w, h);
      if (still) draw(0);
    };
    resize();
    if (!still) raf = requestAnimationFrame(frame);
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !running && !still) {
        running = true;
        raf = requestAnimationFrame(frame);
      } else if (!e.isIntersecting) {
        running = false;
        cancelAnimationFrame(raf);
      }
    });
    io.observe(el);

    // ---- pointer -----------------------------------------------------------
    const pick = (px: number, py: number): Hover => {
      const { cx, cy, R, arcs, ticks, ribbons } = m;
      const dx = px - cx;
      const dy = py - cy;
      const r = Math.hypot(dx, dy);
      let th = Math.atan2(dy, dx);
      if (th < START) th += TAU;
      if (Math.abs(r - R) <= RING / 2 + 5) {
        const a = arcs.find((x) => th >= x.a0 - 0.02 && th <= x.a1 + 0.02);
        if (a) return { k: "fund", i: a.i };
      }
      if (r > R + 4) {
        let best: Tick | null = null;
        let bd = 6.5;
        for (const t of ticks) {
          const vx = t.x1 - t.x0;
          const vy = t.y1 - t.y0;
          const u = Math.max(0, Math.min(1, ((px - t.x0) * vx + (py - t.y0) * vy) / (vx * vx + vy * vy || 1)));
          const d = Math.hypot(px - (t.x0 + vx * u), py - (t.y0 + vy * u)) - (t.shared ? 1.5 : 0);
          if (d < bd) {
            bd = d;
            best = t;
          }
        }
        if (best) return { k: "stock", key: best.stock.key };
      }
      if (r < R - RING / 2) {
        for (let k = ribbons.length - 1; k >= 0; k--) if (hit.isPointInPath(ribbons[k].path, px, py)) return { k: "ribbon", r: k };
      }
      return null;
    };

    const fundById = new Map(analysis.funds.map((f) => [f.id, f]));
    const tip = (hv: Hover, x: number, y: number) => {
      if (!hv) return hideTip();
      if (hv.k === "fund") {
        const f = m.arcs[hv.i].f;
        showTip(
          {
            title: f.name,
            color: fundColor(f.slot),
            rows: [
              { k: "In this fund", v: rupeesShort(f.amount) },
              { k: "Share of portfolio", v: pct(f.share) },
              { k: "Stocks held", v: String(f.nHoldings) },
            ],
            note: "Click to isolate this fund",
          },
          x,
          y,
        );
      } else if (hv.k === "ribbon") {
        const r = m.ribbons[hv.r];
        const A = m.arcs[r.i].f;
        const B = m.arcs[r.j].f;
        const top = [...r.shared].sort((s1, s2) => Math.min(s2.byFund[A.id], s2.byFund[B.id]) - Math.min(s1.byFund[A.id], s1.byFund[B.id])).slice(0, 4);
        showTip(
          {
            title: `${shortName(A.name, 20)} × ${shortName(B.name, 20)}`,
            rows: [
              { k: "Overlap", v: pct(analysis.overlap[r.i][r.j]) },
              { k: "Stocks in both", v: String(r.shared.length) },
              { k: "Money in shared stocks", v: rupeesShort(r.value) },
              ...top.map((s) => ({ k: s.name, v: "" })),
            ],
          },
          x,
          y,
        );
      } else {
        const s = analysis.stocks.find((q) => q.key === hv.key)!;
        showTip(
          {
            title: s.name,
            rows: [
              { k: "Your money in it", v: `${rupeesShort(s.exposure)} · ${pct(s.share)}` },
              ...Object.entries(s.byFund)
                .sort((p1, p2) => p2[1] - p1[1])
                .map(([id, v]) => ({ k: shortName(fundById.get(id)?.name ?? "", 24), v: rupeesShort(v), color: fundColor(fundById.get(id)?.slot ?? 99) })),
            ],
            note: s.fundCount > 1 ? `Held through ${s.fundCount} of your funds` : undefined,
          },
          x,
          y,
        );
      }
    };

    const onMove = (e: PointerEvent) => {
      const rect = cv.getBoundingClientRect();
      hover = pick(e.clientX - rect.left, e.clientY - rect.top);
      cv.style.cursor = hover?.k === "fund" ? "pointer" : hover ? "crosshair" : "default";
      tip(hover, e.clientX, e.clientY);
      if (still) draw(0);
    };
    const onDown = (e: PointerEvent) => e.pointerType === "touch" && onMove(e);
    const onLeave = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      hover = null;
      hideTip();
      if (still) draw(0);
    };
    const onClick = (e: MouseEvent) => {
      const rect = cv.getBoundingClientRect();
      const hv = pick(e.clientX - rect.left, e.clientY - rect.top);
      const id = hv?.k === "fund" ? m.arcs[hv.i].f.id : null;
      onFocusRef.current(id && focusRef.current === id ? null : id);
      if (still) draw(0);
    };
    cv.addEventListener("pointermove", onMove);
    cv.addEventListener("pointerdown", onDown);
    cv.addEventListener("pointerleave", onLeave);
    cv.addEventListener("click", onClick);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      cv.removeEventListener("pointermove", onMove);
      cv.removeEventListener("pointerdown", onDown);
      cv.removeEventListener("pointerleave", onLeave);
      cv.removeEventListener("click", onClick);
      hideTip();
    };
  }, [analysis]);

  const { funds, uniqueStocks } = analysis;
  return (
    <div ref={wrap} className="constellation">
      <canvas
        ref={canvas}
        role="img"
        aria-label={`Ring of ${funds.length} funds. Each arc is a fund sized by your money in it; rays are its ${uniqueStocks} stocks; ribbons join funds that hold the same stocks.`}
      />
    </div>
  );
}
