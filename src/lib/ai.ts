import { toolArguments, type ChatMessage, type ChatToolSpec, type ChatTurn } from "./ai-chat";
import { proposedActionSchema } from "./validation";
import type { ProposedAction } from "./types";

export type AIProviderCapability = "text" | "structured_output" | "vision" | "embeddings" | "local";

export type AIProviderType = "openai" | "anthropic" | "openai_compatible" | "dify" | "manual_copy_paste" | "chatgpt_subscription";

export type AIProviderConfig = {
  id: string;
  name: string;
  type: AIProviderType;
  baseUrl?: string;
  /** Plain-text credential, only present in server memory while a request runs. */
  apiKey?: string;
  defaultModel?: string;
  /** A ChatGPT subscription model's reasoning effort; absent means the model's default. */
  reasoningEffort?: string;
  capabilities: AIProviderCapability[];
  enabled: boolean;
};

export type EntryToActionPromptInput = {
  entryTitle: string;
  entryBody: string;
  allowedActionTypes: ProposedAction["actionType"][];
};

export type AIConnectionResult = {
  ok: boolean; message: string; latencyMs?: number;
  verification?: "model" | "application" | "manual";
  requestedModel?: string; returnedModel?: string;
  errorCode?: string; httpStatus?: number;
};
type Completion = { text: string; model?: string; returnedModel?: string; truncated?: boolean };

export type AIGenerationResult = {
  actions: ProposedAction[];
  rawResponse: string;
  model?: string;
};

export const AI_LIMITS = { entryTitle: 160, entryBody: 60_000, responseText: 200_000, actions: 50 } as const;

export const allowedProposedActionTypes: ProposedAction["actionType"][] = [
  "create_experiment",
  "update_experiment",
  "consume_inventory",
  "create_entity",
  "create_result",
  "create_purchase_request",
  "receive_purchase",
  "link_attachment",
  "link_item",
  "create_inventory_item",
  "create_protocol_run",
];

export const defaultProviderBaseUrls: Partial<Record<AIProviderType, string>> = {
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com/v1",
  chatgpt_subscription: "https://api.openai.com/v1",
};

export const providerTypeLabels: Record<AIProviderType, string> = {
  manual_copy_paste: "Manual copy and paste",
  openai: "Official OpenAI API",
  openai_compatible: "OpenAI-compatible API",
  anthropic: "Anthropic API",
  dify: "Dify app",
  chatgpt_subscription: "ChatGPT subscription",
};

const connectedProviderTypes: AIProviderType[] = ["openai", "openai_compatible", "anthropic", "dify", "chatgpt_subscription"];

/** True for provider types that call a model over the network (everything except manual copy-paste). */
export function isConnectedProviderType(type: string): type is AIProviderType {
  return connectedProviderTypes.includes(type as AIProviderType);
}

export const manualCopyPasteProviderConfig: AIProviderConfig = {
  id: "manual-copy-paste",
  name: "Manual copy-paste mode",
  type: "manual_copy_paste",
  defaultModel: "external-web-subscription",
  capabilities: ["text", "structured_output"],
  enabled: true,
};

export interface AIProviderAdapter {
  readonly config: AIProviderConfig;
  testConnection(): Promise<AIConnectionResult>;
  generateProposedActions?(input: EntryToActionPromptInput): Promise<AIGenerationResult>;
  /** Raw completion for feature-specific prompts. Absent on manual copy-paste mode. */
  complete?(system: string, user: string): Promise<{ text: string; model?: string }>;
  /** Reads one picture with a model that can see; absent when the service cannot (manual mode, Dify). */
  describeImage?(system: string, user: string, image: ImageInput): Promise<{ text: string; model?: string }>;
  /** One turn of a conversation where the model may call tools; absent when the service cannot (manual mode, Dify). */
  chat?(system: string, messages: ChatMessage[], tools: ChatToolSpec[]): Promise<ChatTurn>;
}

/** A picture sent to a model: its type and its bytes as base64 (never a link, never stored by LabNest). */
export type ImageInput = { mimeType: string; base64: string };

