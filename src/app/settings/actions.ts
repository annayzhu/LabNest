"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { aiProviderInputSchema, sameProviderTarget } from "@/lib/ai-provider-input";
import { isConnectedProviderType, type AIProviderType } from "@/lib/ai";
import { encryptSecret } from "@/lib/ai-crypto";
import { prisma } from "@/lib/db";
import { formActionErrorMessage, type FormActionState } from "@/lib/form-actions";

const capabilitiesByType: Record<AIProviderType, string[]> = {
  manual_copy_paste: ["text", "structured_output"],
  openai: ["text", "structured_output", "vision"],
  openai_compatible: ["text", "structured_output"],
  anthropic: ["text", "structured_output", "vision"],
  dify: ["text", "structured_output"],
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

export async function setAIProviderEnabled(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const enabled = formData.get("enabled") === "true";
  if (!id) return;
  await prisma.aIProvider.update({ where: { id }, data: { enabled } });
  revalidateProviderSurfaces();
  redirect("/ai?saved=provider#providers");
}
