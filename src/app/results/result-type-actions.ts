"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { formActionErrorMessage } from "@/lib/form-actions";
import { stableResultKey } from "@/lib/result-templates";

export type ResultTypeDefinitionItem = { id: string; label: string; description: string | null; sortOrder: number };
export type ResultTypeActionState = { error?: string; item?: ResultTypeDefinitionItem; deletedId?: string };

const manageSchema = z.discriminatedUnion("intent", [
  z.object({ intent: z.literal("create"), label: z.string().trim().min(1, "Type name is required.").max(80), description: z.string().trim().max(240).optional() }),
  z.object({ intent: z.literal("edit"), id: z.string().min(1), label: z.string().trim().min(1, "Type name is required.").max(80), description: z.string().trim().max(240).optional() }),
  z.object({ intent: z.literal("delete"), id: z.string().min(1) }),
]);

function optionalText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || undefined;
}

export async function manageResultTypeDefinition(formData: FormData): Promise<ResultTypeActionState> {
  try {
    const intent = String(formData.get("intent") ?? "");
    const parsed = manageSchema.parse({
      intent,
      id: optionalText(formData.get("id")),
      label: optionalText(formData.get("label")),
      description: optionalText(formData.get("description")),
    });

    if (parsed.intent === "delete") {
      const current = await prisma.resultTypeDefinition.findUnique({ where: { id: parsed.id } });
      if (!current) throw new Error("This Result type no longer exists.");
      await prisma.$transaction([
        prisma.resultTypeDefinition.delete({ where: { id: parsed.id } }),
        prisma.activityLog.create({ data: { action: "delete", targetType: "result_type_definition", targetId: parsed.id, metadataJson: { label: current.label } } }),
      ]);
      revalidatePath("/results/new");
      revalidatePath("/settings");
      return { deletedId: parsed.id };
    }

    const duplicate = await prisma.resultTypeDefinition.findFirst({
      where: { label: { equals: parsed.label, mode: "insensitive" }, ...(parsed.intent === "edit" ? { id: { not: parsed.id } } : {}) },
      select: { id: true },
    });
    if (duplicate) throw new Error("A Result type with this name already exists.");

    const saved = parsed.intent === "create"
      ? await prisma.$transaction(async (tx) => {
          const baseKey = stableResultKey(parsed.label, "result_type");
          const keyExists = await tx.resultTypeDefinition.findUnique({ where: { key: baseKey }, select: { id: true } });
          const created = await tx.resultTypeDefinition.create({ data: { key: keyExists ? `${baseKey}_${randomUUID().slice(0, 8)}` : baseKey, label: parsed.label, description: parsed.description } });
          await tx.activityLog.create({ data: { action: "create", targetType: "result_type_definition", targetId: created.id, metadataJson: { label: created.label } } });
          return created;
        })
      : await prisma.$transaction(async (tx) => {
          const current = await tx.resultTypeDefinition.findUnique({ where: { id: parsed.id } });
          if (!current) throw new Error("This Result type no longer exists.");
          const updated = await tx.resultTypeDefinition.update({ where: { id: parsed.id }, data: { label: parsed.label, description: parsed.description } });
          await tx.activityLog.create({ data: { action: "update", targetType: "result_type_definition", targetId: updated.id, metadataJson: { previousLabel: current.label, label: updated.label } } });
          return updated;
        });

    revalidatePath("/results/new");
    revalidatePath("/settings");
    return { item: { id: saved.id, label: saved.label, description: saved.description, sortOrder: saved.sortOrder } };
  } catch (error) {
    return { error: formActionErrorMessage(error, "The Result type could not be changed.") };
  }
}
