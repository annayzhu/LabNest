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
