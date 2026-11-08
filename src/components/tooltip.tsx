import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";

export interface TipContent {
  title: string;
  color?: string;
  rows?: { k: string; v: string; color?: string }[];
  note?: string;
}
interface TipState {
  content: TipContent | null;
  x: number;
  y: number;
}

let state: TipState = { content: null, x: 0, y: 0 };
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export function showTip(content: TipContent, x: number, y: number) {
  state = { content, x, y };
  emit();
}
export function hideTip() {
  if (!state.content) return;
  state = { ...state, content: null };
  emit();
}

const useTip = () =>
  useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => state,
  );

/** Helpers so any element can get a tooltip with two props. */
export function tipHandlers(get: () => TipContent) {
  return {
    "data-tip": "",
    onPointerMove: (e: React.PointerEvent) => showTip(get(), e.clientX, e.clientY),
    // touch has no hover: show on tap, let the next tap or a scroll clear it
    onPointerDown: (e: React.PointerEvent) => e.pointerType === "touch" && showTip(get(), e.clientX, e.clientY),
    onPointerLeave: (e: React.PointerEvent) => e.pointerType !== "touch" && hideTip(),
  };
}

if (typeof window !== "undefined") {
  window.addEventListener("scroll", hideTip, { passive: true });
  window.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "touch" && !(e.target as HTMLElement | null)?.closest?.("[data-tip]")) hideTip();
  });
}

export function TooltipLayer(): ReactNode {
  const s = useTip();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !s.content) return;
    const pad = 14;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    let x = s.x + pad;
    let y = s.y + pad;
    if (x + w > window.innerWidth - 8) x = s.x - w - pad;
    if (y + h > window.innerHeight - 8) y = s.y - h - pad;
    el.style.transform = `translate(${Math.max(8, x)}px, ${Math.max(8, y)}px)`;
  });
  if (!s.content) return null;
  const c = s.content;
  return (
    <div ref={ref} className="tip" role="tooltip">
      <div className="tip-title">
        {c.color && <i style={{ background: c.color }} />}
        {c.title}
      </div>
      {c.rows?.map((r, i) => (
        <div className="tip-row" key={i}>
          <span>
            {r.color && <i style={{ background: r.color }} />}
            {r.k}
          </span>
          <b>{r.v}</b>
        </div>
      ))}
      {c.note && <div className="tip-note">{c.note}</div>}
    </div>
  );
}
