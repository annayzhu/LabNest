import { describe, expect, it } from "vitest";
import { createAIProviderAdapter, type AIProviderConfig } from "./ai";
import { translateUiText } from "./i18n";

const config: AIProviderConfig = { id: "draft", name: "Synthetic service", type: "openai_compatible", baseUrl: "https://model.example/v1", defaultModel: "unavailable-model", apiKey: "synthetic-secret", capabilities: ["text"], enabled: true };
const json = (value: unknown, status = 200) => Response.json(value, { status });

describe("connection tests verify the requested model", () => {
  it("does not report success when a model list is reachable but the requested model is unavailable", async () => {
    const fetchImpl = (async (input: RequestInfo | URL) => String(input).endsWith("/models")
      ? json({ data: [{ id: "some-other-model" }] })
      : json({ error: { code: "model_not_found", message: "Requested model does not exist" } }, 404)) as typeof fetch;
    const result = await createAIProviderAdapter(config, { fetchImpl }).testConnection();
    expect(result.ok).toBe(false);
  });
  it.each(["openai_compatible", "anthropic", "dify"] as const)("%s validates generation, not HTML or empty objects", async type => {
    for (const body of ["<html>login</html>", "{}", '{"choices":[{"message":{"content":" "}}]}']) {
      const result = await createAIProviderAdapter({ ...config, type }, { fetchImpl: async () => new Response(body) }).testConnection();
      expect(result.ok).toBe(false);
    }
  });
  it("reports requested and returned models without silently selecting another model", async () => {
    const requests: Record<string, unknown>[] = [];
    const fetchImpl = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      requests.push(JSON.parse(String(init?.body)));
      return json({ model: "served-version", choices: [{ message: { content: "OK" }, finish_reason: "stop" }] });
    }) as typeof fetch;
    const result = await createAIProviderAdapter(config, { fetchImpl }).testConnection();
    expect(result).toMatchObject({ ok: true, requestedModel: "unavailable-model", returnedModel: "served-version", verification: "model" });
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({ model: "unavailable-model", max_tokens: 1024 });
    expect(result.message).toContain("differs from the requested ID");
    expect(translateUiText(result.message, "zh")).toBe("测试成功 · 请求模型 unavailable-model · 返回模型 served-version（与请求 ID 不同，请核对服务端映射）");
  });
  it.each([
    [401, "invalid_api_key", "密钥", "authentication"],
    [402, "insufficient_balance", "余额", "balance"],
    [429, "insufficient_quota", "余额", "balance"],
    [404, "model_not_found", "模型", "model"],
    [403, "permission_denied", "权限", "permission"],
    [404, "unknown route", "基础地址", "endpoint"],
    [429, "rate_limit", "请求过快", "rate_limit"],
    [503, "overloaded", "繁忙", "unavailable"],
  ])("classifies HTTP %s / %s without confusing authentication, permissions and endpoint errors", async (status, code, label, errorCode) => {
    const result = await createAIProviderAdapter(config, { fetchImpl: async () => json({ error: { code, message: "synthetic-secret" } }, Number(status)) }).testConnection();
    expect(result).toMatchObject({ ok: false, httpStatus: status, errorCode });
    expect(result.message).toContain(label);
    expect(JSON.stringify(result)).not.toContain("synthetic-secret");
  });
  it("describes a server-side timeout and redacts a credential echoed as the returned model", async () => {
    const timeout = await createAIProviderAdapter(config, { fetchImpl: async () => { throw new DOMException("timeout", "TimeoutError"); } }).testConnection();
    expect(timeout).toMatchObject({ ok: false, errorCode: "timeout" });
    expect(timeout.message).toContain("服务器");
    const echoed = await createAIProviderAdapter(config, { fetchImpl: async () => json({ model: "synthetic-secret", choices: [{ message: { content: "OK" } }] }) }).testConnection();
    expect(JSON.stringify(echoed)).not.toContain("synthetic-secret");
  });
});
