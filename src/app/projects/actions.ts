"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ProjectStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { formActionErrorMessage, type FormActionState } from "@/lib/form-actions";
import { normalizeKeyInformation, type KeyInformationFormState } from "@/lib/key-information";
import { projectDeleteBlockers } from "@/lib/record-lifecycle";
import { captureDeletedRecord } from "@/lib/recycle-bin";
import { parseTags } from "@/lib/tags";

const projectSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Project name is required.").max(180),
  description: z.string().trim().max(10000).optional(),
  status: z.enum(ProjectStatus),
  tags: z.array(z.string().trim().min(1).max(48)),
});

const lifecycleSchema = z.object({
  id: z.string().min(1, "Project ID is required."),
  confirmation: z.string().trim().optional(),
});

function optionalText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || undefined;
}

function parseProject(formData: FormData) {
  return projectSchema.parse({
    id: optionalText(formData.get("id")),
    name: formData.get("name"),
    description: optionalText(formData.get("description")),
    status: formData.get("status") ?? "active",
    tags: parseTags(formData.get("tags")),
  });
}

export async function createProject(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  let projectId: string;
  try {
    const parsed = parseProject(formData);
    const duplicate = await prisma.project.findFirst({ where: { name: { equals: parsed.name, mode: "insensitive" } }, select: { id: true } });
    if (duplicate) throw new Error("A Project with this name already exists.");
    const project = await prisma.project.create({ data: { name: parsed.name, description: parsed.description, status: parsed.status, tags: parsed.tags } });
    await prisma.activityLog.create({ data: { action: "create", targetType: "project", targetId: project.id, metadataJson: {} } });
    projectId = project.id;
  } catch (error) {
    return { error: formActionErrorMessage(error, "The Project could not be created.") };
  }
  revalidatePath("/projects");
  redirect(`/projects/${projectId}`);
}

export async function updateProject(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  let projectId: string;
  try {
    const parsed = parseProject(formData);
    if (!parsed.id) throw new Error("Project ID is required.");
    const duplicate = await prisma.project.findFirst({ where: { id: { not: parsed.id }, name: { equals: parsed.name, mode: "insensitive" } }, select: { id: true } });
    if (duplicate) throw new Error("Another Project already uses this name.");
    await prisma.$transaction([
      prisma.project.update({ where: { id: parsed.id }, data: { name: parsed.name, description: parsed.description, status: parsed.status, tags: parsed.tags } }),
      prisma.activityLog.create({ data: { action: "update", targetType: "project", targetId: parsed.id, metadataJson: { status: parsed.status } } }),
    ]);
    projectId = parsed.id;
  } catch (error) {
    return { error: formActionErrorMessage(error, "The Project could not be saved.") };
  }
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}`);
}

export async function updateProjectKeyInformation(
  _previousState: KeyInformationFormState,
  formData: FormData,
): Promise<KeyInformationFormState> {
  let projectId: string;
  try {
    projectId = z.string().min(1, "Project ID is required.").parse(formData.get("id"));
    const keyInformation = normalizeKeyInformation(formData.get("keyInformation"));
    await prisma.$transaction(async (tx) => {
      const project = await tx.project.findUnique({ where: { id: projectId }, select: { id: true, name: true, keyInformation: true } });
      if (!project) throw new Error("This Project no longer exists.");
      await tx.project.update({ where: { id: project.id }, data: { keyInformation } });
      await tx.activityLog.create({
        data: {
          action: "update_key_information",
          targetType: "project",
          targetId: project.id,
          metadataJson: { name: project.name, previousKeyInformation: project.keyInformation, keyInformation },
        },
      });
    });
  } catch (error) {
    return { error: formActionErrorMessage(error, "Project key information could not be saved.") };
  }
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/search");
  return { saved: true };
}

export async function archiveProject(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  let projectId: string;
  try {
    const parsed = lifecycleSchema.parse({ id: formData.get("id") });
    const project = await prisma.project.findUnique({ where: { id: parsed.id }, select: { id: true, name: true, status: true } });
    if (!project) throw new Error("This Project no longer exists.");
    await prisma.$transaction([
      prisma.project.update({ where: { id: project.id }, data: { status: "archived" } }),
      prisma.activityLog.create({ data: { action: "archive", targetType: "project", targetId: project.id, metadataJson: { name: project.name, previousStatus: project.status } } }),
    ]);
    projectId = project.id;
  } catch (error) {
    return { error: formActionErrorMessage(error, "The Project could not be archived.") };
  }
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}`);
}

export async function deleteProject(
  _previousState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  try {
    const parsed = lifecycleSchema.parse({ id: formData.get("id"), confirmation: formData.get("confirmation") });
    await prisma.$transaction(async (tx) => {
      const project = await tx.project.findUnique({
        where: { id: parsed.id },
        select: {
          id: true,
          name: true,
          status: true,
          _count: { select: { researchPlans: true, protocols: true, experiments: true, results: true, reports: true, entries: true, entities: true, procurementInquiries: true } },
        },
      });
      if (!project) throw new Error("This Project no longer exists.");
      if (parsed.confirmation !== project.name) throw new Error(`Enter ${project.name} exactly to confirm moving it to the Recycle Bin.`);
      const genericReferences = await tx.itemLink.count({
        where: { OR: [{ sourceType: "project", sourceId: project.id }, { targetType: "project", targetId: project.id }] },
      });
      const counts = { ...project._count, genericReferences };
      const blockers = projectDeleteBlockers(counts);
      if (blockers.length) throw new Error("This Project contains linked records and can only be archived.");

      const recycled = await captureDeletedRecord(tx, "project", project.id);
      await tx.attachmentLink.deleteMany({ where: { targetType: "project", targetId: project.id } });
      await tx.itemLink.deleteMany({ where: { OR: [{ sourceType: "project", sourceId: project.id }, { targetType: "project", targetId: project.id }] } });
      await tx.activityLog.create({ data: { action: "delete", targetType: "project", targetId: project.id, metadataJson: { recycleBinId: recycled.id, name: project.name, status: project.status, dependencyCounts: counts } } });
      await tx.project.delete({ where: { id: project.id } });
    });
  } catch (error) {
    return { error: formActionErrorMessage(error, "The Project could not be moved to the recycle bin.") };
  }
  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath("/search");
  redirect("/projects");
}
