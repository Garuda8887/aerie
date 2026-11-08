import type { Cap, Holding, Position, Scheme } from "./types";

/**
 * ILLUSTRATIVE DEMO DATA. The funds are fictional and the weights are generated, so the
 * dashboard has something to show on first load. Company names are real listed companies
 * used only as familiar labels; nothing here is a real fund's holdings.
 */

type U = [name: string, industry: string, cap: Cap, base: number];

const UNIVERSE: U[] = [
  ["HDFC Bank", "Banks", "L", 10], ["Reliance Industries", "Petroleum Products", "L", 8],
  ["ICICI Bank", "Banks", "L", 8], ["Infosys", "IT - Software", "L", 6],
  ["Bharti Airtel", "Telecom - Services", "L", 4.5], ["Tata Consultancy Services", "IT - Software", "L", 4],
  ["Larsen & Toubro", "Construction", "L", 4], ["ITC", "Diversified FMCG", "L", 4],
  ["State Bank of India", "Banks", "L", 3.5], ["Axis Bank", "Banks", "L", 3.5],
  ["Kotak Mahindra Bank", "Banks", "L", 3], ["Bajaj Finance", "Finance", "L", 3],
  ["Mahindra & Mahindra", "Automobiles", "L", 3], ["Hindustan Unilever", "Diversified FMCG", "L", 2.5],
  ["Sun Pharmaceutical", "Pharmaceuticals & Biotechnology", "L", 2.5], ["Maruti Suzuki", "Automobiles", "L", 2],
  ["Titan Company", "Consumer Durables", "L", 2], ["NTPC", "Power", "L", 2],
  ["HCL Technologies", "IT - Software", "L", 2], ["UltraTech Cement", "Cement & Cement Products", "L", 1.5],
  ["Asian Paints", "Consumer Durables", "L", 1.5], ["Tata Steel", "Ferrous Metals", "L", 1.5],
  ["Power Grid Corporation", "Power", "L", 1.5], ["Bajaj Finserv", "Finance", "L", 1.5],
  ["Hindalco Industries", "Non - Ferrous Metals", "L", 1.5], ["Trent", "Retailing", "L", 1.4],
  ["Apollo Hospitals", "Healthcare Services", "L", 1.3], ["Cipla", "Pharmaceuticals & Biotechnology", "L", 1.2],
  ["Eicher Motors", "Automobiles", "L", 1.2], ["Divi's Laboratories", "Pharmaceuticals & Biotechnology", "L", 1],

  ["Persistent Systems", "IT - Software", "M", 3], ["Max Healthcare Institute", "Healthcare Services", "M", 2.8],
  ["Indian Hotels", "Leisure Services", "M", 2.6], ["Federal Bank", "Banks", "M", 2.6],
  ["Coforge", "IT - Software", "M", 2.4], ["Polycab India", "Industrial Products", "M", 2.4],
  ["Muthoot Finance", "Finance", "M", 2.2], ["Cummins India", "Industrial Products", "M", 2.2],
  ["Voltas", "Consumer Durables", "M", 2], ["Balkrishna Industries", "Auto Components", "M", 2],
  ["Supreme Industries", "Industrial Products", "M", 1.9], ["Astral", "Industrial Products", "M", 1.9],
  ["Page Industries", "Textiles & Apparels", "M", 1.8], ["Oberoi Realty", "Realty", "M", 1.8],
  ["Mphasis", "IT - Services", "M", 1.8], ["Lupin", "Pharmaceuticals & Biotechnology", "M", 1.8],
  ["Bharat Forge", "Auto Components", "M", 1.7], ["Tube Investments of India", "Auto Components", "M", 1.7],
  ["Godrej Properties", "Realty", "M", 1.6], ["AU Small Finance Bank", "Banks", "M", 1.6],
  ["Fortis Healthcare", "Healthcare Services", "M", 1.5], ["SRF", "Chemicals & Petrochemicals", "M", 1.5],
  ["PI Industries", "Fertilizers & Agrochemicals", "M", 1.4], ["Alkem Laboratories", "Pharmaceuticals & Biotechnology", "M", 1.4],
  ["Sundaram Finance", "Finance", "M", 1.3], ["Phoenix Mills", "Realty", "M", 1.3],

  ["Neuland Laboratories", "Pharmaceuticals & Biotechnology", "S", 2.4], ["Gabriel India", "Auto Components", "S", 2.2],
  ["Ratnamani Metals & Tubes", "Industrial Products", "S", 2.2], ["Sansera Engineering", "Auto Components", "S", 2],
  ["Rainbow Children's Medicare", "Healthcare Services", "S", 2], ["Aether Industries", "Chemicals & Petrochemicals", "S", 1.8],
  ["Kirloskar Oil Engines", "Industrial Products", "S", 1.8], ["Techno Electric & Engineering", "Construction", "S", 1.7],
  ["Craftsman Automation", "Auto Components", "S", 1.7], ["CarTrade Tech", "Retailing", "S", 1.5],
  ["VA Tech Wabag", "Construction", "S", 1.5], ["Cera Sanitaryware", "Consumer Durables", "S", 1.4],
  ["Sudarshan Chemical Industries", "Chemicals & Petrochemicals", "S", 1.4], ["Mold-Tek Packaging", "Industrial Products", "S", 1.2],
  ["Sharda Cropchem", "Fertilizers & Agrochemicals", "S", 1.2], ["Equitas Small Finance Bank", "Banks", "S", 1.2],
];

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