export class AIProviderError extends Error {
  readonly status?: number;
  readonly code?: string;

  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = "AIProviderError";
    this.status = status;
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Prompt and response handling shared by every adapter
// ---------------------------------------------------------------------------

export function buildProposedActionPrompt(input: EntryToActionPromptInput): { system: string; user: string } {
  const system = [
    "You are assisting a lab notebook user. Extract only reviewable proposed actions.",
    "Never claim that an action was executed. Never mutate inventory, experiments, entities, protocols, results, or purchases.",
    `Allowed action types: ${input.allowedActionTypes.join(", ")}`,
    "Return only a JSON array. Each item must match: {sourceType, actionType, reason, payload}.",
    "Use sourceType: \"ai\" unless a stronger source is explicitly present.",
    "Keep payload conservative and traceable. Do not invent measurements, sample IDs, stock quantities, or statistical results.",
    "If the entry contains nothing actionable, return an empty JSON array [].",
  ].join("\n");
  const user = [`Entry title: ${input.entryTitle}`, `Entry body: ${input.entryBody}`].join("\n");
  return { system, user };
}

export function extractJsonPayload(rawResponse: string) {
  const trimmed = rawResponse.trim();
  const fencedJson = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);

  if (fencedJson?.[1]) {
    return fencedJson[1].trim();
  }

  if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) {
    const start = trimmed.indexOf("[");
    const end = trimmed.lastIndexOf("]");
    if (start !== -1 && end > start) {
      return trimmed.slice(start, end + 1);
    }
  }

  return trimmed;
}

export function parseProposedActions(
  rawResponse: string,
  options: { sourceLabel: string; idPrefix: string; allowedActionTypes?: ProposedAction["actionType"][] },
): ProposedAction[] {
  if (rawResponse.length > AI_LIMITS.responseText) throw new AIProviderError("The model response is too large. Nothing was imported.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonPayload(rawResponse));
  } catch {
    throw new AIProviderError("The model response was not valid JSON. Nothing was imported.");
  }
  const array = Array.isArray(parsed) ? parsed : [parsed];
  if (array.length > AI_LIMITS.actions) throw new AIProviderError(`The model returned more than ${AI_LIMITS.actions} actions. Nothing was imported.`);
  return array.map((item, index) => {
    const result = proposedActionSchema.safeParse(item);
    if (!result.success) throw new AIProviderError("The model response did not match the proposed-action schema. Nothing was imported.");
    const validated = result.data;
    if (options.allowedActionTypes && !options.allowedActionTypes.includes(validated.actionType)) {
      throw new AIProviderError("The model returned a type outside the allowed action types. Nothing was imported.");
    }
    if (options.allowedActionTypes && Object.keys(validated.payload).length === 0) {
      throw new AIProviderError("The model returned an empty action payload. Nothing was imported.");
    }
    return {
      id: `${options.idPrefix}-${index + 1}`,
      sourceType: validated.sourceType,
      sourceLabel: options.sourceLabel,
      actionType: validated.actionType,
      status: "pending",
      reason: validated.reason,
      payload: validated.payload,
      createdAt: new Date().toISOString(),
    };
  });
}

// ---------------------------------------------------------------------------
// Manual copy-paste mode (no network)
// ---------------------------------------------------------------------------

export class ManualCopyPasteProvider implements AIProviderAdapter {
  readonly config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  async testConnection(): Promise<AIConnectionResult> {
    return {
      ok: true,
      message: "Manual mode is available without API access. The app will generate prompts for copy-paste review.",
    };
  }

  createPrompt(input: EntryToActionPromptInput): string {
    const { system, user } = buildProposedActionPrompt(input);
    return `${system}\n\n${user}`;
  }

  parseResponse(rawResponse: string): ProposedAction[] {
    return parseProposedActions(rawResponse, { sourceLabel: "Manual copy-paste AI", idPrefix: "manual-ai" });
  }
}

// ---------------------------------------------------------------------------
// Connected adapters
// ---------------------------------------------------------------------------

type FetchLike = typeof fetch;

export type ConnectedProviderOptions = {
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  /** A ChatGPT plan service's current access token, refreshed by the server when it is about to expire. */
  accessToken?: () => Promise<string>;
};

const DEFAULT_TIMEOUT_MS = 60_000;

export function resolveBaseUrl(value: string | undefined, type: AIProviderType): string {
  const resolved = (value?.trim() || defaultProviderBaseUrls[type] || "").replace(/\/+$/, "");
  if (!resolved) {
    throw new AIProviderError(`A base URL is required for ${providerTypeLabels[type]} providers.`);
  }
  let url: URL;
  try { url = new URL(resolved); } catch { throw new AIProviderError("请检查 API 基础地址。"); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash || /\/(chat\/completions|messages|chat-messages|models|parameters)\/?$/i.test(url.pathname)) {
    throw new AIProviderError("请填写 API 基础地址，不要包含完整调用路径、凭据或查询参数。");
  }
  return url.toString().replace(/\/+$/, "");
}

