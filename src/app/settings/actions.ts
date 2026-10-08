"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isConnectedProviderType, type AIProviderType } from "@/lib/ai";
import { encryptSecret } from "@/lib/ai-crypto";
import { prisma } from "@/lib/db";
import { formActionErrorMessage, type FormActionState } from "@/lib/form-actions";

const providerTypes = ["openai", "openai_compatible", "anthropic", "dify", "manual_copy_paste"] as const satisfies readonly AIProviderType[];

const providerSchema = z.object({
  id: z.string().trim().optional(),
  name: z.string().trim().min(1, "Provider name is required.").max(80),
  type: z.enum(providerTypes),
  baseUrl: z
    .string()
    .trim()
    .max(300)
    .refine((value) => !value || /^https?:\/\/\S+$/i.test(value), "Base URL must start with http:// or https://."),
  defaultModel: z.string().trim().max(120),
  apiKey: z.string().trim().max(2000),
  enabled: z.boolean(),
});

const capabilitiesByType: Record<AIProviderType, string[]> = {
  manual_copy_paste: ["text", "structured_output"],
  openai: ["text", "structured_output", "vision"],
  openai_compatible: ["text", "structured_output"],
  anthropic: ["text", "structured_output", "vision"],
  dify: ["text", "structured_output"],
};

function revalidateProviderSurfaces() {
  revalidatePath("/settings");
  revalidatePath("/actions/manual");
}

export async function saveAIProvider(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  try {
    const parsed = providerSchema.parse({
      id: String(formData.get("id") ?? ""),
      name: formData.get("name"),
      type: formData.get("type"),
      baseUrl: String(formData.get("baseUrl") ?? ""),
      defaultModel: String(formData.get("defaultModel") ?? ""),
      apiKey: String(formData.get("apiKey") ?? ""),
      enabled: formData.get("enabled") === "on",
    });
    const isConnected = isConnectedProviderType(parsed.type);
    if (isConnected && parsed.type !== "openai" && parsed.type !== "anthropic" && !parsed.baseUrl) {
      throw new Error("A base URL is required for this provider type.");
    }
    if (isConnected && parsed.type !== "dify" && !parsed.defaultModel) {
      throw new Error("A default model name is required for this provider type.");
    }

    const existing = parsed.id ? await prisma.aIProvider.findUnique({ where: { id: parsed.id } }) : null;
    if (parsed.id && !existing) throw new Error("This provider no longer exists.");

    let apiKeyEncrypted: string | null | undefined;
    if (!isConnected) {
      apiKeyEncrypted = null;
    } else if (parsed.apiKey) {
      apiKeyEncrypted = encryptSecret(parsed.apiKey);
    } else if (!existing?.apiKeyEncrypted) {
      throw new Error("An API key is required for a connected provider.");
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
      await prisma.aIProvider.update({ where: { id: existing.id }, data });
    } else {
      await prisma.aIProvider.create({ data });
    }
  } catch (error) {
    return { error: formActionErrorMessage(error, "The provider could not be saved.") };
  }
  revalidateProviderSurfaces();
  redirect("/settings#providers");
}

export async function deleteAIProvider(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;
  await prisma.$transaction([
    prisma.aISettings.updateMany({ where: { defaultProviderId: id }, data: { defaultProviderId: null } }),
    prisma.aIProvider.delete({ where: { id } }),
  ]);
  revalidateProviderSurfaces();
  redirect("/settings#providers");
}

export async function setAIProviderEnabled(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim();
  const enabled = formData.get("enabled") === "true";
  if (!id) return;
  await prisma.aIProvider.update({ where: { id }, data: { enabled } });
  revalidateProviderSurfaces();
  redirect("/settings#providers");
}
