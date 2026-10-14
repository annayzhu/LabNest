import {
  createAIProviderAdapter,
  isConnectedProviderType,
  type AIProviderAdapter,
  type AIProviderCapability,
  type AIProviderConfig,
  type AIProviderType,
} from "./ai";
import { decryptSecret, isEncryptedSecret } from "./ai-crypto";
import { createAIGate } from "./ai-gate";
import { prisma } from "./db";
import { aiProviderInputSchema, sameProviderTarget } from "./ai-provider-input";

/** Server-only helpers that turn stored provider rows into live adapters. Never import from client components. */

export type AIProviderRecord = {
  id: string;
  name: string;
  type: AIProviderType;
  baseUrl: string | null;
  apiKeyEncrypted: string | null;
  defaultModel: string | null;
  capabilitiesJson: unknown;
  enabled: boolean;
};

const capabilityNames: AIProviderCapability[] = ["text", "structured_output", "vision", "embeddings", "local"];

export function providerConfigFromRecord(record: AIProviderRecord, options: { withSecret?: boolean } = {}): AIProviderConfig {
  const capabilities = Array.isArray(record.capabilitiesJson)
    ? record.capabilitiesJson.filter((value): value is AIProviderCapability => capabilityNames.includes(value as AIProviderCapability))
    : [];
  const config: AIProviderConfig = {
    id: record.id,
    name: record.name,
    type: record.type,
    baseUrl: record.baseUrl ?? undefined,
    defaultModel: record.defaultModel ?? undefined,
    capabilities,
    enabled: record.enabled,
  };
  if (options.withSecret && isEncryptedSecret(record.apiKeyEncrypted)) {
    config.apiKey = decryptSecret(record.apiKeyEncrypted);
  }
  return config;
}

export type AIAvailability = {
  /** The existing workspace-wide master switch, managed on /ai. */
  enabled: boolean;
  /** Configuration completeness, not proof of a successful external request. */
  connected: boolean;
  providerId?: string;
  providerName?: string;
  providerType?: AIProviderType;
  model?: string;
  /** Human-readable explanation when `connected` is false. */
  reason?: string;
};

type AvailabilitySettings = { enabled: boolean; defaultProvider: AIProviderRecord | null } | null;
export async function getAIAvailability(): Promise<AIAvailability> {
  const settings = await prisma.aISettings.findUnique({ where: { id: "default" }, include: { defaultProvider: true } });
  return availabilityFromSettings(settings);
}
export function availabilityFromSettings(settings: AvailabilitySettings): AIAvailability {
  if (!settings?.enabled) {
    return { enabled: false, connected: false, reason: "已关闭 AI，现有记录保持不变。" };
  }
  const provider = settings.defaultProvider;
  if (!provider) {
    return { enabled: true, connected: false, reason: "请先选择默认模型服务。" };
  }
  const base = {
    enabled: true,
    providerId: provider.id,
    providerName: provider.name,
    providerType: provider.type as AIProviderType,
    model: provider.defaultModel ?? undefined,
  };
  if (!provider.enabled) {
    return { ...base, connected: false, reason: `服务“${provider.name}”已停用。` };
  }
  if (!isConnectedProviderType(provider.type)) {
    return { ...base, connected: false, reason: "当前默认服务使用手动复制粘贴，不进行联网调用。" };
  }
  if (!isEncryptedSecret(provider.apiKeyEncrypted)) {
    return { ...base, connected: false, reason: `服务“${provider.name}”尚未保存 API 密钥。` };
  }
  if ((provider.type === "openai_compatible" || provider.type === "dify") && !provider.baseUrl?.trim()) {
    return { ...base, connected: false, reason: "请填写模型服务地址。" };
  }
  if (provider.type !== "dify" && !provider.defaultModel?.trim()) {
    return { ...base, connected: false, reason: "请填写模型名称。" };
  }
  return { ...base, connected: true };
}

export type ResolvedAdapter =
  | { ok: true; adapter: AIProviderAdapter; config: AIProviderConfig; gate: ReturnType<typeof createAIGate> }
  | { ok: false; status: number; error: string; field?: string };

