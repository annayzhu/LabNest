"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ResearchPlanFormState } from "@/components/ResearchPlanForm";
import { prisma } from "@/lib/db";
import { recordCodeFromSuffix } from "@/lib/record-codes";
import { researchPlanDeleteBlockers } from "@/lib/research-plan-deletion";
import { documentPlainText, parseScientificDocumentJson, researchPlanSections } from "@/lib/scientific-document";
import { normalizeKeyInformation, type KeyInformationFormState } from "@/lib/key-information";
import { parseTags } from "@/lib/tags";
import { captureDeletedRecord } from "@/lib/recycle-bin";

const researchPlanSchema = z.object({
  id: z.string().optional(),
  projectId: z.string().min(1, "Project is required."),
  title: z.string().trim().min(1, "Title is required.").max(180),
  objective: z.string().trim().max(5000).optional(),
  hypothesis: z.string().trim().max(5000).optional(),
  rationale: z.string().trim().max(5000).optional(),
  status: z.enum(["draft", "active", "paused", "completed", "archived"]),
});

const deleteResearchPlanSchema = z.object({
  id: z.string().min(1, "Research Plan ID is required."),
  confirmation: z.string().trim().min(1, "Enter the Research Plan code to confirm deletion."),
});

export type ResearchPlanDeleteState = { error?: string };

function optionalText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || undefined;
}

function planData(formData: FormData) {
  const parsed = researchPlanSchema.parse({
    id: optionalText(formData.get("id")),
    projectId: formData.get("projectId"),
    title: formData.get("title"),
    objective: optionalText(formData.get("objective")),
    hypothesis: optionalText(formData.get("hypothesis")),
    rationale: optionalText(formData.get("rationale")),
    status: formData.get("status"),
  });
  const protocolIds = Array.from(new Set(formData.getAll("protocolIds").map(String).filter(Boolean)));
  const primaryProtocolId = optionalText(formData.get("primaryProtocolId"));
  if (primaryProtocolId && !protocolIds.includes(primaryProtocolId)) protocolIds.push(primaryProtocolId);
  const contentJson = parseScientificDocumentJson(formData.get("contentJson"), researchPlanSections);
  const designSection = contentJson.sections.find((section) => section.key === "design");
  const design = designSection
    ? optionalText(documentPlainText({ schemaVersion: 1, sections: [designSection] }))
    : undefined;
  return {
    parsed,
    design,
    protocolIds,
    primaryProtocolId,
    tags: parseTags(formData.get("tags")),
    contentJson,
  };
}

function saveErrorMessage(error: unknown, fallback: string) {
  if (error instanceof z.ZodError) {
    const message = error.issues.find((issue) => issue.message.trim())?.message.trim();
    return message || fallback;
  }
  if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
    return "This Research Plan code is already in use. Enter a different suffix.";
  }
  const message = error instanceof Error ? error.message.trim() : "";
  return message || fallback;
}

export async function createResearchPlan(
  _previousState: ResearchPlanFormState,
  formData: FormData,
): Promise<ResearchPlanFormState> {
  let planId: string;
  try {
    const { parsed, design, protocolIds, primaryProtocolId, tags, contentJson } = planData(formData);
    const code = recordCodeFromSuffix("researchPlan", String(formData.get("codeSuffix") ?? ""));
    const plan = await prisma.$transaction(async (tx) => {
      const duplicate = await tx.researchPlan.findUnique({ where: { code }, select: { id: true } });
      if (duplicate) throw new Error(`${code} is already in use. Enter a different suffix.`);
      const created = await tx.researchPlan.create({
        data: {
          projectId: parsed.projectId,
          code,
          title: parsed.title,
          objective: parsed.objective,
          hypothesis: parsed.hypothesis,
          rationale: parsed.rationale,
          design: design ?? null,
          status: parsed.status,
          tags,
          contentJson,
          protocols: {
            create: protocolIds.map((protocolId) => ({ protocolId, isPrimary: protocolId === primaryProtocolId })),
          },
        },
      });
      await tx.activityLog.create({ data: { action: "create", targetType: "research_plan", targetId: created.id, metadataJson: { code, protocolIds } } });
      return created;
    });
    planId = plan.id;
  } catch (error) {
    return { error: saveErrorMessage(error, "The Research Plan could not be created.") };
  }
  revalidatePath("/research-plans");
  redirect(`/research-plans/${planId}`);
}

export async function updateResearchPlan(
  _previousState: ResearchPlanFormState,
  formData: FormData,
): Promise<ResearchPlanFormState> {
  let planId: string;
  try {
    const { parsed, design, protocolIds, primaryProtocolId, tags, contentJson } = planData(formData);
    if (!parsed.id) throw new Error("Research Plan ID is required.");
    planId = parsed.id;
    await prisma.$transaction(async (tx) => {
      await tx.researchPlan.update({
        where: { id: planId },
        data: {
          projectId: parsed.projectId,
          title: parsed.title,
          objective: parsed.objective,
          hypothesis: parsed.hypothesis,
          rationale: parsed.rationale,
          design: design ?? null,
          status: parsed.status,
          tags,
          contentJson,
        },
      });
      await tx.researchPlanProtocol.deleteMany({ where: { researchPlanId: planId } });
      if (protocolIds.length) {
        await tx.researchPlanProtocol.createMany({ data: protocolIds.map((protocolId) => ({ researchPlanId: planId, protocolId, isPrimary: protocolId === primaryProtocolId })) });
      }
      await tx.activityLog.create({ data: { action: "update", targetType: "research_plan", targetId: planId, metadataJson: { protocolIds } } });
    });
  } catch (error) {
    return { error: saveErrorMessage(error, "The Research Plan could not be saved.") };
  }
  revalidatePath("/research-plans");
  revalidatePath(`/research-plans/${planId}`);
  redirect(`/research-plans/${planId}`);
}