/**
 * Provider text as shown to people: the key never appears in it. Services echo a key whole, cut ("sk-live-0123…") or masked
 * ("sk-****WXYZ"), so besides the key itself (as sent, and URL-encoded) any word that carries its first 8 or last 6
 * characters, or a run of asterisks, is hidden.
 */
export function redactSecret(message: string, secret?: string): string {
  const key = secret?.trim();
  if (!key) return message;
  const text = [...new Set([encodeURIComponent(key), key])].reduce((out, value) => out.replaceAll(value, "[redacted]"), message);
  const fragments = key.length >= 12 ? [key.slice(0, 8), key.slice(-6)] : [];
  return text.replace(/\S+/g, word => word !== "[redacted]" && (/\*{3,}/.test(word) || fragments.some(fragment => word.includes(fragment))) ? "[redacted]" : word);
}

async function readErrorBody(response: Response): Promise<string> {
  try {
    const text = await response.text();
    if (!text) return "";
    try {
      const json = JSON.parse(text) as { error?: { message?: string; code?: string; type?: string } | string; message?: string };
      if (typeof json.error === "string") return json.error;
      if (json.error && typeof json.error === "object" && typeof json.error.message === "string") return [json.error.code || json.error.type, json.error.message].filter(Boolean).join(": ");
      if (typeof json.message === "string") return json.message;
    } catch {
      // not JSON
    }
    return text;
  } catch {
    return "";
  }
}

function describeNetworkError(error: unknown): string {
  if (error instanceof AIProviderError) return error.message;
  if (error instanceof Error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") return "The request timed out.";
    const cause = (error as Error & { cause?: { code?: string; message?: string } }).cause;
    if (cause?.code) return `${error.message} (${cause.code})`;
    return error.message;
  }
  return "Unknown network error.";
}

/** Classify the evidence from this request, not a permanent provider health state. */
function connectionFailure(error: unknown, detail: string): Pick<AIConnectionResult, "message" | "errorCode" | "httpStatus"> {
  const status = error instanceof AIProviderError ? error.status : undefined;
  let errorCode = "invalid_response", message = "服务返回的内容不符合接口协议，尚未验证模型生成。";
  if (error instanceof AIProviderError && error.code === "timeout") { errorCode = "timeout"; message = "LabNest 服务器请求超时，请稍后手动重试。"; }
  else if (error instanceof AIProviderError && error.code === "network") { errorCode = "network"; message = "LabNest 服务器无法连接该服务，请检查地址与服务器网络。"; }
  // A ChatGPT plan's own reasons are already worded for people; HTTP status would misread them (401 is not a key).
  else if (error instanceof AIProviderError && error.code && (error.code === "chatgpt_sign_in" || chatGPTErrorMessages[error.code])) return { errorCode: error.code, httpStatus: status, message: error.message };
  else if (/设置已改变|AI 已关闭|settings changed|AI is off/i.test(detail)) { errorCode = "cancelled"; message = "AI 或服务设置已改变，本次测试已停止。"; }
  else if (status === 402 || /insufficient[_ ](?:quota|balance)|credit balance|余额不足/i.test(detail)) { errorCode = "balance"; message = "账户余额不足，请到服务平台检查。"; }
  else if (status === 401) { errorCode = "authentication"; message = "API 密钥无效或已失效，请检查密钥。"; }
  else if (/model[_ ]not[_ ]found|invalid[_ ]model|model.*(?:does not exist|not exist|not found|not have access|permission|not available)|(?:no|not have) access to (?:the )?model|无权(?:使用|访问)模型/i.test(detail)) { errorCode = "model"; message = "模型不存在或当前密钥无权使用，请核对模型 ID 与权限。"; }
  else if (status === 403) { errorCode = "permission"; message = "服务拒绝访问，请检查账户权限或服务访问策略。"; }
  else if (status === 429) { errorCode = "rate_limit"; message = "请求过快或已达到服务限流，请稍后手动重试。"; }
  else if (status && status >= 500) { errorCode = "unavailable"; message = "服务暂时繁忙或不可用，请稍后手动重试。"; }
  else if (status) { errorCode = "endpoint"; message = "请检查 API 基础地址与接口类型。"; }
  const safeDetail = error instanceof SyntaxError ? "返回内容不是有效 JSON" : detail.slice(0, 300);
  return { errorCode, httpStatus: status, message: `${message}${status ? `（HTTP ${status}）` : ""} ${safeDetail}` };
}

