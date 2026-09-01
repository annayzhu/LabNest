"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { EntityType, ObjectStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { formActionErrorMessage, type FormActionState } from "@/lib/form-actions";

export async function createEntity(_previousState: FormActionState, formData: FormData): Promise<FormActionState> {
  let type: string;
  try {
    const parsed = z.object({
      name: z.string().trim().min(1, "Entity name is required.").max(180),
      type: z.enum(EntityType),
      code: z.string().trim().max(80).optional(),
      ownershipScope: z.enum(["library", "project"]),
      projectId: z.string().trim().optional(),
      status: z.enum(ObjectStatus),
      description: z.string().trim().max(5000).optional(),
      mixtureKind: z.enum(["recipe", "preparation"]).optional(),
      schemaKey: z.string().trim().max(120).optional(),
    }).parse({
      name: formData.get("name"),
      type: formData.get("type") ?? "other",
      code: optionalText(formData.get("code")),
      ownershipScope: formData.get("ownershipScope") ?? "library",
      projectId: optionalText(formData.get("projectId")),
      status: formData.get("status") ?? "active",
      description: optionalText(formData.get("description")),
      mixtureKind: optionalText(formData.get("mixtureKind")),
      schemaKey: optionalText(formData.get("schemaKey")),
    });
    const schema = parsed.schemaKey ? await prisma.scientificSchemaDefinition.findFirst({ where: { key: parsed.schemaKey, enabled: true }, select: { key: true, entityType: true } }) : null;
    if (parsed.schemaKey && !schema) throw new Error("The selected scientific schema is no longer available.");
    const resolvedType = schema?.entityType ?? parsed.type;
    if (parsed.ownershipScope === "project" && !parsed.projectId) throw new Error("Choose a Project.");
    if (resolvedType === "mixture" && parsed.mixtureKind === "preparation" && !parsed.projectId) throw new Error("A Mixture preparation must belong to a Project.");
    if (parsed.projectId && !(await prisma.project.findUnique({ where: { id: parsed.projectId }, select: { id: true } }))) throw new Error("The selected Project no longer exists.");
    type = resolvedType;
    const entity = await prisma.entity.create({ data: {
      name: parsed.name,
      type: resolvedType,
      code: parsed.code,
      projectId: parsed.ownershipScope === "project" ? parsed.projectId : null,
      status: parsed.status,
      description: parsed.description,
      metadataJson: resolvedType === "mixture" ? { mixtureKind: parsed.mixtureKind ?? "recipe" } : { schemaManaged: true, schemaKey: schema?.key },
    } });
    await prisma.activityLog.create({ data: { action: "create", targetType: "entity", targetId: entity.id, metadataJson: { type: resolvedType, schemaKey: schema?.key, ownershipScope: parsed.ownershipScope, projectId: entity.projectId, mixtureKind: parsed.mixtureKind } } });
  } catch (error) {
    return { error: formActionErrorMessage(error, "The Entity could not be created.") };
  }
  revalidatePath("/entities");
  redirect(`/entities?type=${type}`);
}

function optionalText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || undefined;
}
