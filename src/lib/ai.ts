import { proposedActionSchema } from "./validation";
import type { ProposedAction } from "./types";

export type AIProviderCapability = "text" | "structured_output" | "vision" | "embeddings" | "local";

export type AIProviderType = "openai" | "anthropic" | "openai_compatible" | "dify" | "manual_copy_paste";

export type AIProviderConfig = {
  id: string;
  name: string;
  type: AIProviderType;
  baseUrl?: string;
  /** Plain-text credential, only present in server memory while a request runs. */
  apiKey?: string;
  defaultModel?: string;
  capabilities: AIProviderCapability[];
  enabled: boolean;
};

export type EntryToActionPromptInput = {
  entryTitle: string;
  entryBody: string;
  allowedActionTypes: ProposedAction["actionType"][];
};

export type AIConnectionResult = { ok: boolean; message: string; latencyMs?: number };

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
};

export const providerTypeLabels: Record<AIProviderType, string> = {
  manual_copy_paste: "Manual copy-paste",
  openai: "OpenAI",
  openai_compatible: "OpenAI-compatible endpoint",
  anthropic: "Anthropic",
  dify: "Dify app (e.g. ZJU aihub)",
};

const connectedProviderTypes: AIProviderType[] = ["openai", "openai_compatible", "anthropic", "dify"];

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
}

export class AIProviderError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "AIProviderError";
    this.status = status;
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
};

const DEFAULT_TIMEOUT_MS = 60_000;

function resolveBaseUrl(value: string | undefined, type: AIProviderType): string {
  const resolved = (value?.trim() || defaultProviderBaseUrls[type] || "").replace(/\/+$/, "");
  if (!resolved) {
    throw new AIProviderError(`A base URL is required for ${providerTypeLabels[type]} providers.`);
  }
  if (!/^https?:\/\//i.test(resolved)) {
    throw new AIProviderError("The base URL must start with http:// or https://.");
  }
  return resolved;
}

async function readErrorBody(response: Response): Promise<string> {
  try {
    const text = await response.text();
    if (!text) return "";
    try {
      const json = JSON.parse(text) as { error?: { message?: string } | string; message?: string };
      if (typeof json.error === "string") return json.error;
      if (json.error && typeof json.error === "object" && typeof json.error.message === "string") return json.error.message;
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
      throw new AIProviderError("No API key is stored for this provider. Enter one in Settings before connecting.");
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
    const key = this.config.apiKey;
    if (!key) return message;
    return [...new Set([key, encodeURIComponent(key)])].reduce((text, secret) => text.replaceAll(secret, "[redacted]"), message);
  }

  protected async request(path: string, init: RequestInit): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    let response: Response;
    try {
      response = await this.fetchImpl(url, { ...init, signal: AbortSignal.timeout(this.timeoutMs) });
    } catch (error) {
      throw new AIProviderError(this.safeMessage(`Could not reach ${url}: ${describeNetworkError(error)}`), 502);
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
      return { ...result, latencyMs: Date.now() - started };
    } catch (error) {
      return { ok: false, message: this.safeMessage(describeNetworkError(error)), latencyMs: Date.now() - started };
    }
  }

  abstract testConnection(): Promise<AIConnectionResult>;
  abstract complete(system: string, user: string): Promise<{ text: string; model?: string }>;

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
  choices?: { message?: { content?: string | { type?: string; text?: string }[] } }[];
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
    return this.guarded(async () => {
      const apiKey = this.requireApiKey();
      const headers = { authorization: `Bearer ${apiKey}` };
      try {
        const response = await this.request("/models", { method: "GET", headers });
        const payload = (await response.json().catch(() => ({}))) as { data?: { id?: string }[] };
        const models = Array.isArray(payload.data) ? payload.data.map((item) => item.id).filter(Boolean) : [];
        const configured = this.config.defaultModel?.trim();
        if (configured && models.length && !models.includes(configured)) {
          return {
            ok: true,
            message: `Connected. The endpoint lists ${models.length} models but not "${configured}"; check the model name before use.`,
          };
        }
        return { ok: true, message: `Connected. ${models.length ? `${models.length} models available.` : "Endpoint reachable."}` };
      } catch (error) {
        // Some compatible servers do not expose /models; fall back to a minimal completion.
        if (error instanceof AIProviderError && (error.status === 404 || error.status === 405)) {
          const { model } = await this.complete("Reply with the single word OK.", "ping");
          return { ok: true, message: `Connected via chat completion${model ? ` (${model})` : ""}.` };
        }
        throw error;
      }
    });
  }

  async complete(system: string, user: string) {
    const apiKey = this.requireApiKey();
    const model = this.requireModel();
    const response = await this.request("/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    const payload = (await response.json()) as OpenAIChatResponse;
    return { text: openAIContentToText(payload.choices), model: payload.model ?? model };
  }
}

type AnthropicMessageResponse = { model?: string; content?: { type?: string; text?: string }[] };

const ANTHROPIC_VERSION = "2023-06-01";

export class AnthropicProvider extends ConnectedProvider {
  private headers(apiKey: string) {
    return { "x-api-key": apiKey, "anthropic-version": ANTHROPIC_VERSION, "content-type": "application/json" };
  }

  async testConnection(): Promise<AIConnectionResult> {
    return this.guarded(async () => {
      const apiKey = this.requireApiKey();
      await this.request("/models", { method: "GET", headers: this.headers(apiKey) });
      return { ok: true, message: "Connected to the Anthropic API." };
    });
  }

  async complete(system: string, user: string) {
    const apiKey = this.requireApiKey();
    const model = this.requireModel();
    const response = await this.request("/messages", {
      method: "POST",
      headers: this.headers(apiKey),
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        temperature: 0,
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
    return { text, model: payload.model ?? model };
  }
}

type DifyChatResponse = { answer?: string; metadata?: { usage?: unknown } };

/**
 * Dify application API (used by ZJU aihub). The API key identifies one published app;
 * the model is chosen inside the Dify app, so `defaultModel` is informational only.
 */
export class DifyProvider extends ConnectedProvider {
  async testConnection(): Promise<AIConnectionResult> {
    return this.guarded(async () => {
      const apiKey = this.requireApiKey();
      const response = await this.request("/parameters", { method: "GET", headers: { authorization: `Bearer ${apiKey}` } });
      await response.json().catch(() => undefined);
      return { ok: true, message: "Connected to the Dify application." };
    });
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
    default: {
      const exhaustive: never = config.type;
      throw new AIProviderError(`Unsupported provider type: ${String(exhaustive)}`);
    }
  }
}