abstract class ConnectedProvider implements AIProviderAdapter {
  readonly config: AIProviderConfig;
  protected readonly fetchImpl: FetchLike;
  protected readonly timeoutMs: number;

  constructor(config: AIProviderConfig, options: ConnectedProviderOptions = {}) {
    this.config = config;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  protected get baseUrl(): string {
    return resolveBaseUrl(this.config.baseUrl, this.config.type);
  }

  protected requireApiKey(): string {
    const key = this.config.apiKey?.trim();
    if (!key) {
      throw new AIProviderError("No API key is stored for this provider. Enter one on the AI page before connecting.");
    }
    return key;
  }

  protected requireModel(): string {
    const model = this.config.defaultModel?.trim();
    if (!model) {
      throw new AIProviderError("A default model name is required for this provider.");
    }
    return model;
  }

  protected safeMessage(message: string): string {
    return redactSecret(message, this.config.apiKey);
  }

  protected async request(path: string, init: RequestInit): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    let response: Response;
    try {
      response = await this.fetchImpl(url, { ...init, redirect: "error", signal: AbortSignal.timeout(this.timeoutMs) });
    } catch (error) {
      if (error instanceof AIProviderError) throw error;
      throw new AIProviderError(this.safeMessage(describeNetworkError(error)), 502, error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name) ? "timeout" : "network");
    }
    if (!response.ok) {
      // Redact the complete text before truncation, so a token crossing the
      // display boundary cannot leak its prefix.
      const detail = this.safeMessage(await readErrorBody(response)).slice(0, 300);
      throw new AIProviderError(
        this.safeMessage(`${this.config.name} returned HTTP ${response.status}${detail ? `: ${detail}` : ""}`),
        response.status,
      );
    }
    return response;
  }

  protected async guarded(run: () => Promise<AIConnectionResult>): Promise<AIConnectionResult> {
    if (!this.config.enabled) {
      return { ok: false, message: "Provider is disabled." };
    }
    const started = Date.now();
    try {
      const result = await run();
      return { ...result, message: this.safeMessage(result.message), requestedModel: result.requestedModel ? this.safeMessage(result.requestedModel) : undefined, returnedModel: result.returnedModel ? this.safeMessage(result.returnedModel).slice(0, 160) : undefined, latencyMs: Date.now() - started };
    } catch (error) {
      return { ok: false, ...connectionFailure(error, this.safeMessage(describeNetworkError(error))), latencyMs: Date.now() - started };
    }
  }

  abstract testConnection(): Promise<AIConnectionResult>;
  abstract complete(system: string, user: string, testing?: boolean): Promise<Completion>;

  protected testGeneration(): Promise<AIConnectionResult> {
    return this.guarded(async () => {
      const result = await this.complete("Reply with the single word OK.", "Connection test only. No business data.", true);
      if (!result.text.trim()) throw new AIProviderError(result.truncated ? "The test used up its output allowance before any text came back; this does not mean the key is wrong." : "The model returned empty content; generation is not verified yet.");
      if (this.config.type === "dify") return { ok: true, verification: "application", message: "App generation test succeeded; the actual model is set by the Dify app." };
      const requestedModel = this.requireModel();
      const returnedModel = result.returnedModel;
      const mismatch = returnedModel && returnedModel !== requestedModel;
      return { ok: true, verification: "model", requestedModel, returnedModel,
        message: `Test succeeded · requested model ${requestedModel}${returnedModel ? ` · returned model ${returnedModel}${mismatch ? " (differs from the requested ID; check the service’s mapping)" : ""}` : " · the service returned no model ID"}${result.truncated ? " · output truncated" : ""}` };
    });
  }

  async generateProposedActions(input: EntryToActionPromptInput): Promise<AIGenerationResult> {
    if (!this.config.enabled) {
      throw new AIProviderError("Provider is disabled.");
    }
    const { system, user } = buildProposedActionPrompt(input);
    if (input.entryTitle.length > AI_LIMITS.entryTitle || input.entryBody.length > AI_LIMITS.entryBody) {
      throw new AIProviderError("The selected entry text exceeds the AI input limit.");
    }
    let completion: { text: string; model?: string };
    try { completion = await this.complete(system, user); }
    catch (error) {
      if (error instanceof AIProviderError) throw new AIProviderError(this.safeMessage(error.message), error.status);
      throw new AIProviderError(this.safeMessage(describeNetworkError(error)));
    }
    const { text, model } = completion;
    const actions = parseProposedActions(text, {
      sourceLabel: `${this.config.name}${model ? ` · ${model}` : ""}`,
      idPrefix: `ai-${this.config.id}`,
      allowedActionTypes: input.allowedActionTypes,
    }).map(action => ({ ...action, sourceType: "ai" as const }));
    return { actions, rawResponse: text, model };
  }
}

