import type { MixKey } from "../core/analyze";

/** Eight validated categorical hues (dark-surface steps). Funds past the eighth fold to neutral. */
export const FUND_COLORS = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"];
export const FUND_NEUTRAL = "#8d90a8";
export const fundColor = (slot: number) => FUND_COLORS[slot] ?? FUND_NEUTRAL;

/** Ordinal blue ramp for cap tiers (lighter = bigger company), plus neutral buckets. */
export const MIX_COLOR: Record<MixKey, string> = {
  L: "#9ec5f4",
  M: "#3987e5",
  S: "#184f95",
  U: "#565b7d",
  F: "#7a6fb0",
  debt: "#6b7099",
  cash: "#9a9eb8",
  hedged: "#3a3f5f",
  other: "#2c3150",
};
export const MIX_LABEL: Record<MixKey, string> = {
  L: "Large cap",
  M: "Mid cap",
  S: "Small cap",
  U: "Equity, size unknown",
  F: "Overseas equity",
  debt: "Debt",
  cash: "Cash",
  hedged: "Hedged equity",
  other: "Other",
};
/** Ink that stays readable on each fill. */
export const MIX_INK: Record<MixKey, string> = {
  L: "#0b1020",
  M: "#ffffff",
  S: "#ffffff",
  U: "#ffffff",
  F: "#ffffff",
  debt: "#ffffff",
  cash: "#0b1020",
  hedged: "#e8e7f2",
  other: "#c3c2b7",
};

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const rgba = (hex: string, a: number) => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
};

/** 7-step blue ramp for the overlap matrix: dark = little overlap, light = a lot. */
export const OVERLAP_RAMP = ["#0d366b", "#104281", "#184f95", "#1c5cab", "#256abf", "#3987e5", "#6da7ec", "#9ec5f4", "#cde2fb"];
export function overlapFill(v: number): { bg: string; ink: string } {
  const i = Math.min(OVERLAP_RAMP.length - 1, Math.floor(v * OVERLAP_RAMP.length));
  return { bg: OVERLAP_RAMP[i], ink: i >= 6 ? "#0b1020" : "#ffffff" };
}
