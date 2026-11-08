import { pct } from "../core/format";
import { usePortfolio } from "../core/store";
import { FundLegend, StackedRows } from "./StackedRows";

export function SectorSection() {
  const { analysis: a } = usePortfolio();
  if (!a.sectors.length || !a.equityExposure) return null;
  const real = a.sectors.filter((s) => s.sector !== "Other");
  const top = real[0] ?? a.sectors[0];
  const top3 = real.slice(0, 3);
  const top3share = top3.reduce((x, s) => x + s.exposure, 0) / a.equityExposure;
  const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1]);

  return (
    <section className="section" aria-labelledby="sec-title">
      <div className="section-head">
        <h2 id="sec-title">
          Your biggest sector is {top.sector}, at {pct(top.exposure / a.equityExposure)} of your stock money.
        </h2>
        <p>
          {top3.length > 1 ? `${list(top3.map((s) => s.sector))} together are ${pct(top3share)}. ` : ""}
          Sectors are grouped from the industry labels in each AMC's disclosure.
        </p>
      </div>
      <FundLegend funds={a.funds} />
      <StackedRows
        rows={a.sectors.map((s) => ({ key: s.sector, label: s.sector, total: s.exposure, byFund: s.byFund }))}
        funds={a.funds}
        portfolioTotal={a.total}
        denominator={a.equityExposure}
        valueLabel="Share of stock money"
      />
    </section>
  );
}