interface Spec {
  name: string;
  seed: number;
  amount: number;
  counts: Partial<Record<"L" | "M" | "S", number>>;
  equity: number; // % of NAV in equity (gross)
  noise: number; // 0 = pure index-style weights
  hybrid?: { deriv: number; debt: number };
}

const SPECS: Spec[] = [
  { name: "Meridian Bluechip Fund - Direct Plan - Growth", seed: 11, amount: 320000, counts: { L: 22 }, equity: 97, noise: 0.75 },
  { name: "Meridian Flexi Cap Fund - Direct Plan - Growth", seed: 23, amount: 260000, counts: { L: 16, M: 12, S: 3 }, equity: 96, noise: 0.45 },
  { name: "Orbit Nifty 50 Index Fund - Direct Plan - Growth", seed: 5, amount: 210000, counts: { L: 28 }, equity: 99.8, noise: 0 },
  { name: "Orbit Midcap Fund - Direct Plan - Growth", seed: 41, amount: 170000, counts: { M: 22, S: 4, L: 2 }, equity: 95, noise: 0.4 },
  { name: "Helio Small Cap Fund - Direct Plan - Growth", seed: 59, amount: 120000, counts: { S: 16, M: 8 }, equity: 94, noise: 0.45 },
  { name: "Helio Balanced Advantage Fund - Direct Plan - Growth", seed: 71, amount: 90000, counts: { L: 20 }, equity: 64, noise: 0.3, hybrid: { deriv: -22, debt: 26 } },
  { name: "Vertex ELSS Tax Saver Fund - Direct Plan - Growth", seed: 83, amount: 80000, counts: { L: 12, M: 10 }, equity: 96, noise: 0.7 },
];

function build(spec: Spec): Scheme {
  const r = rng(spec.seed);
  const picked: { u: U; w: number }[] = [];
  for (const cap of ["L", "M", "S"] as const) {
    const n = spec.counts[cap] ?? 0;
    if (!n) continue;
    const pool = UNIVERSE.filter((u) => u[2] === cap)
      .map((u) => ({ u, score: u[3] * (1 + (r() - 0.5) * 2 * spec.noise * 1.6) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, n);
    // Mid/small-heavy funds hold bigger positions in their home cap, so nudge the base weight
    for (const p of pool) picked.push({ u: p.u, w: Math.max(0.15, p.score) });
  }
  const sum = picked.reduce((a, p) => a + p.w, 0);
  const holdings: Holding[] = picked
    .sort((a, b) => b.w - a.w)
    .map(({ u, w }) => ({
      key: "demo-" + slug(u[0]),
      name: u[0],
      industry: u[1],
      kind: "equity" as const,
      pct: +((w / sum) * spec.equity).toFixed(2),
      cap: u[2],
    }));

  if (spec.hybrid) {
    holdings.push({ key: "demo-nifty-futures", name: "Index futures (hedge)", kind: "derivative", pct: spec.hybrid.deriv });
    holdings.push({ key: "demo-gsec", name: "Government securities", kind: "debt", pct: spec.hybrid.debt });
    holdings.push({ key: "demo-cash", name: "Cash and equivalents", kind: "cash", pct: +(100 - spec.equity - spec.hybrid.debt).toFixed(2) });
  } else {
    holdings.push({ key: "demo-cash", name: "Cash and equivalents", kind: "cash", pct: +(100 - spec.equity).toFixed(2) });
  }

  return { id: "demo-" + slug(spec.name), name: spec.name, amc: "Demo AMC", asOf: "2026-10-31", holdings, demo: true };
}

export function demoPortfolio(): { schemes: Scheme[]; positions: Position[] } {
  const schemes = SPECS.map(build);
  const positions = SPECS.map((s, i) => ({ schemeId: schemes[i].id, amount: s.amount, slot: i }));
  return { schemes, positions };
}
