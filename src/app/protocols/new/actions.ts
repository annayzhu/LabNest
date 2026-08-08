"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ProtocolEditorState } from "@/components/ProtocolDocumentEditor";
import { prisma } from "@/lib/db";
import { projectProtocolDocument, protocolDocumentSchema } from "@/lib/protocol-document";

const createSchema = z.object({
  canonicalTitle: z.string().trim().min(1).max(180),
  shortTitle: z.string().trim().optional(),
  englishTitle: z.string().trim().optional(),
  protocolScope: z.enum(["general", "project"]),
  projectId: z.string().trim().optional(),
  availability: z.enum(["draft", "active", "retired", "archived"]),
  reviewStage: z.enum(["draft", "ready_for_review", "reviewed"]),
  displayVersion: z.string().trim().regex(/^\d+\.\d+(?:\.\d+)?$/, "Use a version such as 0.1 or 1.0"),
  changeSummary: z.string().trim().optional(),
  tags: z.array(z.string().trim().min(1).max(48)),
  contentJson: z.string().min(1),
  researchPlanIds: z.array(z.string().min(1)),
  primaryResearchPlanIds: z.array(z.string().min(1)),
}).superRefine((value, context) => {
  if (value.protocolScope === "project" && !value.projectId) {
    context.addIssue({ code: "custom", path: ["projectId"], message: "Project Protocols require a Project." });
  }
});

function recordStatusFor(reviewStage: "draft" | "ready_for_review" | "reviewed") {
  if (reviewStage === "reviewed") return "reviewed" as const;
  if (reviewStage === "ready_for_review") return "submitted" as const;
  return "draft" as const;
}

async function nextProtocolCode() {
  const protocols = await prisma.protocol.findMany({
    where: { humanCode: { startsWith: "PRT-" } },
    select: { humanCode: true },
  });
  const highest = protocols.reduce((max, item) => {
    const parsed = Number(item.humanCode?.replace("PRT-", ""));
    return Number.isFinite(parsed) ? Math.max(max, parsed) : max;
  }, 100000);
  return `PRT-${String(highest + 1).padStart(6, "0")}`;
}

export async function createProtocolDocument(
  _previousState: ProtocolEditorState,
  formData: FormData,
): Promise<ProtocolEditorState> {
  try {
    const parsed = createSchema.parse({
      canonicalTitle: formData.get("canonicalTitle"),
      shortTitle: String(formData.get("shortTitle") ?? "").trim() || undefined,
      englishTitle: String(formData.get("englishTitle") ?? "").trim() || undefined,
      protocolScope: formData.get("protocolScope") || "general",
      projectId: String(formData.get("projectId") ?? "").trim() || undefined,
      availability: formData.get("availability") || "draft",
      reviewStage: formData.get("reviewStage") || "draft",
      displayVersion: formData.get("displayVersion") || "0.1",
      changeSummary: String(formData.get("changeSummary") ?? "").trim() || undefined,
      tags: String(formData.get("tags") ?? "").split(",").map((item) => item.trim()).filter(Boolean),
      contentJson: formData.get("contentJson"),
      researchPlanIds: formData.getAll("researchPlanIds").map(String),
      primaryResearchPlanIds: formData.getAll("primaryResearchPlanIds").map(String),
    });
    const document = protocolDocumentSchema.parse(JSON.parse(parsed.contentJson));
    const projection = projectProtocolDocument(document);
    const project = parsed.projectId ? await prisma.project.findUnique({ where: { id: parsed.projectId }, select: { id: true } }) : null;
    if (parsed.protocolScope === "project" && !project) return { error: "The selected Project no longer exists." };

    const researchPlanIds = [...new Set([...parsed.researchPlanIds, ...parsed.primaryResearchPlanIds])];
    const researchPlans = researchPlanIds.length ? await prisma.researchPlan.findMany({
      where: { id: { in: researchPlanIds } },
      select: { id: true, projectId: true },
    }) : [];
    if (researchPlans.length !== researchPlanIds.length) return { error: "One or more selected Research Plans no longer exist." };
    if (parsed.protocolScope === "project" && researchPlans.some((plan) => plan.projectId !== parsed.projectId)) {
      return { error: "A Project Protocol can only be linked to Research Plans in the same Project." };
    }

    const recordStatus = recordStatusFor(parsed.reviewStage);
    const humanCode = await nextProtocolCode();
    const protocol = await prisma.$transaction(async (transaction) => {
      const created = await transaction.protocol.create({
        data: {
          humanCode,
          title: parsed.canonicalTitle,
          canonicalTitle: parsed.canonicalTitle,
          shortTitle: parsed.shortTitle,
          englishTitle: parsed.englishTitle,
          description: projection.description,
          scope: parsed.protocolScope,
          availability: parsed.availability,
          recordStatus,
          projectId: parsed.protocolScope === "project" ? parsed.projectId : null,
          tags: parsed.tags,
          versions: {
            create: {
              revision: 1,
              displayVersion: parsed.displayVersion,
              reviewStage: parsed.reviewStage,
              recordStatus,
              title: `${parsed.canonicalTitle} v${parsed.displayVersion}`,
              purpose: projection.purpose,
              background: projection.background,
              materialsJson: projection.materials,
              equipmentJson: projection.equipment,
              stepsJson: projection.steps,
              resultTemplatesJson: projection.resultTemplates,
              consumptionRulesJson: projection.consumptionRules,
              contentJson: JSON.parse(JSON.stringify(document)),
              sourceType: "manual",
              changeSummary: parsed.changeSummary ?? "Initial version.",
            },
          },
          researchPlans: researchPlanIds.length ? {
            create: researchPlanIds.map((researchPlanId) => ({
              researchPlanId,
              isPrimary: parsed.primaryResearchPlanIds.includes(researchPlanId),
            })),
          } : undefined,
        },
        include: { versions: { select: { id: true } } },
      });
      await transaction.activityLog.create({
        data: {
          action: "create",
          targetType: "protocol",
          targetId: created.id,
          metadataJson: {
            protocolVersionId: created.versions[0]?.id,
            displayVersion: parsed.displayVersion,
            reviewStage: parsed.reviewStage,
            researchPlanIds,
          },
        },
      });
      return created;
    });

    revalidatePath("/protocols");
    redirect(`/protocols/${protocol.id}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { error: error instanceof Error ? error.message : "The Protocol could not be created." };
  }
}
