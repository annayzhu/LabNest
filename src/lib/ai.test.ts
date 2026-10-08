import { describe, expect, it } from "vitest";
import {
  ManualCopyPasteProvider,
  allowedProposedActionTypes,
  manualCopyPasteProviderConfig,
} from "./ai";

describe("ManualCopyPasteProvider", () => {
  it("creates a conservative manual prompt", () => {
    const provider = new ManualCopyPasteProvider(manualCopyPasteProviderConfig);
    const prompt = provider.createPrompt({
      entryTitle: "Check density",
      entryBody: "Cells looked dense; plan a lower seeding density comparison.",
      allowedActionTypes: allowedProposedActionTypes,
    });

    expect(prompt).toContain("Never mutate inventory");
    expect(prompt).toContain("Return only a JSON array");
    expect(prompt).toContain("Check density");
  });

  it("parses fenced JSON into pending proposed actions", () => {
    const provider = new ManualCopyPasteProvider(manualCopyPasteProviderConfig);
    const actions = provider.parseResponse(`\`\`\`json
[
  {
    "sourceType": "ai",
    "actionType": "create_experiment",
    "reason": "Entry suggests a follow-up comparison.",
    "payload": { "title": "Lower seeding density comparison" }
  }
]
\`\`\``);

    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      actionType: "create_experiment",
      status: "pending",
      sourceLabel: "Manual copy-paste AI",
    });
  });
});

import { AIProviderError, AnthropicProvider, DifyProvider, OpenAICompatibleProvider, createAIProviderAdapter, extractJsonPayload } from "./ai";
import type { AIProviderConfig } from "./ai";

type Call = { url: string; init: RequestInit };

function fakeFetch(handler: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const call = { url: String(input), init: init ?? {} };
    calls.push(call);
    return handler(call);
  }) as typeof fetch;
  return { fetchImpl, calls };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const actionsJson = JSON.stringify([
  { sourceType: "ai", actionType: "create_experiment", reason: "Follow-up comparison.", payload: { title: "Lower density" } },
]);

const baseConfig: AIProviderConfig = {
  id: "p1",
  name: "Test provider",
  type: "openai_compatible",
  baseUrl: "https://example.test/v1/",
  apiKey: "secret-key",
  defaultModel: "qwen-plus",
  capabilities: ["text"],
  enabled: true,
};

describe("extractJsonPayload", () => {
  it("recovers an array embedded in prose", () => {
    expect(extractJsonPayload('Here you go:\n[{"a":1}]\nThanks!')).toBe('[{"a":1}]');
  });
});

describe("OpenAICompatibleProvider", () => {
  it("redacts a credential echoed by an upstream error", async () => {
    const { fetchImpl } = fakeFetch(() => json({ error: { message: "invalid secret-key" } }, 401));
    const provider = new OpenAICompatibleProvider(baseConfig, { fetchImpl });
    expect((await provider.testConnection()).message).not.toContain("secret-key");
    await expect(provider.generateProposedActions!({ entryTitle: "t", entryBody: "b", allowedActionTypes: ["create_experiment"] })).rejects.not.toThrow(/secret-key/);
  });

  it("rejects model actions outside the explicitly requested types", async () => {
    const { fetchImpl } = fakeFetch(() => json({ choices: [{ message: { content: JSON.stringify([{ sourceType: "ai", actionType: "receive_purchase", reason: "Not requested", payload: { title: "A purchase" } }]) } }] }));
    const provider = new OpenAICompatibleProvider(baseConfig, { fetchImpl });
    await expect(provider.generateProposedActions!({ entryTitle: "t", entryBody: "b", allowedActionTypes: ["create_experiment"] })).rejects.toThrow(/allowed action/);
  });

  it("rejects oversized, empty-payload and malformed model actions as provider output errors", async () => {
    for (const content of [JSON.stringify(Array.from({length:51},()=>JSON.parse(actionsJson)[0])), '[{"sourceType":"ai","actionType":"create_experiment","reason":"draft","payload":{}}]', '[{"invalid":true}]']) {
      const { fetchImpl } = fakeFetch(() => json({ choices: [{ message: { content } }] }));
      await expect(new OpenAICompatibleProvider(baseConfig, { fetchImpl }).generateProposedActions!({ entryTitle: "t", entryBody: "b", allowedActionTypes: ["create_experiment"] })).rejects.toBeInstanceOf(AIProviderError);
    }
  });

  it("attributes connected-model proposals to AI regardless of an untrusted source label", async () => {
    const { fetchImpl } = fakeFetch(() => json({ choices: [{ message: { content: actionsJson.replace('"ai"','"system"') } }] }));
    const result=await new OpenAICompatibleProvider(baseConfig, { fetchImpl }).generateProposedActions!({ entryTitle: "t", entryBody: "b", allowedActionTypes: ["create_experiment"] });
    expect(result.actions[0].sourceType).toBe("ai");
  });

  it("posts a chat completion with bearer auth and parses proposed actions", async () => {
    const { fetchImpl, calls } = fakeFetch(() => json({ model: "qwen-plus-2026", choices: [{ message: { content: actionsJson } }] }));
    const provider = new OpenAICompatibleProvider(baseConfig, { fetchImpl });
    const result = await provider.generateProposedActions!({
      entryTitle: "Check density",
      entryBody: "Cells looked dense.",
      allowedActionTypes: ["create_experiment"],
    });

    expect(calls[0].url).toBe("https://example.test/v1/chat/completions");
    expect((calls[0].init.headers as Record<string, string>).authorization).toBe("Bearer secret-key");
    const body = JSON.parse(String(calls[0].init.body));
    expect(body.model).toBe("qwen-plus");
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[1].content).toContain("Check density");
    expect(result.model).toBe("qwen-plus-2026");
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]).toMatchObject({ actionType: "create_experiment", status: "pending", sourceLabel: "Test provider · qwen-plus-2026" });
  });

  it("reports HTTP errors with the provider message", async () => {
    const { fetchImpl } = fakeFetch(() => json({ error: { message: "invalid api key" } }, 401));
    const provider = new OpenAICompatibleProvider(baseConfig, { fetchImpl });
    await expect(provider.generateProposedActions!({ entryTitle: "t", entryBody: "b", allowedActionTypes: ["create_experiment"] }))
      .rejects.toThrow(/HTTP 401: invalid api key/);
  });

  it("rejects invalid JSON from the model without importing anything", async () => {
    const { fetchImpl } = fakeFetch(() => json({ choices: [{ message: { content: "I cannot help with that." } }] }));
    const provider = new OpenAICompatibleProvider(baseConfig, { fetchImpl });
    await expect(provider.generateProposedActions!({ entryTitle: "t", entryBody: "b", allowedActionTypes: ["create_experiment"] }))
      .rejects.toBeInstanceOf(AIProviderError);
  });

  it("tests the connection through /models and warns about unknown model names", async () => {
    const { fetchImpl, calls } = fakeFetch(() => json({ data: [{ id: "qwen-max" }] }));
    const provider = new OpenAICompatibleProvider(baseConfig, { fetchImpl });
    const result = await provider.testConnection();
    expect(calls[0].url).toBe("https://example.test/v1/models");
    expect(result.ok).toBe(true);
    expect(result.message).toContain('not "qwen-plus"');
  });

  it("falls back to a chat completion when /models is unavailable", async () => {
    const { fetchImpl, calls } = fakeFetch(({ url }) =>
      url.endsWith("/models") ? new Response("nope", { status: 404 }) : json({ choices: [{ message: { content: "OK" } }] }),
    );
    const provider = new OpenAICompatibleProvider(baseConfig, { fetchImpl });
    const result = await provider.testConnection();
    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(2);
  });

  it("fails clearly without an API key or when disabled", async () => {
    const { fetchImpl, calls } = fakeFetch(() => json({}));
    const missingKey = new OpenAICompatibleProvider({ ...baseConfig, apiKey: undefined }, { fetchImpl });
    expect((await missingKey.testConnection()).message).toMatch(/No API key/);
    const disabled = new OpenAICompatibleProvider({ ...baseConfig, enabled: false }, { fetchImpl });
    expect((await disabled.testConnection()).message).toMatch(/disabled/);
    expect(calls).toHaveLength(0);
  });

  it("uses the OpenAI default base URL for the openai type", async () => {
    const { fetchImpl, calls } = fakeFetch(() => json({ data: [] }));
    await new OpenAICompatibleProvider({ ...baseConfig, type: "openai", baseUrl: undefined }, { fetchImpl }).testConnection();
    expect(calls[0].url).toBe("https://api.openai.com/v1/models");
  });
});

