import { proposedActionSchema } from "./validation";
import type { ProposedAction } from "./types";

export type AIProviderCapability = "text" | "structured_output" | "vision" | "embeddings" | "local";

export type AIProviderConfig = {
  id: string;
  name: string;
  type: "openai" | "anthropic" | "openai_compatible" | "manual_copy_paste";
  baseUrl?: string;
  encryptedApiKey?: string;
  defaultModel?: string;
  capabilities: AIProviderCapability[];
  enabled: boolean;
};

export type EntryToActionPromptInput = {
  entryTitle: string;
  entryBody: string;
  allowedActionTypes: ProposedAction["actionType"][];
};

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
  testConnection(): Promise<{ ok: boolean; message: string }>;
  generateProposedActions?(input: EntryToActionPromptInput): Promise<ProposedAction[]>;
}

export class ManualCopyPasteProvider implements AIProviderAdapter {
  readonly config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  async testConnection() {
    return {
      ok: true,
      message: "Manual mode is available without API access. The app will generate prompts for copy-paste review.",
    };
  }

  createPrompt(input: EntryToActionPromptInput): string {
    return [
      "You are assisting a lab notebook user. Extract only reviewable proposed actions.",
      "Never claim that an action was executed. Never mutate inventory, experiments, entities, protocols, results, or purchases.",
      `Allowed action types: ${input.allowedActionTypes.join(", ")}`,
      "Return only a JSON array. Each item must match: {sourceType, actionType, reason, payload}.",
      "Use sourceType: \"ai\" unless a stronger source is explicitly present.",
      "Keep payload conservative and traceable. Do not invent measurements, sample IDs, stock quantities, or statistical results.",
      "",
      `Entry title: ${input.entryTitle}`,
      `Entry body: ${input.entryBody}`,
    ].join("\n");
  }

  parseResponse(rawResponse: string): ProposedAction[] {
    const parsed = JSON.parse(extractJsonPayload(rawResponse)) as unknown;
    const array = Array.isArray(parsed) ? parsed : [parsed];
    return array.map((item, index) => {
      const validated = proposedActionSchema.parse(item);
      return {
        id: `manual-ai-${index + 1}`,
        sourceType: validated.sourceType,
        sourceLabel: "Manual copy-paste AI",
        actionType: validated.actionType,
        status: "pending",
        reason: validated.reason,
        payload: validated.payload,
        createdAt: new Date().toISOString(),
      };
    });
  }
}

export function extractJsonPayload(rawResponse: string) {
  const trimmed = rawResponse.trim();
  const fencedJson = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);

  if (fencedJson?.[1]) {
    return fencedJson[1].trim();
  }

  return trimmed;
}

export class ApiProviderPlaceholder implements AIProviderAdapter {
  readonly config: AIProviderConfig;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  async testConnection() {
    if (!this.config.enabled) {
      return { ok: false, message: "Provider is disabled." };
    }
    return {
      ok: false,
      message:
        "API adapters are scaffolded for V1 but not connected to provider SDKs yet. Manual mode remains fully usable.",
    };
  }
}

export function createAIProviderAdapter(config: AIProviderConfig): AIProviderAdapter {
  if (config.type === "manual_copy_paste") {
    return new ManualCopyPasteProvider(config);
  }
  return new ApiProviderPlaceholder(config);
}
