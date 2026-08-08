"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { parseScientificDocumentJson, researchPlanSections } from "@/lib/scientific-document";

const researchPlanSchema = z.object({
  id: z.string().optional(),
  projectId: z.string().min(1, "Project is required."),
  code: z.string().trim().max(48).optional(),
  title: z.string().trim().min(1, "Title is required.").max(180),
  objective: z.string().trim().max(5000).optional(),
  hypothesis: z.string().trim().max(5000).optional(),
  rationale: z.string().trim().max(5000).optional(),
  design: z.string().trim().max(10000).optional(),
  status: z.enum(["draft", "active", "paused", "completed", "archived"]),
});

function optionalText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || undefined;
}

function parseTags(value: FormDataEntryValue | null) {
  return String(value ?? "").split(",").map((tag) => tag.trim()).filter(Boolean);
}

function planData(formData: FormData) {
  const parsed = researchPlanSchema.parse({
    id: optionalText(formData.get("id")),
    projectId: formData.get("projectId"),
    code: optionalText(formData.get("code")),
    title: formData.get("title"),
    objective: optionalText(formData.get("objective")),
    hypothesis: optionalText(formData.get("hypothesis")),
    rationale: optionalText(formData.get("rationale")),
    design: optionalText(formData.get("design")),
    status: formData.get("status"),
  });
  const protocolIds = Array.from(new Set(formData.getAll("protocolIds").map(String).filter(Boolean)));
  const primaryProtocolId = optionalText(formData.get("primaryProtocolId"));
  if (primaryProtocolId && !protocolIds.includes(primaryProtocolId)) protocolIds.push(primaryProtocolId);
  return {
    parsed,
    protocolIds,
    primaryProtocolId,
    tags: parseTags(formData.get("tags")),
    contentJson: parseScientificDocumentJson(formData.get("contentJson"), researchPlanSections),
  };
}

export async function createResearchPlan(formData: FormData) {
  const { parsed, protocolIds, primaryProtocolId, tags, contentJson } = planData(formData);
  const plan = await prisma.researchPlan.create({
    data: {
      projectId: parsed.projectId,
      code: parsed.code,
      title: parsed.title,
      objective: parsed.objective,
      hypothesis: parsed.hypothesis,
      rationale: parsed.rationale,
      design: parsed.design,
      status: parsed.status,
      tags,
      contentJson,
      protocols: {
        create: protocolIds.map((protocolId) => ({ protocolId, isPrimary: protocolId === primaryProtocolId })),
      },
    },
  });
  await prisma.activityLog.create({ data: { action: "create", targetType: "research_plan", targetId: plan.id, metadataJson: { protocolIds } } });
  revalidatePath("/research-plans");
  redirect(`/research-plans/${plan.id}`);
}

export async function updateResearchPlan(formData: FormData) {
  const { parsed, protocolIds, primaryProtocolId, tags, contentJson } = planData(formData);
  if (!parsed.id) throw new Error("Research Plan ID is required.");
  const planId = parsed.id;
  await prisma.$transaction(async (tx) => {
    await tx.researchPlan.update({
      where: { id: planId },
      data: {
        projectId: parsed.projectId,
        code: parsed.code,
        title: parsed.title,
        objective: parsed.objective,
        hypothesis: parsed.hypothesis,
        rationale: parsed.rationale,
        design: parsed.design,
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