describe("AnthropicProvider", () => {
  it("sends the Anthropic headers and joins text blocks", async () => {
    const { fetchImpl, calls } = fakeFetch(() => json({ model: "claude-x", content: [{ type: "text", text: actionsJson }] }));
    const provider = new AnthropicProvider({ ...baseConfig, type: "anthropic", baseUrl: undefined, defaultModel: "claude-x" }, { fetchImpl });
    const result = await provider.generateProposedActions!({ entryTitle: "t", entryBody: "b", allowedActionTypes: ["create_experiment"] });
    expect(calls[0].url).toBe("https://api.anthropic.com/v1/messages");
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("secret-key");
    expect(headers["anthropic-version"]).toBeTruthy();
    expect(JSON.parse(String(calls[0].init.body)).system).toContain("Never mutate");
    expect(result.actions).toHaveLength(1);
  });
});

describe("DifyProvider", () => {
  it("calls chat-messages in blocking mode and reads the answer", async () => {
    const { fetchImpl, calls } = fakeFetch(() => json({ answer: `\`\`\`json\n${actionsJson}\n\`\`\`` }));
    const provider = new DifyProvider({ ...baseConfig, type: "dify", baseUrl: "https://aihub.example/v1", defaultModel: undefined }, { fetchImpl });
    const result = await provider.generateProposedActions!({ entryTitle: "t", entryBody: "b", allowedActionTypes: ["create_experiment"] });
    expect(calls[0].url).toBe("https://aihub.example/v1/chat-messages");
    const body = JSON.parse(String(calls[0].init.body));
    expect(body.response_mode).toBe("blocking");
    expect(body.query).toContain("Entry title: t");
    expect(result.actions).toHaveLength(1);
    expect(result.model).toBeUndefined();
  });

  it("requires a base URL", async () => {
    const { fetchImpl } = fakeFetch(() => json({}));
    const provider = new DifyProvider({ ...baseConfig, type: "dify", baseUrl: "" }, { fetchImpl });
    expect((await provider.testConnection()).message).toMatch(/base URL is required/);
  });
});

describe("createAIProviderAdapter", () => {
  it("maps every provider type to an adapter", () => {
    expect(createAIProviderAdapter(manualCopyPasteProviderConfig)).toBeInstanceOf(ManualCopyPasteProvider);
    expect(createAIProviderAdapter({ ...baseConfig, type: "openai" })).toBeInstanceOf(OpenAICompatibleProvider);
    expect(createAIProviderAdapter({ ...baseConfig, type: "openai_compatible" })).toBeInstanceOf(OpenAICompatibleProvider);
    expect(createAIProviderAdapter({ ...baseConfig, type: "anthropic" })).toBeInstanceOf(AnthropicProvider);
    expect(createAIProviderAdapter({ ...baseConfig, type: "dify" })).toBeInstanceOf(DifyProvider);
  });
});
