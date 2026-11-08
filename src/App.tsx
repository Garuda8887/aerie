import { useEffect, useState } from "react";
import { AskSection } from "./components/AskSection";
import { ConcentrationSection } from "./components/ConcentrationSection";
import { Drawer } from "./components/Drawer";
import { FundsSection } from "./components/FundsSection";
import { Hero } from "./components/Hero";
import { OverlapSection } from "./components/OverlapSection";
import { Reveal } from "./components/Reveal";
import { SectorSection } from "./components/SectorSection";
import { SizeSection } from "./components/SizeSection";
import { TooltipLayer } from "./components/tooltip";
import { PortfolioProvider, usePortfolio } from "./core/store";

function Shell() {
  const [drawer, setDrawer] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  const { isDemo, analysis } = usePortfolio();
  const manage = () => setDrawer(true);
  return (
    <>
      <header className={"topbar" + (scrolled ? " scrolled" : "")}>
        <a className="mark" href="#top" aria-label="Aerie">
          <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
            <path d="M2 17 C7 17 9 9 13 4 C17 9 19 17 24 17 C19 15.6 16.2 17.2 13 22 C9.8 17.2 7 15.6 2 17Z" fill="currentColor" />
          </svg>
          Aerie
        </a>
        <div className="topbar-right">
          {isDemo && <span className="badge">Demo data</span>}
          <button className="btn ghost sm" onClick={manage}>
            {analysis.funds.length ? "Manage funds" : "Add funds"}
          </button>
        </div>
      </header>

      <main id="top">
        <Hero onManage={manage} />
        <div className="wrap">
          <Reveal><SizeSection onManage={manage} /></Reveal>
          <Reveal><ConcentrationSection /></Reveal>
          <Reveal><OverlapSection /></Reveal>
          <Reveal><SectorSection /></Reveal>
          <Reveal><AskSection /></Reveal>
          <Reveal><FundsSection onManage={manage} /></Reveal>
        </div>
      </main>

      <footer className="foot">
        <div className="wrap">
          <p>
            Aerie is open source and runs entirely in your browser. Holdings come from the monthly portfolio files AMCs publish, so they lag
            real life by up to a few weeks. Hedged equity in arbitrage and balanced-advantage funds is left out of overlap. This is a
            way to look at your money, not advice on what to do with it.
          </p>
        </div>
      </footer>

      {drawer && <Drawer onClose={() => setDrawer(false)} />}
      <TooltipLayer />
    </>
  );
}

export default function App() {
  return (
    <PortfolioProvider>
      <Shell />
    </PortfolioProvider>
  );
}
