import type { AIProviderType } from "./ai";

/** Official preset verified on 2026-10-10: https://api-docs.deepseek.com/.
 * Uses the existing compatible adapter and encrypted provider storage (no schema migration).
 * Model names remain editable as account availability changes.
 */
export const deepseekProviderPreset = {
  name: "DeepSeek",
  type: "openai_compatible" as AIProviderType,
  baseUrl: "https://api.deepseek.com",
  defaultModel: "deepseek-flash",
};

/** Also offered through an OpenAI-compatible interface. Addresses are the services' documented compatible endpoints; model names stay editable. */
export const qwenProviderPreset = {
  name: "通义千问",
  type: "openai_compatible" as AIProviderType,
  baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  defaultModel: "qwen-plus",
};

export const geminiProviderPreset = {
  name: "Gemini",
  type: "openai_compatible" as AIProviderType,
  baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
  defaultModel: "gemini-2.5-flash",
};

/**
 * The presets the form offers. `note` says what to change for the other abilities: reading pictures needs a model that
 * can see, so a service for photos is a separate entry with the vision model's name.
 */
export const providerPresets = [
  { label: "DeepSeek", preset: deepseekProviderPreset, note: "Fills in the official address and deepseek-flash; for V4 Pro, change the model ID to deepseek-v4-pro. DeepSeek cannot read pictures." },
  { label: "通义千问", preset: qwenProviderPreset, note: "Fills in the compatible-mode address and qwen-plus. To read photos, add another service with the model qwen-vl-max." },
  { label: "Gemini", preset: geminiProviderPreset, note: "Fills in the compatible address and gemini-2.5-flash, which can also read pictures." },
] as const;
