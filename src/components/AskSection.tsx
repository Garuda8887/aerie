import { useMemo, useRef, useState } from "react";
import { buildContext, type Turn } from "../core/ai";
import { checkConfig, loadConfig, PRESETS, run, saveConfig, type LlmConfig } from "../core/llm";
import { usePortfolio } from "../core/store";

const SUGGESTED = [
  "Which of my funds duplicate each other the most?",
  "What am I really betting on?",
  "Where am I most exposed to a single stock or sector?",
  "Explain this portfolio to me in plain words.",
];

const blank = (provider: string): LlmConfig => {
  const p = PRESETS.find((x) => x.id === provider)!;
  return { provider, model: p.models[0] ?? "", baseUrl: p.baseUrl, apiKey: "" };
};

function ModelForm({ initial, onSave, onCancel }: { initial: LlmConfig; onSave: (c: LlmConfig) => void; onCancel?: () => void }) {
  const [c, setC] = useState(initial);
  const [err, setErr] = useState("");
  const p = PRESETS.find((x) => x.id === c.provider)!;
  const set = (patch: Partial<LlmConfig>) => setC({ ...c, ...patch });
  return (
    <form
      className="ask-key"
      onSubmit={(e) => {
        e.preventDefault();
        const msg = checkConfig(c);
        if (msg) setErr(msg);
        else onSave({ ...c, model: c.model.trim(), baseUrl: c.baseUrl.trim(), apiKey: c.apiKey.trim() });
      }}
    >
      <label className="field">
        Provider
        <select value={c.provider} onChange={(e) => setC({ ...blank(e.target.value), apiKey: c.apiKey })}>
          {PRESETS.map((x) => (
            <option key={x.id} value={x.id}>
              {x.label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        Model
        {p.models.length ? (
          <select value={c.model} onChange={(e) => set({ model: e.target.value })}>
            {p.models.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        ) : (
          <input value={c.model} spellCheck={false} placeholder="model id" onChange={(e) => set({ model: e.target.value })} />
        )}
      </label>
      {c.provider !== "anthropic" && (
        <label className="field">
          Server address
          <input value={c.baseUrl} spellCheck={false} placeholder="https://…/v1" onChange={(e) => set({ baseUrl: e.target.value })} />
        </label>
      )}
      <label className="field">
        API key{p.keyOptional ? " (optional)" : ""}
        <input type="password" autoComplete="off" spellCheck={false} value={c.apiKey} onChange={(e) => set({ apiKey: e.target.value })} />
      </label>
      {err && (
        <p className="status err" role="alert">
          {err}
        </p>
      )}
      <div className="row">
        <button className="btn primary" type="submit">
          Save
        </button>
        {onCancel && (
          <button className="btn ghost" type="button" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
      <p className="hintline">
        {p.hint} The key stays in this browser and goes only to this provider. Anyone with access to this browser profile can read it, so use a key
        with a spend limit.
      </p>
    </form>
  );
}

export function AskSection() {
  const { analysis: a, isDemo } = usePortfolio();
  const context = useMemo(() => buildContext(a), [a]);
  const [cfg, setCfg] = useState<LlmConfig | null>(loadConfig);
  const [editing, setEditing] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const abort = useRef<AbortController | null>(null);

  if (!a.funds.length) return null;

  const save = (c: LlmConfig) => {
    saveConfig(c);
    setCfg(c);
    setEditing(false);
    setTurns([]); // an answer from one model shouldn't be followed up by another
    setErr("");
  };
  const forget = () => {
    abort.current?.abort();
    saveConfig(null);
    setCfg(null);
    setEditing(false);
    setTurns([]);
    setErr("");
    setBusy(false);
  };

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || busy || !cfg) return;
    const history: Turn[] = [...turns, { role: "user", content: question }];
    setTurns([...history, { role: "assistant", content: "" }]);
    setQ("");
    setErr("");
    setBusy(true);
    const ctl = (abort.current = new AbortController());
    let got = "";
    try {
      await run(cfg, context, history, (t) => {
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

  const label = cfg ? PRESETS.find((x) => x.id === cfg.provider)?.label ?? cfg.provider : "";

  return (
    <section className="section" aria-labelledby="ask-title">
      <div className="section-head">
        <h2 id="ask-title">Ask about your portfolio.</h2>
        <p>
          Put a question to an AI model about what you hold. It sees fund and stock names and percentages, never your rupee amounts or the files
          you loaded. Nothing is sent until you ask, and it goes only to the provider you choose.
        </p>
      </div>

      {!cfg || editing ? (
        <ModelForm initial={cfg ?? blank("anthropic")} onSave={save} onCancel={cfg ? () => setEditing(false) : undefined} />
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
            <span>
              {label} · {cfg.model}
            </span>
            {isDemo && <span className="note">Answers are about the demo funds.</span>}
            <button className="btn ghost sm" onClick={() => setEditing(true)} disabled={busy}>
              Change model
            </button>
            <button className="btn ghost sm" onClick={forget}>
              Remove key
            </button>
            <details>
              <summary>What gets sent</summary>
              <pre>{context}</pre>
            </details>
          </div>
        </div>
      )}
    </section>
  );
}