type OpenAIChatResponse = {
  model?: string;
  choices?: { message?: { content?: string | { type?: string; text?: string }[] }; finish_reason?: string }[];
};

function openAIContentToText(content: OpenAIChatResponse["choices"]): string {
  const message = content?.[0]?.message?.content;
  if (typeof message === "string") return message;
  if (Array.isArray(message)) {
    return message.map((part) => (typeof part.text === "string" ? part.text : "")).join("");
  }
  throw new AIProviderError("The model response did not contain a message.");
}

/** OpenAI Chat Completions and any compatible endpoint (Qwen/DashScope compatible mode, vLLM, Ollama, etc.). */
export class OpenAICompatibleProvider extends ConnectedProvider {
  async testConnection(): Promise<AIConnectionResult> {
    return this.testGeneration();
  }

  async complete(system: string, user: string, testing = false) {
    const apiKey = this.requireApiKey();
    const model = this.requireModel();
    const response = await this.request("/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model,
        ...(testing ? (this.config.type === "openai" ? { max_completion_tokens: 1024 } : { max_tokens: 1024 }) : { temperature: 0 }),
        ...(testing && new URL(this.baseUrl).hostname === "api.deepseek.com" ? { thinking: { type: "disabled" } } : {}),
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    const payload = (await response.json()) as OpenAIChatResponse;
    return { text: openAIContentToText(payload.choices), model: typeof payload.model === "string" ? payload.model : model, returnedModel: typeof payload.model === "string" ? payload.model : undefined, truncated: payload.choices?.[0]?.finish_reason === "length" };
  }

  async chat(system: string, messages: ChatMessage[], tools: ChatToolSpec[]): Promise<ChatTurn> {
    const apiKey = this.requireApiKey();
    const model = this.requireModel();
    const response = await this.request("/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model,
        ...(this.config.type === "openai" ? { max_completion_tokens: 4096 } : { max_tokens: 4096 }),
        messages: [{ role: "system", content: system }, ...messages.map(message => message.role === "tool"
          ? { role: "tool", tool_call_id: message.toolCallId, content: message.content }
          : message.role === "assistant"
            ? { role: "assistant", content: message.content ?? null, ...(message.toolCalls?.length ? { tool_calls: message.toolCalls.map(call => ({ id: call.id, type: "function", function: { name: call.name, arguments: JSON.stringify(call.arguments) } })) } : {}) }
            : { role: "user", content: message.content })],
        ...(tools.length ? { tools: tools.map(tool => ({ type: "function", function: { name: tool.name, description: tool.description, parameters: tool.parameters } })) } : {}),
      }),
    });
    const payload = (await response.json()) as OpenAIChatResponse & { choices?: { message?: { tool_calls?: { id?: string; function?: { name?: string; arguments?: unknown } }[] } }[] };
    const message = payload.choices?.[0]?.message;
    if (!message) throw new AIProviderError("The model response did not contain a message.");
    const content = message.content;
    const text = typeof content === "string" ? content : Array.isArray(content) ? content.map(part => (typeof part.text === "string" ? part.text : "")).join("") : "";
    const toolCalls = (message.tool_calls ?? []).flatMap((call, index) => call.function?.name ? [{ id: call.id || `call-${index}`, name: call.function.name, arguments: toolArguments(call.function.arguments) }] : []);
    return { text, toolCalls, model: typeof payload.model === "string" ? payload.model : model };
  }

  async describeImage(system: string, user: string, image: ImageInput) {
    const apiKey = this.requireApiKey();
    const model = this.requireModel();
    const response = await this.request("/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model,
        ...(this.config.type === "openai" ? { max_completion_tokens: 4096 } : { max_tokens: 4096 }),
        messages: [
          { role: "system", content: system },
          { role: "user", content: [{ type: "text", text: user }, { type: "image_url", image_url: { url: `data:${image.mimeType};base64,${image.base64}` } }] },
        ],
      }),
    });
    const payload = (await response.json()) as OpenAIChatResponse;
    return { text: openAIContentToText(payload.choices), model: typeof payload.model === "string" ? payload.model : model };
  }
}