export async function resolveAdapterForProvider(providerId: string, expectedRevision?: string, options: { providerRevision?: string; signal?: AbortSignal } = {}): Promise<ResolvedAdapter> {
  const settings = await prisma.aISettings.findUnique({ where: { id: "default" } });
  if (!settings?.enabled || (expectedRevision && settings.updatedAt.toISOString() !== expectedRevision)) {
    return { ok: false, status: 403, error: "AI 已关闭或设置已改变，请在 AI 页面确认设置。" };
  }
  const record = await prisma.aIProvider.findUnique({ where: { id: providerId } });
  if (!record) return { ok: false, status: 404, error: "Provider not found." };
  if (!record.enabled) return { ok: false, status: 409, error: "Provider is disabled." };
  if (options.providerRevision && record.updatedAt.toISOString() !== options.providerRevision) return { ok: false, status: 409, error: "服务配置已在其他页面修改，请重新读取后测试。" };
  try {
    const config = providerConfigFromRecord({ ...record, type: record.type as AIProviderType }, { withSecret: true });
    const gate = createAIGate(settings.updatedAt.toISOString(), { id: record.id, revision: record.updatedAt.toISOString() }, options.signal);
    return { ok: true, adapter: createAIProviderAdapter(config, { fetchImpl: gate.fetch }), config, gate };
  } catch (error) {
    return { ok: false, status: 500, error: error instanceof Error ? error.message : "Could not load provider credentials." };
  }
}

/** A draft test does not persist credentials or require a default provider. */
export async function resolveDraftAdapter(input: unknown, signal?: AbortSignal): Promise<ResolvedAdapter> {
  const settings = await prisma.aISettings.findUnique({ where: { id: "default" } });
  if (!settings?.enabled) return { ok: false, status: 403, error: "请先启用 AI；保存连接配置不会自动开启 AI。" };
  const parsed = aiProviderInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, status: 400, error: parsed.error.issues[0].message, field: String(parsed.error.issues[0].path[0] ?? "") };
  const draft = parsed.data;
  if (!draft.enabled) return { ok: false, status: 409, error: "请先启用此服务。" };
  if (!isConnectedProviderType(draft.type)) return { ok: false, status: 400, error: "手动复制粘贴模式无需联网测试。" };
  const record = draft.id ? await prisma.aIProvider.findUnique({ where: { id: draft.id } }) : null;
  if (draft.id && (!record || !record.enabled || record.updatedAt.toISOString() !== draft.revision)) return { ok: false, status: 409, error: "服务已停用或配置已改变，请重新读取后测试。" };
  if (!draft.apiKey && (!record || !sameProviderTarget(draft, record))) return { ok: false, status: 400, field: "apiKey", error: "请填写适用于当前地址和接口类型的新密钥；旧密钥不会发往新目标。" };
  try {
    const apiKey = draft.apiKey || (record && isEncryptedSecret(record.apiKeyEncrypted) ? decryptSecret(record.apiKeyEncrypted) : "");
    if (!apiKey) return { ok: false, status: 400, field: "apiKey", error: "请填写 API 密钥。" };
    const config: AIProviderConfig = { ...draft, id: draft.id || "unsaved-provider", apiKey, capabilities: ["text"] };
    const gate = createAIGate(settings.updatedAt.toISOString(), record ? { id: record.id, revision: record.updatedAt.toISOString() } : undefined, signal);
    return { ok: true, adapter: createAIProviderAdapter(config, { fetchImpl: gate.fetch, timeoutMs: 30_000 }), config, gate };
  } catch { return { ok: false, status: 500, error: "无法读取连接凭据，请检查服务器加密配置。" }; }
}

/** The default provider, only when the master switch is on and the provider is a connected adapter. */
export async function resolveConnectedAdapter(): Promise<ResolvedAdapter> {
  const settings = await prisma.aISettings.findUnique({ where: { id: "default" }, include: { defaultProvider: true } });
  const availability = availabilityFromSettings(settings);
  if (!availability.enabled) return { ok: false, status: 403, error: availability.reason ?? "AI is disabled." };
  if (!availability.connected || !availability.providerId) {
    return { ok: false, status: 409, error: availability.reason ?? "No connected model provider." };
  }
  return resolveAdapterForProvider(availability.providerId, settings!.updatedAt.toISOString());
}
