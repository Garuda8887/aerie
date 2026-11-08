import { useEffect, useRef, useState, type ReactNode } from "react";

/** Adds `in` the first time the block scrolls into view; the CSS under `.reveal` does the animating. */
export function Reveal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  // without IntersectionObserver, or with reduced motion, show everything straight away
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === "undefined" || matchMedia("(prefers-reduced-motion: reduce)").matches);

  useEffect(() => {
    const el = ref.current;
    if (seen || !el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        // row index drives the stagger in CSS (--i)
        el.querySelectorAll<HTMLElement>(".srow, .fundmix li, .funds li, .heldby li").forEach((r, i) => r.style.setProperty("--i", String(Math.min(i, 14))));
        setSeen(true);
        io.disconnect();
      },
      { rootMargin: "0px 0px -14% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);

  return (
    <div ref={ref} className={"reveal" + (seen ? " in" : "")}>
      {children}
    </div>
  );
}
