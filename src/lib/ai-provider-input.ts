import { z } from "zod";
import { isConnectedProviderType, resolveBaseUrl } from "./ai";

/** Shared by saving and draft testing; neither path may reinterpret the target. */
export const aiProviderInputSchema = z.object({
  id: z.string().trim().max(120).optional(),
  revision: z.string().max(80).optional(),
  name: z.string().trim().min(1, "请填写服务名称。").max(80),
  type: z.enum(["openai", "openai_compatible", "anthropic", "dify", "manual_copy_paste"]),
  baseUrl: z.string().trim().max(300),
  defaultModel: z.string().trim().max(120),
  apiKey: z.string().trim().max(2000),
  enabled: z.boolean(),
}).strict().superRefine((value, context) => {
  if (!isConnectedProviderType(value.type)) return;
  try { resolveBaseUrl(value.baseUrl, value.type); }
  catch { context.addIssue({ code: "custom", path: ["baseUrl"], message: "请填写有效的 API 基础地址，不要包含聊天网页、完整调用路径、凭据或查询参数。" }); }
  if (value.type !== "dify" && !value.defaultModel) context.addIssue({ code: "custom", path: ["defaultModel"], message: "请填写准确的模型 ID。" });
});

export type AIProviderInput = z.infer<typeof aiProviderInputSchema>;
export function sameProviderTarget(draft: Pick<AIProviderInput, "type" | "baseUrl">, saved: { type: string; baseUrl: string | null }): boolean {
  if (draft.type !== saved.type) return false;
  try { return resolveBaseUrl(draft.baseUrl, draft.type) === resolveBaseUrl(saved.baseUrl ?? undefined, draft.type); }
  catch { return false; }
}
