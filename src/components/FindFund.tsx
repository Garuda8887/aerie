import { useEffect, useState } from "react";
import { loadFund, loadFundIndex, searchFunds, type FundEntry } from "../core/fundData";
import { monthYear } from "../core/format";
import { usePortfolio } from "../core/store";

const SHOWN = 8;
const toNumber = (s: string) => Number(s.replace(/[,\s₹]/g, "")) || 0;

export function FindFund() {
  const { dispatch } = usePortfolio();
  const [list, setList] = useState<FundEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState("");
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    loadFundIndex().then(setList, () => setFailed(true));
  }, []);

  async function add(f: FundEntry) {
    setBusy(f.id);
    setMsg(null);
    try {
      const parsed = await loadFund(f);
      dispatch({ t: "add", amc: f.amc, items: [{ parsed, name: f.name, amount: toNumber(amounts[f.id] ?? "") }] });
      setAmounts((a) => ({ ...a, [f.id]: "" }));
      setMsg({ kind: "ok", text: `Added ${f.name}.` });
    } catch {
      setMsg({ kind: "err", text: `Couldn't load ${f.name}. Check your connection, or add it from the AMC's file below.` });
    }
    setBusy("");
  }

  const hits = list ? searchFunds(list, q) : [];

  return (
    <section>
      <h4>Find a fund</h4>
      {failed ? (
        <p className="status err">Couldn't load the fund list. You can still add funds from an AMC file below.</p>
      ) : !list ? (
        <p className="muted">Loading funds…</p>
      ) : (
        <>
          <input
            className="find-q"
            type="search"
            placeholder="Search by fund or AMC, e.g. flexi cap"
            aria-label="Search funds"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {hits.length === 0 ? (
            <p className="muted" style={{ marginTop: 12 }}>
              {list.length ? "No fund matches that. Try fewer words, or add it from the AMC's file below." : "No funds listed yet."}
            </p>
          ) : (
            <ul className="finds">
              {hits.slice(0, SHOWN).map((f) => {
                const amount = toNumber(amounts[f.id] ?? "");
                return (
                  <li key={f.id}>
                    <span className="mf-name" title={f.name}>
                      {f.name}
                      <small>
                        {f.amc}
                        {monthYear(f.asOf) ? ` · as of ${monthYear(f.asOf)}` : ""}
                      </small>
                    </span>
                    <label className="amt">
                      <span className="sr">Amount in {f.name}</span>
                      <b>₹</b>
                      <input
                        inputMode="numeric"
                        placeholder="Amount"
                        value={amounts[f.id] ?? ""}
                        onChange={(e) => setAmounts({ ...amounts, [f.id]: e.target.value })}
                        onKeyDown={(e) => e.key === "Enter" && amount > 0 && add(f)}
                      />
                    </label>
                    <button className="btn primary sm" disabled={!amount || busy === f.id} onClick={() => add(f)}>
                      {busy === f.id ? "Adding…" : "Add"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {hits.length > SHOWN && <p className="hintline">Showing {SHOWN} of {hits.length}. Type to narrow it down.</p>}
          {msg && <p className={"status " + msg.kind} role="status">{msg.text}</p>}
          <p className="hintline">
            Only the fund you pick is downloaded. The amounts you type stay in this browser. Not every AMC is listed: some don't allow
            automated copying, so add theirs from their file below.
          </p>
        </>
      )}
    </section>
  );
}