type AnthropicMessageResponse = { model?: string; content?: { type?: string; text?: string }[] };

const ANTHROPIC_VERSION = "2023-06-01";

export class AnthropicProvider extends ConnectedProvider {
  private headers(apiKey: string) {
    return { "x-api-key": apiKey, "anthropic-version": ANTHROPIC_VERSION, "content-type": "application/json" };
  }

  async testConnection(): Promise<AIConnectionResult> {
    return this.testGeneration();
  }

  async complete(system: string, user: string, testing = false) {
    const apiKey = this.requireApiKey();
    const model = this.requireModel();
    const response = await this.request("/messages", {
      method: "POST",
      headers: this.headers(apiKey),
      body: JSON.stringify({
        model,
        max_tokens: testing ? 256 : 4096,
        ...(testing ? {} : { temperature: 0 }),
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    const payload = (await response.json()) as AnthropicMessageResponse;
    const text = (payload.content ?? [])
      .filter((block) => block.type === "text" && typeof block.text === "string")
      .map((block) => block.text)
      .join("");
    if (!text) throw new AIProviderError("The model response did not contain text content.");
    return { text, model: typeof payload.model === "string" ? payload.model : model, returnedModel: typeof payload.model === "string" ? payload.model : undefined };
  }

  async chat(system: string, messages: ChatMessage[], tools: ChatToolSpec[]): Promise<ChatTurn> {
    const apiKey = this.requireApiKey();
    const model = this.requireModel();
    // Anthropic wants the results of tool calls inside the next user message, one block each.
    const turns: { role: "user" | "assistant"; content: unknown }[] = [];
    for (const message of messages) {
      if (message.role === "tool") {
        const block = { type: "tool_result", tool_use_id: message.toolCallId, content: message.content };
        const last = turns.at(-1);
        if (last?.role === "user" && Array.isArray(last.content)) (last.content as unknown[]).push(block); else turns.push({ role: "user", content: [block] });
      } else if (message.role === "assistant") {
        turns.push({ role: "assistant", content: [...(message.content ? [{ type: "text", text: message.content }] : []), ...(message.toolCalls ?? []).map(call => ({ type: "tool_use", id: call.id, name: call.name, input: call.arguments }))] });
      } else turns.push({ role: "user", content: message.content });
    }
    const response = await this.request("/messages", {
      method: "POST",
      headers: this.headers(apiKey),
      body: JSON.stringify({ model, max_tokens: 4096, system, messages: turns, ...(tools.length ? { tools: tools.map(tool => ({ name: tool.name, description: tool.description, input_schema: tool.parameters })) } : {}) }),
    });
    const payload = (await response.json()) as { model?: string; content?: { type?: string; text?: string; id?: string; name?: string; input?: unknown }[] };
    const blocks = payload.content ?? [];
    return {
      text: blocks.filter(block => block.type === "text" && typeof block.text === "string").map(block => block.text).join(""),
      toolCalls: blocks.flatMap((block, index) => block.type === "tool_use" && block.name ? [{ id: block.id || `call-${index}`, name: block.name, arguments: toolArguments(block.input) }] : []),
      model: typeof payload.model === "string" ? payload.model : model,
    };
  }

  async describeImage(system: string, user: string, image: ImageInput) {
    const apiKey = this.requireApiKey();
    const model = this.requireModel();
    const response = await this.request("/messages", {
      method: "POST",
      headers: this.headers(apiKey),
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system,
        messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: image.mimeType, data: image.base64 } }, { type: "text", text: user }] }],
      }),
    });
    const payload = (await response.json()) as AnthropicMessageResponse;
    const text = (payload.content ?? []).filter((block) => block.type === "text" && typeof block.text === "string").map((block) => block.text).join("");
    if (!text) throw new AIProviderError("The model response did not contain text content.");
    return { text, model: typeof payload.model === "string" ? payload.model : model };
  }
}

type DifyChatResponse = { answer?: string; metadata?: { usage?: unknown } };

/**
 * Dify application API (used by ZJU aihub). The API key identifies one published app;
 * the model is chosen inside the Dify app, so `defaultModel` is informational only.
 */
