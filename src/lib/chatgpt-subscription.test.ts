import { createHash, createSign, generateKeyPairSync } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAIProviderAdapter, readResponseStream, type AIProviderConfig, type AIProviderError } from "./ai";
import { beginChatGPTSignIn, chatGPTHostId, ChatGPTSignInError, finishChatGPTSignIn, keptChoice, listChatGPTModels, loopbackPort, openPendingSignIn, sealPendingSignIn, verifyIdToken, type ChatGPTEffort, type PendingSignIn } from "./chatgpt-auth";
import { translateUiText } from "./i18n";

vi.mock("./db", () => ({ prisma: {} }));
beforeEach(() => { vi.stubEnv("LABNEST_AI_ENCRYPTION_KEY", "a".repeat(64)); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

const token = "chatgpt-access-0123456789abcdef";
const config: AIProviderConfig = { id: "c1", name: "ChatGPT · me@example.com", type: "chatgpt_subscription", defaultModel: "gpt-test", capabilities: ["text", "vision"], enabled: true };
const sse = (...events: Record<string, unknown>[]) => events.map(event => `event: ${String(event.type)}\ndata: ${JSON.stringify(event)}\n\n`).join("");
const completed = (output: unknown[] = []) => ({ type: "response.completed", response: { model: "gpt-test-2026", output } });

/** A Responses endpoint that answers every call with `body`, keeping what was sent. */
function responses(body: string, status = 200) {
  const sent: { url: string; headers: Headers; body: Record<string, unknown> }[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    sent.push({ url: String(input), headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) });
    return new Response(body, { status, headers: { "content-type": status === 200 ? "text/event-stream" : "application/json" } });
  }) as typeof fetch;
  return { sent, adapter: createAIProviderAdapter(config, { fetchImpl, accessToken: async () => token }) };
}
const rejection = (promise: Promise<unknown>) => promise.then(() => { throw new Error("expected the call to fail"); }, (error: unknown) => error as AIProviderError);

describe("reading a streamed Responses answer", () => {
  it("joins the text deltas and needs response.completed", () => {
    expect(readResponseStream(sse({ type: "response.output_text.delta", delta: "O" }, { type: "response.output_text.delta", delta: "K" }, completed()))).toMatchObject({ text: "OK", model: "gpt-test-2026" });
    expect(() => readResponseStream(sse({ type: "response.output_text.delta", delta: "partial" }))).toThrow(/ended before it was complete/);
  });
  it("falls back to the completed output's message text", () => {
    expect(readResponseStream(sse(completed([{ type: "message", content: [{ type: "output_text", text: "From output" }] }]))).text).toBe("From output");
  });
  it("turns a failed or incomplete answer into an error, never a partial result", () => {
    expect(() => readResponseStream(sse({ type: "response.failed", response: { error: { code: "subscription_sharing_usage_limit_exceeded" } } }))).toThrow(/usage limit for LabNest is used up/);
    expect(() => readResponseStream(sse({ type: "response.incomplete" }))).toThrow(/stopped before finishing/);
    expect(() => readResponseStream("data: {not json\n\n")).toThrow(/could not read/);
  });
});

