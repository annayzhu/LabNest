import { afterEach, describe, expect, it, vi } from "vitest";
import { AIProviderError, AnthropicProvider, DifyProvider, OpenAICompatibleProvider, redactSecret, type AIProviderConfig } from "./ai";
import { createAIGate } from "./ai-gate";

// The gate re-reads the saved AI settings before, during and after a call; here they stay as saved.
vi.mock("./db", () => {
  const saved = async () => ({ enabled: true, updatedAt: new Date("2026-10-19T00:00:00.000Z") });
  return { prisma: { aISettings: { findUnique: saved }, aIProvider: { findUnique: saved } } };
});
afterEach(() => { vi.unstubAllGlobals(); });

const key = "sk-live-0123456789abcdefWXYZ";
const config: AIProviderConfig = { id: "p1", name: "Gateway", type: "openai_compatible", baseUrl: "https://gateway.test/v1", apiKey: key, defaultModel: "gpt-x", capabilities: ["text"], enabled: true };

/** A provider that answers every call with the same status and JSON body, counting the calls. */
function refusing(status: number, body: unknown) {
  const calls: string[] = [];
  const fetchImpl = (async (input: RequestInfo | URL) => {
    calls.push(String(input));
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return { fetchImpl, calls };
}

const rejection = (promise: Promise<unknown>) => promise.then(() => { throw new Error("expected the call to fail"); }, (error: unknown) => error as AIProviderError);

describe("a model service that refuses the call", () => {
  it.each([400, 401, 403, 404])("reports HTTP %i after one attempt, without waiting for the request budget", async status => {
    // new-api style refusal that also echoes the token back.
    const { fetchImpl, calls } = refusing(status, { error: { type: "new_api_error", message: `This token has no access to model gpt-x (token ${key})` } });
    const provider = new OpenAICompatibleProvider(config, { fetchImpl, timeoutMs: 240_000 });
    const started = Date.now();
    const error = await rejection(provider.complete("system", "user"));
    expect(Date.now() - started).toBeLessThan(1_000);
    expect(calls).toHaveLength(1);
    expect(error).toBeInstanceOf(AIProviderError);
    expect(error.status).toBe(status);
    expect(error.message).toBe(`Gateway returned HTTP ${status}: new_api_error: This token has no access to model gpt-x (token [redacted])`);
    expect(error.message).not.toContain(key.slice(-6));
  });

  it("is reported as fast through the AI gate that the design page's method card uses", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return new Response(JSON.stringify({ error: { message: "This token has no access to model gpt-x" } }), { status: 403, headers: { "content-type": "application/json" } });
    });
    const revision = "2026-10-19T00:00:00.000Z";
    const gate = createAIGate(revision, { id: "p1", revision });
    const started = Date.now();
    const error = await rejection(new OpenAICompatibleProvider(config, { fetchImpl: gate.fetch, timeoutMs: 240_000 }).complete("system", "user"));
    expect(Date.now() - started).toBeLessThan(1_000);
    expect(calls).toEqual(["https://gateway.test/v1/chat/completions"]);
    expect(error.status).toBe(403);
    expect(error.message).toBe("Gateway returned HTTP 403: This token has no access to model gpt-x");
  });

  it("does the same for the Anthropic and Dify adapters", async () => {
    for (const make of [
      (fetchImpl: typeof fetch) => new AnthropicProvider({ ...config, type: "anthropic", baseUrl: undefined }, { fetchImpl, timeoutMs: 240_000 }),
      (fetchImpl: typeof fetch) => new DifyProvider({ ...config, type: "dify" }, { fetchImpl, timeoutMs: 240_000 }),
    ]) {
      const { fetchImpl, calls } = refusing(403, { message: `forbidden for ${key}` });
      const error = await rejection(make(fetchImpl).complete("system", "user"));
      expect(calls).toHaveLength(1);
      expect(error.status).toBe(403);
      expect(error.message).not.toContain(key);
    }
  });

  it("classifies a refused model in the connection test, once and without the key", async () => {
    const { fetchImpl, calls } = refusing(403, { error: { message: `This token has no access to model gpt-x, key ${key}` } });
    const result = await new OpenAICompatibleProvider(config, { fetchImpl, timeoutMs: 240_000 }).testConnection();
    expect(calls).toHaveLength(1);
    expect(result).toMatchObject({ ok: false, errorCode: "model", httpStatus: 403 });
    expect(result.message).not.toContain(key);
  });
});

describe("redactSecret", () => {
  it("hides the key whole, URL-encoded, cut or masked, and leaves the rest of the message", () => {
    expect(redactSecret(`bad key ${key}.`, key)).toBe("bad key [redacted].");
    expect(redactSecret("GET /v1?key=ab%2Bcd%2Fef%3D%3Dghijklmnop failed", " ab+cd/ef==ghijklmnop ")).toBe("GET /v1?key=[redacted] failed");
    expect(redactSecret("Incorrect API key provided: sk-live-****************WXYZ. Find your key on the dashboard.", key)).toBe("Incorrect API key provided: [redacted] Find your key on the dashboard.");
    expect(redactSecret("token sk-live-0123 was cut", key)).toBe("token [redacted] was cut");
    expect(redactSecret("key ending …efWXYZ is not allowed", key)).toBe("key ending [redacted] is not allowed");
    expect(redactSecret("This token has no access to model gpt-x", key)).toBe("This token has no access to model gpt-x");
    expect(redactSecret("nothing to hide", undefined)).toBe("nothing to hide");
  });
});