export class DifyProvider extends ConnectedProvider {
  async testConnection(): Promise<AIConnectionResult> {
    return this.testGeneration();
  }

  async complete(system: string, user: string) {
    const apiKey = this.requireApiKey();
    const response = await this.request("/chat-messages", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        inputs: {},
        query: `${system}\n\n${user}`,
        response_mode: "blocking",
        user: "labnest",
      }),
    });
    const payload = (await response.json()) as DifyChatResponse;
    if (typeof payload.answer !== "string" || !payload.answer.trim()) {
      throw new AIProviderError("The Dify application returned an empty answer.");
    }
    return { text: payload.answer, model: this.config.defaultModel?.trim() || undefined };
  }
}

/** ChatGPT plan error codes (Sign in with ChatGPT), as people should read them; anything else keeps its HTTP reading. */
const chatGPTErrorMessages: Record<string, string> = {
  subscription_sharing_usage_limit_exceeded: "The ChatGPT plan’s usage limit for LabNest is used up. Check Usage in ChatGPT settings; it resets on ChatGPT’s schedule.",
  subscription_sharing_user_not_eligible: "This ChatGPT account or workspace cannot use its plan in other apps.",
  subscription_sharing_unsupported_capability: "ChatGPT plan sharing does not support part of this request.",
  subscription_sharing_v2_client_not_enabled: "OpenAI has not enabled plan sharing for this LabNest sign-in.",
  subscription_sharing_invalid_user: "ChatGPT could not check this account’s plan; sign in to ChatGPT again on the AI page.",
  subscription_sharing_user_unavailable: "The ChatGPT account is unavailable for a moment; try again shortly.",
  subscription_sharing_usage_unavailable: "ChatGPT could not check the plan’s usage; try again shortly.",
  model_not_found: "This model is not available to the ChatGPT account; choose another on the AI page.",
};

/** The one namespace LabNest's tools travel in; the plan's Responses API takes function tools only inside one. */
const CHATGPT_TOOL_NAMESPACE = "labnest";

type ResponseOutputItem = { type?: string; content?: { type?: string; text?: string }[]; call_id?: string; name?: string; arguments?: unknown };

/**
 * Reads a streamed Responses answer (server-sent events, already received whole). Only `response.completed` makes it an
 * answer; a failed, incomplete or cut-off stream is an error, never a partial result.
 */
export function readResponseStream(body: string): { text: string; items: ResponseOutputItem[]; model?: string } {
  let deltas = "", completed = false, model: string | undefined;
  const items: ResponseOutputItem[] = [];
  for (const block of body.split(/\r?\n\r?\n/)) {
    const data = block.split(/\r?\n/).filter(line => line.startsWith("data:")).map(line => line.slice(5).trimStart()).join("\n");
    if (!data || data === "[DONE]") continue;
    let event: { type?: string; delta?: unknown; item?: ResponseOutputItem; response?: { model?: unknown; output?: unknown; error?: { code?: string; message?: string } }; error?: { code?: string; message?: string }; code?: string; message?: string };
    try { event = JSON.parse(data); } catch { throw new AIProviderError("ChatGPT sent an answer LabNest could not read; try again."); }
    if (event.type === "response.output_text.delta" && typeof event.delta === "string") deltas += event.delta;
    else if (event.type === "response.output_item.done" && event.item) items.push(event.item);
    else if (event.type === "response.failed" || event.type === "error") {
      const error = event.response?.error ?? event.error ?? event;
      throw new AIProviderError((error.code && chatGPTErrorMessages[error.code]) || `ChatGPT could not finish the answer${error.message ? `: ${error.message}` : "."}`, undefined, error.code);
    } else if (event.type === "response.incomplete") throw new AIProviderError("ChatGPT stopped before finishing the answer; try again or shorten the request.");
    else if (event.type === "response.completed") {
      completed = true;
      if (typeof event.response?.model === "string") model = event.response.model;
      if (!items.length && Array.isArray(event.response?.output)) items.push(...event.response.output as ResponseOutputItem[]);
    }
    if (deltas.length > AI_LIMITS.responseText) throw new AIProviderError("The model response is too large. Nothing was imported.");
  }
  if (!completed) throw new AIProviderError("The ChatGPT answer ended before it was complete; try again.");
  const text = deltas || items.filter(item => item.type === "message").flatMap(item => item.content ?? []).map(part => part.type === "output_text" && typeof part.text === "string" ? part.text : "").join("");
  return { text, items, model };
}