describe("the ChatGPT subscription adapter", () => {
  it("sends a streamed, unstored request with the account's token and no unsupported parameters", async () => {
    const { sent, adapter } = responses(sse({ type: "response.output_text.delta", delta: "Answer" }, completed()));
    await expect(adapter.complete!("System rules", "User text")).resolves.toMatchObject({ text: "Answer", model: "gpt-test-2026" });
    expect(sent[0].url).toBe("https://api.openai.com/v1/responses");
    expect(sent[0].headers.get("authorization")).toBe(`Bearer ${token}`);
    expect(sent[0].body).toEqual({ model: "gpt-test", instructions: "System rules", input: [{ role: "user", content: "User text" }], store: false, stream: true });
  });
  it("sends the chosen reasoning effort, and none when the model's default is kept", async () => {
    const sent: Record<string, unknown>[] = [];
    const fetchImpl = (async (_input: RequestInfo | URL, init?: RequestInit) => { sent.push(JSON.parse(String(init?.body))); return new Response(sse({ type: "response.output_text.delta", delta: "OK" }, completed())); }) as typeof fetch;
    await createAIProviderAdapter({ ...config, reasoningEffort: "high" }, { fetchImpl, accessToken: async () => token }).complete!("s", "u");
    expect(sent[0].reasoning).toEqual({ effort: "high" });
    expect(sent[0]).not.toHaveProperty("temperature");
  });
  it("tests the connection by generating, and reports the model that answered", async () => {
    const { adapter } = responses(sse({ type: "response.output_text.delta", delta: "OK" }, completed()));
    await expect(adapter.testConnection()).resolves.toMatchObject({ ok: true, verification: "model", requestedModel: "gpt-test", returnedModel: "gpt-test-2026" });
  });
  it("sends a picture as an input image", async () => {
    const { sent, adapter } = responses(sse({ type: "response.output_text.delta", delta: "A label" }, completed()));
    await adapter.describeImage!("Read it", "What does it say?", { mimeType: "image/png", base64: "iVBOR" });
    expect(sent[0].body.input).toEqual([{ role: "user", content: [{ type: "input_text", text: "What does it say?" }, { type: "input_image", image_url: "data:image/png;base64,iVBOR" }] }]);
  });
  it("groups tools in one namespace and sends earlier tool calls and results back whole", async () => {
    const call = { type: "function_call", call_id: "call_2", namespace: "labnest", name: "find_records", arguments: "{\"query\":\"PCR\"}" };
    const { sent, adapter } = responses(sse({ type: "response.output_item.done", item: call }, completed()));
    const turn = await adapter.chat!("Agent rules", [
      { role: "user", content: "Find PCR" },
      { role: "assistant", content: "Looking", toolCalls: [{ id: "call_1", name: "find_records", arguments: { query: "PCR" } }] },
      { role: "tool", toolCallId: "call_1", name: "find_records", content: "[]" },
    ], [{ name: "find_records", description: "Search records", parameters: { type: "object", properties: { query: { type: "string" } } } }]);
    expect(turn.toolCalls).toEqual([{ id: "call_2", name: "find_records", arguments: { query: "PCR" } }]);
    expect(sent[0].body.tools).toEqual([{ type: "namespace", name: "labnest", description: "LabNest records and actions", tools: [{ type: "function", name: "find_records", description: "Search records", parameters: { type: "object", properties: { query: { type: "string" } } } }] }]);
    expect(sent[0].body.input).toEqual([
      { role: "user", content: "Find PCR" },
      { role: "assistant", content: "Looking" },
      { type: "function_call", call_id: "call_1", namespace: "labnest", name: "find_records", arguments: "{\"query\":\"PCR\"}" },
      { type: "function_call_output", call_id: "call_1", output: "[]" },
    ]);
  });
  it("explains a used-up plan in its own words, not as a bad key, and keeps the token out", async () => {
    const { adapter } = responses(JSON.stringify({ error: { code: "subscription_sharing_usage_limit_exceeded", message: `limit for ${token}` } }), 429);
    const error = await rejection(adapter.complete!("s", "u"));
    expect(error).toMatchObject({ status: 429, code: "subscription_sharing_usage_limit_exceeded" });
    const test = await adapter.testConnection();
    expect(test.message).toBe(error.message);
    expect(test.message).not.toContain(token);
    expect(translateUiText(test.message, "zh")).toMatch(/额度已用完/);
  });
  it("asks to sign in again when the server has no sign-in for it", async () => {
    const adapter = createAIProviderAdapter(config, { fetchImpl: (async () => { throw new Error("must not call"); }) as typeof fetch });
    expect(await rejection(adapter.complete!("s", "u"))).toMatchObject({ status: 401 });
  });
});

