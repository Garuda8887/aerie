import { useMemo, useRef, useState } from "react";
import { ask, buildContext, KEY_STORE, type Turn } from "../core/ai";
import { usePortfolio } from "../core/store";

const read = () => {
  try {
    return localStorage.getItem(KEY_STORE) ?? "";
  } catch {
    return "";
  }
};

const SUGGESTED = [
  "Which of my funds duplicate each other the most?",
  "What am I really betting on?",
  "Where am I most exposed to a single stock or sector?",
  "Explain this portfolio to me in plain words.",
];

export function AskSection() {
  const { analysis: a, isDemo } = usePortfolio();
  const context = useMemo(() => buildContext(a), [a]);
  const [key, setKey] = useState(read);
  const [draftKey, setDraftKey] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const abort = useRef<AbortController | null>(null);

  if (!a.funds.length) return null;

  const saveKey = () => {
    const k = draftKey.trim();
    if (!k) return;
    try {
      localStorage.setItem(KEY_STORE, k);
    } catch {
      /* the key then lasts until the tab closes */
    }
    setKey(k);
    setDraftKey("");
  };
  const forgetKey = () => {
    abort.current?.abort();
    try {
      localStorage.removeItem(KEY_STORE);
    } catch {
      /* ignore */
    }
    setKey("");
    setTurns([]);
    setErr("");
    setBusy(false);
  };

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || busy) return;
    const history: Turn[] = [...turns, { role: "user", content: question }];
    setTurns([...history, { role: "assistant", content: "" }]);
    setQ("");
    setErr("");
    setBusy(true);
    const ctl = (abort.current = new AbortController());
    let got = "";
    try {
      await ask(key, context, history, (t) => {
        got += t;
        setTurns([...history, { role: "assistant", content: got }]);
      }, ctl.signal);
    } catch (e) {
      if (!ctl.signal.aborted) {
        setErr(e instanceof Error ? e.message : "Something went wrong.");
        setTurns(history.slice(0, -1)); // drop the unanswered question so it can be re-asked
        setQ(question);
      }
    } finally {
      if (abort.current === ctl) setBusy(false);
    }
  };

  return (
    <section className="section" aria-labelledby="ask-title">
      <div className="section-head">
        <h2 id="ask-title">Ask about your portfolio.</h2>
        <p>
          Put a question to Claude about what you hold. It sees fund and stock names and percentages, never your rupee amounts or the files you
          loaded. Nothing is sent until you ask.
        </p>
      </div>

      {!key ? (
        <form
          className="ask-key"
          onSubmit={(e) => {
            e.preventDefault();
            saveKey();
          }}
        >
          <label className="field">
            Your Anthropic API key
            <input type="password" autoComplete="off" spellCheck={false} placeholder="sk-ant-…" value={draftKey} onChange={(e) => setDraftKey(e.target.value)} />
          </label>
          <div className="row">
            <button className="btn primary" type="submit" disabled={!draftKey.trim()}>
              Save key
            </button>
          </div>
          <p className="hintline">
            The key stays in this browser and goes only to Anthropic. Anyone with access to this browser profile can read it, so use a key with a
            spend limit.
          </p>
        </form>
      ) : (
        <div className="ask">
          {!turns.length && (
            <ul className="legend ask-suggest" aria-label="Suggested questions">
              {SUGGESTED.map((s) => (
                <li key={s}>
                  <button className="chip" onClick={() => send(s)} disabled={busy}>
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="ask-thread" aria-live="polite">
            {turns.map((t, i) =>
              t.role === "user" ? (
                <p key={i} className="ask-q">
                  {t.content}
                </p>
              ) : (
                <div key={i} className="ask-a">
                  {t.content || <span className="muted">Reading your portfolio…</span>}
                </div>
              ),
            )}
          </div>

          {err && (
            <p className="status err" role="alert">
              {err}
            </p>
          )}

          <form
            className="ask-form"
            onSubmit={(e) => {
              e.preventDefault();
              send(q);
            }}
          >
            <input aria-label="Your question" placeholder="Ask anything about these funds" value={q} onChange={(e) => setQ(e.target.value)} disabled={busy} />
            <button className="btn primary" type="submit" disabled={busy || !q.trim()}>
              {busy ? "Answering" : "Ask"}
            </button>
          </form>

          <div className="ask-meta">
            <details>
              <summary>What gets sent</summary>
              <pre>{context}</pre>
            </details>
            {isDemo && <span className="note">Answers are about the demo funds.</span>}
            <button className="btn ghost sm" onClick={forgetKey}>
              Remove key
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
