const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/** ₹12,34,567 */
export const rupees = (n: number) => "₹" + inr.format(Math.round(n));

/** ₹12.3 L, ₹1.24 Cr, ₹8,400 */
export function rupeesShort(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e7) return `₹${trim(n / 1e7, a >= 1e8 ? 1 : 2)} Cr`;
  if (a >= 1e5) return `₹${trim(n / 1e5, a >= 1e6 ? 1 : 2)} L`;
  return rupees(n);
}

function trim(v: number, d: number) {
  return v.toFixed(d).replace(/\.?0+$/, "");
}

/** 0.0731 -> "7.3%" ; keeps one decimal below 10%, none above */
export function pct(f: number, force1 = false): string {
  const v = f * 100;
  if (!isFinite(v)) return "0%";
  if (v === 0) return "0%";
  if (Math.abs(v) < 0.1) return "<0.1%";
  return (Math.abs(v) < 10 || force1 ? v.toFixed(1) : v.toFixed(0)) + "%";
}

export const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

export function monthYear(iso?: string): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso + "T00:00:00");
  return isNaN(+d) ? undefined : d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

/** "HDFC Flexi Cap Fund - Direct Plan - Growth" -> "HDFC Flexi Cap" */
export function shortName(name: string, max = 22): string {
  let s = name
    .replace(/\s*[-–]\s*(direct|regular)\b.*$/i, "")
    .replace(/\s*\((?:direct|regular).*$/i, "")
    .replace(/\b(fund|scheme)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (s.length > max) s = s.slice(0, max - 1).trimEnd() + "…";
  return s;
}
