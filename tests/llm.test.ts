import { afterEach, describe, expect, it, vi } from "vitest";
import { checkConfig, run, type LlmConfig } from "../src/core/llm";

const openai: LlmConfig = { provider: "openai", model: "m", baseUrl: "https://api.example.com/v1", apiKey: "k" };

describe("checkConfig", () => {
  it("accepts a complete config", () => expect(checkConfig(openai)).toBeNull());
  it("needs a model and, except locally, a key", () => {
    expect(checkConfig({ ...openai, model: " " })).toMatch(/model/i);
    expect(checkConfig({ ...openai, apiKey: "" })).toMatch(/key/i);
    expect(checkConfig({ provider: "local", model: "m", baseUrl: "http://localhost:11434/v1", apiKey: "" })).toBeNull();
  });
  it("refuses to send a key over plain http to a remote host", () => {
    expect(checkConfig({ ...openai, baseUrl: "http://api.example.com/v1" })).toMatch(/https/);
    expect(checkConfig({ ...openai, baseUrl: "not a url" })).toMatch(/base URL/);
  });
});

describe("run (OpenAI-compatible)", () => {
  afterEach(() => vi.unstubAllGlobals());

  const sse = (...chunks: string[]) =>
    new Response(new ReadableStream({ start: (c) => (chunks.forEach((x) => c.enqueue(new TextEncoder().encode(x))), c.close()) }));

  it("joins streamed text even when a line is split across chunks", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => sse('data: {"choices":[{"delta":{"content":"Hel"}}]}\n\ndata: {"choices":[{"del', 'ta":{"content":"lo"}}]}\n\ndata: [DONE]\n\n')),
    );
    const seen: string[] = [];
    expect(await run(openai, "ctx", [{ role: "user", content: "hi" }], (t) => seen.push(t))).toBe("Hello");
    expect(seen).toEqual(["Hel", "lo"]);
  });

  it("sends the key as a bearer token and turns a 401 into a plain message", async () => {
    const f = vi.fn(async () => new Response("nope", { status: 401 }));
    vi.stubGlobal("fetch", f);
    await expect(run(openai, "ctx", [{ role: "user", content: "hi" }], () => {})).rejects.toThrow(/rejected/);
    expect((f.mock.calls[0] as unknown as [string, RequestInit])[1].headers).toMatchObject({ Authorization: "Bearer k" });
  });
});