describe("where a sign-in may start", () => {
  it("accepts only this computer's own addresses", () => {
    expect(loopbackPort("127.0.0.1:3001")).toBe("3001");
    expect(loopbackPort("localhost:3002")).toBe("3002");
    expect(loopbackPort("[::1]:3001")).toBe("3001");
    expect(loopbackPort("localhost")).toBe("80");
    for (const host of ["192.168.1.5:3001", "labnest.example.com", "127.0.0.1.evil.test:3001", null]) expect(loopbackPort(host)).toBeUndefined();
  });
  it("keeps one host ID for this installation", () => {
    expect(chatGPTHostId()).toMatch(/^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(chatGPTHostId()).toBe(chatGPTHostId());
  });
  it("keeps a pending sign-in sealed and only for ten minutes", () => {
    const pending: PendingSignIn = { state: "s", nonce: "n", verifier: "v", redirectUri: "http://127.0.0.1:3001/auth/callback", returnTo: "http://localhost:3001", createdAt: Date.now() };
    const sealed = sealPendingSignIn(pending);
    expect(sealed).not.toContain("verifier");
    expect(openPendingSignIn(sealed)).toEqual(pending);
    expect(openPendingSignIn(sealPendingSignIn({ ...pending, createdAt: Date.now() - 11 * 60_000 }))).toBeUndefined();
    expect(openPendingSignIn("tampered")).toBeUndefined();
  });
});

// OpenAI's sign-in, played locally: discovery, signing keys and the token endpoint.
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "k1", alg: "RS256", use: "sig" };
const base64url = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
function idToken(claims: Record<string, unknown>) {
  const signed = `${base64url({ alg: "RS256", kid: "k1", typ: "JWT" })}.${base64url(claims)}`;
  return `${signed}.${createSign("RSA-SHA256").update(signed).sign(privateKey).toString("base64url")}`;
}
const now = () => Math.floor(Date.now() / 1000);
const claims = (overrides: Record<string, unknown> = {}) => ({ iss: "https://auth.openai.com", aud: "oaiapp_123", sub: "user-1", email: "me@example.com", iat: now(), exp: now() + 600, nonce: "nonce-1", ...overrides });

function openAI(tokenResponse: Record<string, unknown>) {
  const tokenRequests: URLSearchParams[] = [];
  vi.stubGlobal("fetch", (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith("/.well-known/openid-configuration")) return Response.json({ issuer: "https://auth.openai.com", authorization_endpoint: "https://auth.openai.com/api/accounts/authorize", token_endpoint: "https://auth.openai.com/api/accounts/oauth/token", revocation_endpoint: "https://auth.openai.com/api/accounts/oauth/revoke", jwks_uri: "https://auth.openai.com/.well-known/jwks.json" });
    if (url.endsWith("/jwks.json")) return Response.json({ keys: [jwk] });
    if (url.endsWith("/oauth/token")) { tokenRequests.push(new URLSearchParams(String(init?.body))); return Response.json(tokenResponse); }
    throw new Error(`unexpected ${url}`);
  }) as typeof fetch);
  return tokenRequests;
}
const granted = (overrides: Record<string, unknown> = {}) => ({ access_token: "at", refresh_token: "rt", token_type: "Bearer", expires_in: 3600, scope: "openid profile email offline_access resource.invoke chatgpt.tokens.use.direct", id_token: idToken(claims()), ...overrides });
const pending: PendingSignIn = { state: "state-1", nonce: "nonce-1", verifier: "verifier-1", redirectUri: "http://127.0.0.1:3001/auth/callback", returnTo: "http://localhost:3001", createdAt: Date.now() };
const callback = (values: Record<string, string>) => new URLSearchParams({ state: "state-1", code: "code-1", client_id: "oaiapp_123", ...values });
const reason = (promise: Promise<unknown>) => promise.then(() => "succeeded", (error: unknown) => error instanceof ChatGPTSignInError ? error.reason : String(error));