/**
 * A ChatGPT Plus or Pro plan through Sign in with ChatGPT: the public Responses API with the account's own token,
 * streamed and not stored, as the plan requires. The server signs in and refreshes; this only asks for the current token.
 */
export class ChatGPTSubscriptionProvider extends ConnectedProvider {
  private readonly accessToken?: () => Promise<string>;
  private token?: string;

  constructor(config: AIProviderConfig, options: ConnectedProviderOptions = {}) {
    super(config, options);
    this.accessToken = options.accessToken;
  }

  protected safeMessage(message: string): string {
    return redactSecret(super.safeMessage(message), this.token);
  }

  async testConnection(): Promise<AIConnectionResult> {
    return this.testGeneration();
  }

  private async respond(instructions: string, input: unknown[], tools?: ChatToolSpec[]) {
    if (!this.accessToken) throw new AIProviderError("Sign in to ChatGPT again on the AI page.", 401);
    this.token = await this.accessToken();
    const model = this.requireModel();
    let response: Response;
    try {
      response = await this.request("/responses", {
        method: "POST",
        headers: { authorization: `Bearer ${this.token}`, "content-type": "application/json", accept: "text/event-stream" },
        body: JSON.stringify({
          model, instructions, input, store: false, stream: true,
          ...(this.config.reasoningEffort ? { reasoning: { effort: this.config.reasoningEffort } } : {}),
          ...(tools?.length ? { tools: [{ type: "namespace", name: CHATGPT_TOOL_NAMESPACE, description: "LabNest records and actions", tools: tools.map(tool => ({ type: "function", name: tool.name, description: tool.description, parameters: tool.parameters })) }] } : {}),
        }),
      });
    } catch (error) {
      const code = error instanceof AIProviderError ? Object.keys(chatGPTErrorMessages).find(key => error.message.includes(key)) : undefined;
      if (code) throw new AIProviderError(chatGPTErrorMessages[code], (error as AIProviderError).status, code);
      throw error;
    }
    const answer = readResponseStream(await response.text());
    return { ...answer, model: answer.model ?? model, returnedModel: answer.model };
  }

  async complete(system: string, user: string) {
    const { text, model, returnedModel } = await this.respond(system, [{ role: "user", content: user }]);
    return { text, model, returnedModel };
  }

  async describeImage(system: string, user: string, image: ImageInput) {
    const { text, model } = await this.respond(system, [{ role: "user", content: [{ type: "input_text", text: user }, { type: "input_image", image_url: `data:${image.mimeType};base64,${image.base64}` }] }]);
    if (!text) throw new AIProviderError("The model response did not contain text content.");
    return { text, model };
  }

  async chat(system: string, messages: ChatMessage[], tools: ChatToolSpec[]): Promise<ChatTurn> {
    // A tool call and its result are input items of their own; history is sent whole, since nothing is stored.
    const input = messages.flatMap((message): unknown[] => message.role === "tool"
      ? [{ type: "function_call_output", call_id: message.toolCallId, output: message.content }]
      : message.role === "assistant"
        ? [...(message.content ? [{ role: "assistant", content: message.content }] : []), ...(message.toolCalls ?? []).map(call => ({ type: "function_call", call_id: call.id, namespace: CHATGPT_TOOL_NAMESPACE, name: call.name, arguments: JSON.stringify(call.arguments) }))]
        : [{ role: "user", content: message.content }]);
    const { text, items, model } = await this.respond(system, input, tools);
    const toolCalls = items.flatMap((item, index) => item.type === "function_call" && item.name ? [{ id: item.call_id || `call-${index}`, name: item.name, arguments: toolArguments(item.arguments) }] : []);
    return { text, toolCalls, model };
  }
}

export function createAIProviderAdapter(config: AIProviderConfig, options: ConnectedProviderOptions = {}): AIProviderAdapter {
  switch (config.type) {
    case "manual_copy_paste":
      return new ManualCopyPasteProvider(config);
    case "openai":
    case "openai_compatible":
      return new OpenAICompatibleProvider(config, options);
    case "anthropic":
      return new AnthropicProvider(config, options);
    case "dify":
      return new DifyProvider(config, options);
    case "chatgpt_subscription":
      return new ChatGPTSubscriptionProvider(config, options);
    default: {
      const exhaustive: never = config.type;
      throw new AIProviderError(`Unsupported provider type: ${String(exhaustive)}`);
    }
  }
}
