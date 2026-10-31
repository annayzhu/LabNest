"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { aiProviderInputSchema, sameProviderTarget } from "@/lib/ai-provider-input";
import { isConnectedProviderType, type AIProviderType } from "@/lib/ai";
import { encryptSecret } from "@/lib/ai-crypto";
import { chatGPTAccessToken, keptChoice, listChatGPTModels, revokeChatGPTSignIn, type ChatGPTEffort, type ChatGPTModel } from "@/lib/chatgpt-auth";
import { prisma } from "@/lib/db";
import { formActionErrorMessage, type FormActionState } from "@/lib/form-actions";

const capabilitiesByType: Record<AIProviderType, string[]> = {
  manual_copy_paste: ["text", "structured_output"],
  openai: ["text", "structured_output", "vision"],
  openai_compatible: ["text", "structured_output"],
  anthropic: ["text", "structured_output", "vision"],
  dify: ["text", "structured_output"],
  chatgpt_subscription: ["text", "structured_output", "vision"],
};

function revalidateProviderSurfaces() {
  revalidatePath("/settings");
  revalidatePath("/ai");
  revalidatePath("/actions/manual");
}

export async function saveAIProvider(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  try {
    const parsed = aiProviderInputSchema.parse({
      revision: String(formData.get("revision") ?? ""),
      id: String(formData.get("id") ?? ""),
      name: formData.get("name"),
      type: formData.get("type"),
      baseUrl: String(formData.get("baseUrl") ?? ""),
      defaultModel: String(formData.get("defaultModel") ?? ""),
      apiKey: String(formData.get("apiKey") ?? ""),
      enabled: formData.get("enabled") === "on",
    });
    const isConnected = isConnectedProviderType(parsed.type);
    const existing = parsed.id ? await prisma.aIProvider.findUnique({ where: { id: parsed.id } }) : null;
    if (parsed.id && !existing) throw new Error("该服务已不存在，请重新读取。");
    if (existing?.type === "chatgpt_subscription") throw new Error("ChatGPT 订阅服务通过“用 ChatGPT 订阅登录”设置，不能在此表单修改。");
    if (existing && parsed.revision && parsed.revision !== existing.updatedAt.toISOString()) throw new Error("服务已在其他页面修改，请重新读取后保存。");
    if (existing && isConnected && !parsed.apiKey && !sameProviderTarget(parsed, existing)) throw new Error("接口类型或基础地址已改变，请填写适用于新目标的 API 密钥。");

    let apiKeyEncrypted: string | null | undefined;
    if (!isConnected) {
      apiKeyEncrypted = null;
    } else if (parsed.apiKey) {
      apiKeyEncrypted = encryptSecret(parsed.apiKey);
    } else if (!existing?.apiKeyEncrypted) {
      throw new Error("请填写 API 密钥。");
    }

    const data = {
      name: parsed.name,
      type: parsed.type,
      baseUrl: parsed.baseUrl || null,
      defaultModel: parsed.defaultModel || null,
      enabled: parsed.enabled,
      capabilitiesJson: capabilitiesByType[parsed.type],
      ...(apiKeyEncrypted !== undefined ? { apiKeyEncrypted } : {}),
    };

    if (existing) {
      const updated = await prisma.aIProvider.updateMany({ where: { id: existing.id, updatedAt: existing.updatedAt }, data });
      if (updated.count !== 1) throw new Error("服务配置在保存期间改变，请重新读取后重试。");
    } else {
      await prisma.aIProvider.create({ data });
    }
  } catch (error) {
    return { error: formActionErrorMessage(error, "服务配置保存失败，请重试。") };
  }
  revalidateProviderSurfaces();
  redirect("/ai?saved=provider#providers");
}

export async function deleteAIProvider(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;
  await prisma.$transaction([
    prisma.aISettings.updateMany({ where: { defaultProviderId: id }, data: { defaultProviderId: null } }),
    prisma.aIProvider.delete({ where: { id } }),
  ]);
  revalidateProviderSurfaces();
  redirect("/ai?saved=provider#providers");
}

/**
 * Chooses a ChatGPT subscription service's model, among those its account listed, and its reasoning effort, among those
 * that model takes (empty: the model's default).
 */
export async function setChatGPTModel(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const model = String(formData.get("model") ?? "").trim();
  const effort = String(formData.get("effort") ?? "").trim();
  const provider = id ? await prisma.aIProvider.findUnique({ where: { id }, include: { session: { select: { modelsJson: true } } } }) : null;
  const listed = (Array.isArray(provider?.session?.modelsJson) ? provider.session.modelsJson as ChatGPTModel[] : []).find(entry => entry?.slug === model);
  if (!provider || provider.type !== "chatgpt_subscription" || !listed || (effort && !listed.efforts?.includes(effort as ChatGPTEffort))) redirect("/ai?chatgpt=failed#providers");
  await prisma.aIProvider.update({ where: { id }, data: { defaultModel: model, reasoningEffort: effort || null } });
  revalidateProviderSurfaces();
  redirect("/ai?saved=provider#providers");
}

/** Lists a ChatGPT subscription service's models again (new models, their efforts), keeping the choice it still has. */
export async function refreshChatGPTModels(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const provider = id ? await prisma.aIProvider.findUnique({ where: { id } }) : null;
  if (!provider || provider.type !== "chatgpt_subscription") redirect("/ai?chatgpt=failed#providers");
  let models: ChatGPTModel[];
  try { models = await listChatGPTModels(await chatGPTAccessToken(id)); }
  catch { redirect("/ai?chatgpt=models-unavailable#providers"); }
  await prisma.$transaction([
    prisma.aIProviderSession.update({ where: { providerId: id }, data: { modelsJson: models } }),
    prisma.aIProvider.update({ where: { id }, data: keptChoice(models, provider.defaultModel, provider.reasoningEffort) }),
  ]);
  revalidateProviderSurfaces();
  redirect("/ai?chatgpt=models-updated#providers");
}

/** Signs out of ChatGPT: revokes the sign-in at OpenAI, then removes the service here whether or not OpenAI confirmed. */
export async function signOutOfChatGPT(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const provider = id ? await prisma.aIProvider.findUnique({ where: { id } }) : null;
  if (!provider || provider.type !== "chatgpt_subscription") redirect("/ai?chatgpt=failed#providers");
  const revoked = await revokeChatGPTSignIn(id);
  await prisma.$transaction([
    prisma.aISettings.updateMany({ where: { defaultProviderId: id }, data: { defaultProviderId: null } }),
    prisma.aIProvider.delete({ where: { id } }),
  ]);
  revalidateProviderSurfaces();
  redirect(`/ai?chatgpt=${revoked ? "signed-out" : "signed-out-unconfirmed"}#providers`);
}

export async function setAIProviderEnabled(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const enabled = formData.get("enabled") === "true";
  if (!id) return;
  await prisma.aIProvider.update({ where: { id }, data: { enabled } });
  revalidateProviderSurfaces();
  redirect("/ai?saved=provider#providers");
}
