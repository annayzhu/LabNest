"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { recordCodeFromSuffix } from "@/lib/record-codes";
import { documentPlainText, parseScientificDocumentJson, researchPlanSections } from "@/lib/scientific-document";
import { parseTags } from "@/lib/tags";

const researchPlanSchema = z.object({
  id: z.string().optional(),
  projectId: z.string().min(1, "Project is required."),
  title: z.string().trim().min(1, "Title is required.").max(180),
  objective: z.string().trim().max(5000).optional(),
  hypothesis: z.string().trim().max(5000).optional(),
  rationale: z.string().trim().max(5000).optional(),
  status: z.enum(["draft", "active", "paused", "completed", "archived"]),
});

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

export async function createResearchPlan(formData: FormData) {
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
  revalidatePath("/research-plans");
  redirect(`/research-plans/${plan.id}`);
}

export async function updateResearchPlan(formData: FormData) {
  const { parsed, design, protocolIds, primaryProtocolId, tags, contentJson } = planData(formData);
  if (!parsed.id) throw new Error("Research Plan ID is required.");
  const planId = parsed.id;
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
  revalidatePath("/research-plans");
  revalidatePath(`/research-plans/${planId}`);
  redirect(`/research-plans/${planId}`);
}
