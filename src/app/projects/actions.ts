"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { parseTags } from "@/lib/tags";

const projectSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Project name is required.").max(180),
  description: z.string().trim().max(10000).optional(),
  status: z.enum(["active", "paused", "completed", "archived"]),
  tags: z.array(z.string().trim().min(1).max(48)),
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

export async function createProject(formData: FormData) {
  const parsed = parseProject(formData);
  const duplicate = await prisma.project.findFirst({ where: { name: { equals: parsed.name, mode: "insensitive" } }, select: { id: true } });
  if (duplicate) throw new Error("A Project with this name already exists.");
  const project = await prisma.project.create({ data: { name: parsed.name, description: parsed.description, status: parsed.status, tags: parsed.tags } });
  await prisma.activityLog.create({ data: { action: "create", targetType: "project", targetId: project.id, metadataJson: {} } });
  revalidatePath("/projects");
  redirect(`/projects/${project.id}`);
}

export async function updateProject(formData: FormData) {
  const parsed = parseProject(formData);
  if (!parsed.id) throw new Error("Project ID is required.");
  const duplicate = await prisma.project.findFirst({ where: { id: { not: parsed.id }, name: { equals: parsed.name, mode: "insensitive" } }, select: { id: true } });
  if (duplicate) throw new Error("Another Project already uses this name.");
  await prisma.$transaction([
    prisma.project.update({ where: { id: parsed.id }, data: { name: parsed.name, description: parsed.description, status: parsed.status, tags: parsed.tags } }),
    prisma.activityLog.create({ data: { action: "update", targetType: "project", targetId: parsed.id, metadataJson: { status: parsed.status } } }),
  ]);
  revalidatePath("/projects");
  revalidatePath(`/projects/${parsed.id}`);
  redirect(`/projects/${parsed.id}`);
}