describe("signing in with ChatGPT", () => {
  it("asks for plan usage with PKCE, the loopback callback and this host", async () => {
    openAI(granted());
    const { pending: started, url } = await beginChatGPTSignIn("3001", "http://localhost:3001");
    const query = new URL(url).searchParams;
    expect(url.startsWith("https://auth.openai.com/api/accounts/authorize?")).toBe(true);
    expect(Object.fromEntries(query)).toMatchObject({ client_id: "dynamic_agent_client", response_type: "code", redirect_uri: "http://127.0.0.1:3001/auth/callback", resource: "https://api.openai.com/v1", code_challenge_method: "S256", agent_name_hint: "LabNest", ext_agent_host_id: chatGPTHostId(), state: started.state, nonce: started.nonce });
    expect(query.get("scope")?.split(" ")).toContain("chatgpt.tokens.use.direct");
    expect(query.get("code_challenge")).toBe(createHash("sha256").update(started.verifier).digest("base64url"));
  });
  it("signs the same registration in again with its client ID and email", async () => {
    openAI(granted());
    const { url } = await beginChatGPTSignIn("3001", "http://127.0.0.1:3001", { providerId: "p1", registration: { clientId: "oaiapp_123", subject: "user-1", email: "me@example.com" } });
    const query = new URL(url).searchParams;
    expect(query.get("client_id")).toBe("oaiapp_123");
    expect(query.get("login_hint")).toBe("me@example.com");
    expect(query.has("agent_name_hint")).toBe(false);
  });
  it("exchanges the code with the verifier and returns the verified account", async () => {
    const tokenRequests = openAI(granted());
    const result = await finishChatGPTSignIn(callback({}), pending);
    expect(result.registration).toEqual({ clientId: "oaiapp_123", subject: "user-1", email: "me@example.com" });
    expect(result.tokens).toMatchObject({ accessToken: "at", refreshToken: "rt" });
    expect(Object.fromEntries(tokenRequests[0])).toMatchObject({ grant_type: "authorization_code", client_id: "oaiapp_123", code: "code-1", code_verifier: "verifier-1", redirect_uri: "http://127.0.0.1:3001/auth/callback", resource: "https://api.openai.com/v1" });
  });
  it("stops on a refusal, a foreign state, a changed client ID, a missing plan grant or another account", async () => {
    openAI(granted());
    expect(await reason(finishChatGPTSignIn(new URLSearchParams({ error: "access_denied", state: "state-1" }), pending))).toBe("access_denied");
    expect(await reason(finishChatGPTSignIn(callback({ state: "other" }), pending))).toBe("state");
    expect(await reason(finishChatGPTSignIn(callback({}), undefined))).toBe("state");
    expect(await reason(finishChatGPTSignIn(callback({ client_id: "oaiapp_999" }), { ...pending, clientId: "oaiapp_123" }))).toBe("registration");
    expect(await reason(finishChatGPTSignIn(callback({ client_id: "dynamic_agent_client" }), pending))).toBe("registration");
    expect(await reason(finishChatGPTSignIn(callback({}), pending, { clientId: "oaiapp_123", subject: "someone-else" }))).toBe("account_mismatch");
    openAI(granted({ scope: "openid profile email offline_access" }));
    expect(await reason(finishChatGPTSignIn(callback({}), pending))).toBe("plan_scope");
  });
  it("lists the account's visible models with the efforts the API takes", async () => {
    vi.stubGlobal("fetch", (async () => Response.json({ models: [
      { slug: "gpt-a", display_name: "GPT A", visibility: "list", default_reasoning_level: "low", supported_reasoning_levels: [{ effort: "low" }, { effort: "max" }, { effort: "ultra" }] },
      { slug: "hidden", display_name: "Hidden", visibility: "hide", supported_reasoning_levels: [] },
      { slug: "gpt-b", visibility: "list" },
    ] })) as typeof fetch);
    await expect(listChatGPTModels(token)).resolves.toEqual([
      { slug: "gpt-a", displayName: "GPT A", efforts: ["low", "max"], defaultEffort: "low" },
      { slug: "gpt-b", displayName: "gpt-b", efforts: [] },
    ]);
  });
  it("keeps the chosen model and effort while the account still offers them", () => {
    const models = [{ slug: "a", displayName: "A", efforts: ["low", "high"] as ChatGPTEffort[] }, { slug: "b", displayName: "B", efforts: ["low"] as ChatGPTEffort[] }];
    expect(keptChoice(models, "b", "low")).toEqual({ defaultModel: "b", reasoningEffort: "low" });
    expect(keptChoice(models, "b", "high")).toEqual({ defaultModel: "b", reasoningEffort: null });
    expect(keptChoice(models, "gone", "high")).toEqual({ defaultModel: "a", reasoningEffort: "high" });
    expect(keptChoice([], "gone", "high")).toEqual({ defaultModel: "gone", reasoningEffort: "high" });
  });
  it("accepts an ID token only when OpenAI signed it for this client and sign-in", async () => {
    openAI(granted());
    await expect(verifyIdToken(idToken(claims()), "oaiapp_123", "nonce-1")).resolves.toMatchObject({ subject: "user-1" });
    expect(await reason(verifyIdToken(idToken(claims({ nonce: "other" })), "oaiapp_123", "nonce-1"))).toBe("identity");
    expect(await reason(verifyIdToken(idToken(claims({ aud: "oaiapp_999" })), "oaiapp_123"))).toBe("identity");
    expect(await reason(verifyIdToken(idToken(claims({ exp: now() - 60 })), "oaiapp_123"))).toBe("identity");
    expect(await reason(verifyIdToken(idToken(claims({ iss: "https://evil.test" })), "oaiapp_123"))).toBe("identity");
    const [head, , signature] = idToken(claims()).split(".");
    expect(await reason(verifyIdToken(`${head}.${base64url(claims({ sub: "admin" }))}.${signature}`, "oaiapp_123"))).toBe("identity");
  });
});
