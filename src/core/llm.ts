import { ask as askClaude, SYSTEM, type Turn } from "./ai";

export interface Preset {
  id: string;
  label: string;
  baseUrl: string;
  /** Known model ids to pick from. Empty means the person types one. */
  models: string[];
  keyOptional?: boolean;
  hint: string;
}

// Base URLs speak the OpenAI chat-completions protocol, which most providers offer. Model ids change often, so only Claude's are listed.
export const PRESETS: Preset[] = [
  {
    id: "anthropic",
    label: "Claude (Anthropic)",
    baseUrl: "",
    models: ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5", "claude-fable-5-1"],
    hint: "Sonnet and Haiku cost less than Opus.",
  },
  { id: "openai", label: "OpenAI", baseUrl: "https://api.openai.com/v1", models: [], hint: "Type a model id from your OpenAI account." },
  {
    id: "gemini",
    label: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    models: [],
    hint: "Type a Gemini model id, from Google AI Studio.",
  },
  { id: "openrouter", label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1", models: [], hint: "One key for most models. Type a slug like vendor/model." },
  {
    id: "local",
    label: "Local (Ollama, LM Studio)",
    baseUrl: "http://localhost:11434/v1",
    models: [],
    keyOptional: true,
    hint: "Nothing leaves your machine. Your server must allow this page's origin (CORS).",
  },
  { id: "custom", label: "Other OpenAI-compatible", baseUrl: "", models: [], keyOptional: true, hint: "Any server with a /chat/completions endpoint." },
];

export interface LlmConfig {
  provider: string;
  model: string;
  baseUrl: string;
  apiKey: string;
}

const STORE = "aerie.llm";

export function loadConfig(): LlmConfig | null {
  try {
    const c = JSON.parse(localStorage.getItem(STORE) ?? "null") as LlmConfig | null;
    if (c && typeof c.provider === "string" && typeof c.model === "string" && c.model) return { ...c, baseUrl: c.baseUrl ?? "", apiKey: c.apiKey ?? "" };
  } catch {
    /* blocked or corrupt storage: start unconfigured */
  }
  return null;
}
export function saveConfig(c: LlmConfig | null): void {
  try {
    if (c) localStorage.setItem(STORE, JSON.stringify(c));
    else localStorage.removeItem(STORE);
  } catch {
    /* the setting then lasts until the tab closes */
  }
}

const isLocal = (u: URL) => ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname) || u.hostname.endsWith(".localhost");

/** Returns a message for the form if the config can't be used, else null. */
export function checkConfig(c: LlmConfig): string | null {
  const p = PRESETS.find((x) => x.id === c.provider);
  if (!p) return "Pick a provider.";
  if (!c.model.trim()) return "Enter a model.";
  if (!p.keyOptional && !c.apiKey.trim()) return "Enter an API key.";
  if (c.provider !== "anthropic") {
    let u: URL;
    try {
      u = new URL(c.baseUrl);
    } catch {
      return "Enter the server's base URL, starting with https://.";
    }
    if (u.protocol !== "https:" && !(u.protocol === "http:" && isLocal(u))) return "Use https:// so your key is not sent in the clear.";
  }
  return null;
}

/** Streams an answer from whichever provider is configured. Throws an Error with a message fit for the UI. */
export async function run(c: LlmConfig, context: string, history: Turn[], onText: (t: string) => void, signal?: AbortSignal): Promise<string> {
  if (c.provider === "anthropic") return askClaude(c.apiKey, c.model, context, history, onText, signal);

  const url = c.baseUrl.replace(/\/+$/, "") + "/chat/completions";
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json", ...(c.apiKey ? { Authorization: `Bearer ${c.apiKey}` } : {}) },
      body: JSON.stringify({
        model: c.model,
        stream: true,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `My portfolio, as a look-through summary:\n\n${context}` },
          { role: "assistant", content: "Got it. What would you like to know?" },
          ...history,
        ],
      }),
    });
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new Error(`Could not reach ${new URL(url).host}. Check the address and your connection; a local server must allow this page's origin (CORS).`);
  }
  if (!res.ok) {
    const body = (await res.text().catch(() => "")).slice(0, 200);
    if (res.status === 401 || res.status === 403) throw new Error("That API key was rejected. Check it and try again.");
    if (res.status === 429) throw new Error("Rate limited or out of credit. Wait a moment and ask again.");
    throw new Error(`The provider returned an error (${res.status}). ${body}`.trim());
  }
  if (!res.body) throw new Error("The provider sent no response.");

  // Server-sent events: "data: {json}" lines, ending with "data: [DONE]".
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const d = line.startsWith("data:") ? line.slice(5).trim() : "";
      if (!d || d === "[DONE]") continue;
      try {
        const t = JSON.parse(d)?.choices?.[0]?.delta?.content;
        if (typeof t === "string" && t) {
          out += t;
          onText(t);
        }
      } catch {
        /* a partial or non-JSON keep-alive line */
      }
    }
  }
  if (!out) throw new Error("The model returned no text. Check that the model id is right.");
  return out;
}