export async function updateResearchPlanKeyInformation(
  _previousState: KeyInformationFormState,
  formData: FormData,
): Promise<KeyInformationFormState> {
  let planId: string;
  let projectId: string;
  try {
    planId = z.string().min(1, "Research Plan ID is required.").parse(formData.get("id"));
    const keyInformation = normalizeKeyInformation(formData.get("keyInformation"));
    const plan = await prisma.$transaction(async (tx) => {
      const current = await tx.researchPlan.findUnique({ where: { id: planId }, select: { id: true, code: true, projectId: true, keyInformation: true } });
      if (!current) throw new Error("This Research Plan no longer exists.");
      await tx.researchPlan.update({ where: { id: current.id }, data: { keyInformation } });
      await tx.activityLog.create({
        data: {
          action: "update_key_information",
          targetType: "research_plan",
          targetId: current.id,
          metadataJson: { code: current.code, projectId: current.projectId, previousKeyInformation: current.keyInformation, keyInformation },
        },
      });
      return current;
    });
    projectId = plan.projectId;
  } catch (error) {
    return { error: saveErrorMessage(error, "Research Plan key information could not be saved.") };
  }
  revalidatePath("/research-plans");
  revalidatePath(`/research-plans/${planId}`);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/search");
  return { saved: true };
}

export async function deleteResearchPlan(
  _previousState: ResearchPlanDeleteState,
  formData: FormData,
): Promise<ResearchPlanDeleteState> {
  let projectId: string;
  try {
    const parsed = deleteResearchPlanSchema.parse({
      id: formData.get("id"),
      confirmation: formData.get("confirmation"),
    });

    projectId = await prisma.$transaction(async (tx) => {
      const plan = await tx.researchPlan.findUnique({
        where: { id: parsed.id },
        select: {
          id: true,
          projectId: true,
          code: true,
          title: true,
          status: true,
          protocols: { select: { protocolId: true, isPrimary: true } },
          _count: { select: { entries: true, experiments: true, results: true, reports: true } },
        },
      });
      if (!plan) throw new Error("This Research Plan no longer exists.");
      if (parsed.confirmation !== plan.code) throw new Error(`Enter ${plan.code} exactly to confirm moving it to the Recycle Bin.`);

      const reportSourceReferences = await tx.reportSource.count({
        where: { sourceType: "research_plan", sourceId: plan.id },
      });
      const counts = { ...plan._count, reportSourceReferences };
      const blockers = researchPlanDeleteBlockers(plan.status, counts);
      if (blockers.length) throw new Error(`This Research Plan cannot be moved to the Recycle Bin: ${blockers.join("; ")}. Archive it instead.`);

      const recycled = await captureDeletedRecord(tx, "research_plan", plan.id);
      await tx.attachmentLink.deleteMany({ where: { targetType: "research_plan", targetId: plan.id } });
      await tx.itemLink.deleteMany({
        where: {
          OR: [
            { sourceType: "research_plan", sourceId: plan.id },
            { targetType: "research_plan", targetId: plan.id },
          ],
        },
      });
      await tx.activityLog.create({
        data: {
          action: "delete",
          targetType: "research_plan",
          targetId: plan.id,
          metadataJson: {
            code: plan.code,
            recycleBinId: recycled.id,
            title: plan.title,
            projectId: plan.projectId,
            status: plan.status,
            dependencyCounts: counts,
            protocolLinks: plan.protocols,
          },
        },
      });
      await tx.researchPlan.delete({ where: { id: plan.id } });
      return plan.projectId;
    });
  } catch (error) {
    return { error: saveErrorMessage(error, "The Research Plan could not be moved to the recycle bin.") };
  }

  revalidatePath("/");
  revalidatePath("/research-plans");
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/search");
  redirect("/research-plans");
}

export async function archiveResearchPlan(
  _previousState: ResearchPlanDeleteState,
  formData: FormData,
): Promise<ResearchPlanDeleteState> {
  let planId: string;
  try {
    const id = z.string().min(1, "Research Plan ID is required.").parse(formData.get("id"));
    const plan = await prisma.researchPlan.findUnique({ where: { id }, select: { id: true, code: true, title: true, status: true, projectId: true } });
    if (!plan) throw new Error("This Research Plan no longer exists.");
    await prisma.$transaction([
      prisma.researchPlan.update({ where: { id: plan.id }, data: { status: "archived" } }),
      prisma.activityLog.create({ data: { action: "archive", targetType: "research_plan", targetId: plan.id, metadataJson: { code: plan.code, title: plan.title, projectId: plan.projectId, previousStatus: plan.status } } }),
    ]);
    planId = plan.id;
  } catch (error) {
    return { error: saveErrorMessage(error, "The Research Plan could not be archived.") };
  }
  revalidatePath("/research-plans");
  revalidatePath(`/research-plans/${planId}`);
  revalidatePath("/projects");
  redirect(`/research-plans/${planId}`);
}
