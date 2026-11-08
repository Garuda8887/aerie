import { useRef, useState } from "react";
import { parseAmcFile } from "../core/parseAmc";
import { parseCapFile } from "../core/parseCaps";
import { exportJson, parseExport, usePortfolio } from "../core/store";
import { rupees, monthYear } from "../core/format";
import type { ParsedScheme } from "../core/types";
import { Modal } from "./Modal";
import { fundColor } from "./colors";

const AMCS = [
  "Aditya Birla Sun Life", "Axis", "Bandhan", "Canara Robeco", "DSP", "Edelweiss", "Franklin Templeton", "HDFC", "HSBC",
  "ICICI Prudential", "Invesco", "JM Financial", "Kotak Mahindra", "LIC", "Mahindra Manulife", "Mirae Asset", "Motilal Oswal",
  "Nippon India", "PGIM India", "PPFAS (Parag Parikh)", "Quant", "SBI", "Sundaram", "Tata", "Union", "UTI", "WhiteOak Capital",
];

interface Pick {
  on: boolean;
  name: string;
  amount: string;
}

const toNumber = (s: string) => Number(s.replace(/[,\s₹]/g, "")) || 0;

export function Drawer({ onClose }: { onClose: () => void }) {
  const { state, analysis, isDemo, dispatch } = usePortfolio();
  const [amc, setAmc] = useState("");
  const [parsed, setParsed] = useState<ParsedScheme[] | null>(null);
  const [picks, setPicks] = useState<Record<string, Pick>>({});
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [capMsg, setCapMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const capRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setMsg(null);
    try {
      const out = parseAmcFile(await file.arrayBuffer());
      if (!out.length) {
        setParsed(null);
        setMsg({ kind: "err", text: "No portfolio tables found. Aerie looks for a table with ISIN and % to NAV columns, one sheet per scheme. Is this the AMC's monthly portfolio file?" });
        return;
      }
      setParsed(out);
      setPicks(Object.fromEntries(out.map((p) => [p.sheet, { on: out.length === 1, name: p.name, amount: "" }])));
      setMsg({ kind: "ok", text: `Found ${out.length} ${out.length === 1 ? "scheme" : "schemes"}. Tick the ones you own and enter how much is in each.` });
    } catch (e) {
      setParsed(null);
      setMsg({ kind: "err", text: `Couldn't read that file (${(e as Error).message}). Try the .xlsx download from the AMC.` });
    }
  }

  const chosen = parsed?.filter((p) => picks[p.sheet]?.on && toNumber(picks[p.sheet].amount) > 0) ?? [];

  function addChosen() {
    if (!parsed) return;
    dispatch({
      t: "add",
      amc: amc || "Unlabelled AMC",
      items: chosen.map((p) => ({ parsed: p, name: picks[p.sheet].name.trim() || p.name, amount: toNumber(picks[p.sheet].amount) })),
    });
    setParsed(null);
    setPicks({});
    setMsg({ kind: "ok", text: `Added ${chosen.length} ${chosen.length === 1 ? "fund" : "funds"}.` });
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onCaps(file: File | undefined) {
    if (!file) return;
    try {
      const map = parseCapFile(await file.arrayBuffer());
      const n = Object.keys(map).length;
      if (!n) return setCapMsg({ kind: "err", text: "Couldn't find a column of ISINs next to Large / Mid / Small Cap labels." });
      dispatch({ t: "caps", map });
      setCapMsg({ kind: "ok", text: `Loaded ${n.toLocaleString("en-IN")} companies.` });
    } catch (e) {
      setCapMsg({ kind: "err", text: `Couldn't read that file (${(e as Error).message}).` });
    }
  }

  function download() {
    const blob = new Blob([exportJson(state)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "aerie-portfolio.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function onImport(file: File | undefined) {
    if (!file) return;
    const s = parseExport(await file.text());
    if (s) dispatch({ t: "load", state: s });
    else setMsg({ kind: "err", text: "That isn't an Aerie export." });
  }

  return (
    <Modal onClose={onClose} label="Manage your funds" side>
      <header className="drawer-head">
        <h3>Your funds</h3>
        <button className="icon-btn" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </header>

      <div className="drawer-body">
        <section>
          <h4>In your portfolio</h4>
          {analysis.funds.length === 0 ? (
            <p className="muted">Nothing yet. Add a fund below, or try the demo.</p>
          ) : (
            <ul className="mf-list">
              {analysis.funds.map((f) => (
                <li key={f.id}>
                  <i style={{ background: fundColor(f.slot) }} />
                  <span className="mf-name" title={f.name}>
                    {f.name}
                    <small>{f.demo ? "Demo fund" : f.amc}</small>
                  </span>
                  <label className="amt">
                    <span className="sr">Amount in {f.name}</span>
                    <b>₹</b>
                    <input
                      key={Math.round(f.amount)}
                      inputMode="numeric"
                      defaultValue={Math.round(f.amount).toLocaleString("en-IN")}
                      onBlur={(e) => {
                        const v = toNumber(e.target.value);
                        if (v > 0) dispatch({ t: "amount", id: f.id, amount: v });
                        e.target.value = Math.round(v > 0 ? v : f.amount).toLocaleString("en-IN");
                      }}
                    />
                  </label>
                  <button className="icon-btn" aria-label={`Remove ${f.name}`} onClick={() => dispatch({ t: "remove", id: f.id })}>
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="row">
            {(isDemo || analysis.funds.length === 0) && (
              <button className="btn ghost sm" onClick={() => dispatch({ t: "demo" })}>
                {isDemo ? "Reset demo" : "Load demo"}
              </button>
            )}
            {analysis.funds.length > 0 && (
              <button className="btn ghost sm" onClick={() => dispatch({ t: "clear" })}>
                Remove all
              </button>
            )}
          </div>
        </section>

        <section>
          <h4>Add funds from an AMC file</h4>
          <ol className="steps">
            <li>
              Download the AMC's latest monthly portfolio Excel from{" "}
              <a href="https://www.amfiindia.com/online-center/portfolio-disclosure" target="_blank" rel="noreferrer">
                AMFI's portfolio disclosure page
              </a>{" "}
              or the AMC's own site.
            </li>
            <li>Pick the AMC, then drop the file here.</li>
          </ol>
          <label className="field">
            <span>AMC</span>
            <select value={amc} onChange={(e) => setAmc(e.target.value)}>
              <option value="">Choose an AMC…</option>
              {AMCS.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </select>
          </label>
          <div
            className={"drop" + (drag ? " over" : "")}
            onDragOver={(e) => (e.preventDefault(), setDrag(true))}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              onFile(e.dataTransfer.files[0]);
            }}
          >
            <p>Drop an .xlsx, .xls or .csv here</p>
            <button className="btn ghost sm" onClick={() => fileRef.current?.click()}>
              Choose a file
            </button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => (onFile(e.target.files?.[0]), (e.target.value = ""))} />
          </div>
          {msg && <p className={"status " + msg.kind} role="status">{msg.text}</p>}

          {parsed && (
            <>
              <ul className="found">
                {parsed.map((p) => {
                  const pk = picks[p.sheet];
                  if (!pk) return null;
                  return (
                    <li key={p.sheet} className={pk.on ? "on" : ""}>
                      <label className="tick">
                        <input type="checkbox" checked={pk.on} onChange={(e) => setPicks({ ...picks, [p.sheet]: { ...pk, on: e.target.checked } })} />
                        <span className="sr">Include {p.name}</span>
                      </label>
                      <div className="found-main">
                        <input
                          className="name"
                          value={pk.name}
                          aria-label="Fund name"
                          onChange={(e) => setPicks({ ...picks, [p.sheet]: { ...pk, name: e.target.value } })}
                        />
                        <small>
                          {p.holdings.filter((h) => h.kind === "equity").length} stocks{monthYear(p.asOf) ? ` · as of ${monthYear(p.asOf)}` : ""}
                          {p.warnings.length ? ` · ${p.warnings[0]}` : ""}
                        </small>
                      </div>
                      <label className="amt">
                        <span className="sr">Amount in {p.name}</span>
                        <b>₹</b>
                        <input
                          inputMode="numeric"
                          placeholder="Amount"
                          value={pk.amount}
                          onChange={(e) => setPicks({ ...picks, [p.sheet]: { ...pk, amount: e.target.value, on: toNumber(e.target.value) > 0 ? true : pk.on } })}
                        />
                      </label>
                    </li>
                  );
                })}
              </ul>
              <button className="btn primary" disabled={!chosen.length} onClick={addChosen}>
                {chosen.length ? `Add ${chosen.length} ${chosen.length === 1 ? "fund" : "funds"} · ${rupees(chosen.reduce((s, p) => s + toNumber(picks[p.sheet].amount), 0))}` : "Tick a fund and enter an amount"}
              </button>
            </>
          )}
        </section>

        <section>
          <h4>Large, mid and small caps</h4>
          <p className="muted">
            AMFI classifies every listed stock twice a year. Load the latest list so each holding gets a size.{" "}
            {state.capCount > 0 ? `Loaded: ${state.capCount.toLocaleString("en-IN")} companies.` : "Not loaded yet, so stocks show as size unknown."}
          </p>
          <div className="row">
            <button className="btn ghost sm" onClick={() => capRef.current?.click()}>
              {state.capCount ? "Replace the list" : "Load AMFI list"}
            </button>
            <input ref={capRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => (onCaps(e.target.files?.[0]), (e.target.value = ""))} />
          </div>
          <p className="hintline">Search "AMFI categorisation of stocks" for the latest half-yearly Excel.</p>
          {capMsg && <p className={"status " + capMsg.kind} role="status">{capMsg.text}</p>}
        </section>

        <section>
          <h4>Backup</h4>
          <div className="row">
            <button className="btn ghost sm" onClick={download} disabled={!analysis.funds.length}>
              Export JSON
            </button>
            <button className="btn ghost sm" onClick={() => importRef.current?.click()}>
              Import JSON
            </button>
            <input ref={importRef} type="file" accept=".json" hidden onChange={(e) => (onImport(e.target.files?.[0]), (e.target.value = ""))} />
          </div>
          <p className="hintline">Everything is stored in this browser only. Nothing is uploaded.</p>
        </section>
      </div>
    </Modal>
  );
}
