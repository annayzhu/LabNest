"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { formActionErrorMessage, type FormActionState } from "@/lib/form-actions";
import { keyedSampleFields, samplePrefix, sampleTypeKeyBase, sampleUnit } from "@/lib/samples";

const text = (value: FormDataEntryValue | null) => String(value ?? "").trim() || undefined;

function revalidateTypes() {
  for (const path of ["/samples", "/samples/types", "/samples/new"]) revalidatePath(path);
}

const typeSchema = z.object({
  id: z.string().trim().optional(),
  label: z.string().trim().min(1, "Type name is required.").max(60),
  prefix: z.string().trim().max(12).optional(),
  amountUnit: z.string().trim().max(32),
  concentrationUnit: z.string().trim().max(32),
});

/** Sample types (S6) live in the same type table as inventory's, as objectKind "sample" outside every 大类. */
export async function saveSampleType(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  try {
    const parsed = typeSchema.parse({
      id: text(formData.get("id")), label: formData.get("label"), prefix: text(formData.get("prefix")),
      amountUnit: formData.get("amountUnit") ?? "", concentrationUnit: formData.get("concentrationUnit") ?? "",
    });
    const fields = keyedSampleFields(JSON.parse(String(formData.get("fields") || "[]")));
    const prefix = samplePrefix(parsed.prefix ?? parsed.label);
    const sample = { amountUnit: sampleUnit(parsed.amountUnit), concentrationUnit: sampleUnit(parsed.concentrationUnit) };
    await prisma.$transaction(async (tx) => {
      const duplicate = await tx.scientificSchemaDefinition.findFirst({ where: { objectKind: "sample", label: { equals: parsed.label, mode: "insensitive" }, ...(parsed.id ? { id: { not: parsed.id } } : {}) }, select: { id: true } });
      if (duplicate) throw new Error(`A sample type named “${parsed.label}” already exists.`);
      if (parsed.id) {
        const current = await tx.scientificSchemaDefinition.findUnique({ where: { id: parsed.id } });
        if (current?.objectKind !== "sample") throw new Error("This sample type no longer exists.");
        const settings = (current.defaultSettings && typeof current.defaultSettings === "object" ? current.defaultSettings : {}) as Record<string, unknown>;
        await tx.scientificSchemaDefinition.update({ where: { id: parsed.id }, data: { label: parsed.label, prefix, fieldDefinitions: fields, defaultSettings: { ...settings, sample } } });
        await tx.activityLog.create({ data: { action: "update", targetType: "sample_type", targetId: parsed.id, metadataJson: { label: parsed.label, prefix, fields: fields.length } } });
        return;
      }
      const base = sampleTypeKeyBase(parsed.label);
      let key = base;
      for (let suffix = 2; await tx.scientificSchemaDefinition.findUnique({ where: { key }, select: { id: true } }); suffix += 1) key = `${base}_${suffix}`;
      const created = await tx.scientificSchemaDefinition.create({ data: { key, label: parsed.label, objectKind: "sample", prefix, fieldDefinitions: fields, defaultSettings: { sample } } });
      await tx.activityLog.create({ data: { action: "create", targetType: "sample_type", targetId: created.id, metadataJson: { label: parsed.label, prefix } } });
    });
    revalidateTypes();
    return { success: "Saved." };
  } catch (error) {
    return { error: formActionErrorMessage(error, "The sample type could not be saved.") };
  }
}

/** A disabled type is no longer offered for new samples; samples that have it keep it. */
export async function setSampleTypeEnabled(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  try {
    const id = z.string().min(1).parse(formData.get("id"));
    const enabled = formData.get("enabled") === "true";
    const type = await prisma.scientificSchemaDefinition.findUnique({ where: { id }, select: { objectKind: true, label: true } });
    if (type?.objectKind !== "sample") throw new Error("This sample type no longer exists.");
    await prisma.$transaction([
      prisma.scientificSchemaDefinition.update({ where: { id }, data: { enabled } }),
      prisma.activityLog.create({ data: { action: enabled ? "enable" : "disable", targetType: "sample_type", targetId: id, metadataJson: { label: type.label } } }),
    ]);
    revalidateTypes();
    return { success: enabled ? "Offered for new samples again." : "No longer offered for new samples." };
  } catch (error) {
    return { error: formActionErrorMessage(error, "The sample type could not be changed.") };
  }
}

export async function deleteSampleType(_previous: FormActionState, formData: FormData): Promise<FormActionState> {
  try {
    const id = z.string().min(1).parse(formData.get("id"));
    await prisma.$transaction(async (tx) => {
      const type = await tx.scientificSchemaDefinition.findUnique({ where: { id }, include: { _count: { select: { samples: true } } } });
      if (type?.objectKind !== "sample") throw new Error("This sample type no longer exists.");
      if (type._count.samples) throw new Error(`${type._count.samples} sample${type._count.samples === 1 ? " has" : "s have"} this type, so it cannot be deleted. Turn it off instead.`);
      await tx.scientificSchemaDefinition.delete({ where: { id } });
      await tx.activityLog.create({ data: { action: "delete", targetType: "sample_type", targetId: id, metadataJson: { label: type.label } } });
    });
    revalidateTypes();
    return { success: "Deleted." };
  } catch (error) {
    return { error: formActionErrorMessage(error, "The sample type could not be deleted.") };
  }
}
