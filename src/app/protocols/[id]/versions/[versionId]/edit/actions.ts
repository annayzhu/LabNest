"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ProtocolAvailability, ProtocolReviewStage } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { projectProtocolDocument, protocolDocumentSchema } from "@/lib/protocol-document";
import type { ProtocolEditorState } from "@/components/ProtocolDocumentEditor";
import { parseTags } from "@/lib/tags";
import { checkResultTemplate } from "@/lib/result-templates";

export type { ProtocolEditorState } from "@/components/ProtocolDocumentEditor";

const editorSchema = z.object({
  protocolId: z.string().min(1),
  versionId: z.string().min(1),
  canonicalTitle: z.string().trim().min(1).max(180),
  shortTitle: z.string().trim().optional(),
  englishTitle: z.string().trim().optional(),
  availability: z.enum(ProtocolAvailability),
  reviewStage: z.enum(ProtocolReviewStage),
  displayVersion: z.string().trim().regex(/^\d+\.\d+(?:\.\d+)?$/),
  changeSummary: z.string().trim().optional(),
  tags: z.array(z.string().trim().min(1).max(48)),
  contentJson: z.string().min(1),
  researchPlanIds: z.array(z.string().min(1)),
  primaryResearchPlanIds: z.array(z.string().min(1)),
});

function cloneJson(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

function recordStatusFor(reviewStage: ProtocolReviewStage) {
  if (reviewStage === "reviewed") return "reviewed" as const;
  if (reviewStage === "ready_for_review") return "submitted" as const;
  return "draft" as const;
}

export async function saveProtocolDocument(
  _previousState: ProtocolEditorState,
  formData: FormData,
): Promise<ProtocolEditorState> {
  try {
    const parsed = editorSchema.parse({
      protocolId: formData.get("protocolId"),
      versionId: formData.get("versionId"),
      canonicalTitle: formData.get("canonicalTitle"),
      shortTitle: String(formData.get("shortTitle") ?? "").trim() || undefined,
      englishTitle: String(formData.get("englishTitle") ?? "").trim() || undefined,
      availability: formData.get("availability"),
      reviewStage: formData.get("reviewStage"),
      displayVersion: formData.get("displayVersion"),
      changeSummary: String(formData.get("changeSummary") ?? "").trim() || undefined,
      tags: parseTags(formData.get("tags")),
      contentJson: formData.get("contentJson"),
      researchPlanIds: formData.getAll("researchPlanIds").map(String),
      primaryResearchPlanIds: formData.getAll("primaryResearchPlanIds").map(String),
    });
    const document = protocolDocumentSchema.parse(JSON.parse(parsed.contentJson));
    const projection = projectProtocolDocument(document);
    if (parsed.reviewStage !== "draft") {
      const templateErrors = projection.resultTemplates.flatMap((template) => checkResultTemplate(template).errors);
      if (templateErrors.length) return { error: `Result Templates must be complete before review: ${templateErrors.join(" ")}` };
    }
    const sourceVersion = await prisma.protocolVersion.findUnique({
      where: { id: parsed.versionId },
      include: { protocol: true },
    });
    if (!sourceVersion || sourceVersion.protocolId !== parsed.protocolId) return { error: "Protocol version not found." };
    if (sourceVersion.reviewStage === "reviewed" && !parsed.changeSummary) {
      return { error: "A reviewed version is immutable. Enter a change summary to create the next revision." };
    }

    const researchPlanIds = [...new Set([...parsed.researchPlanIds, ...parsed.primaryResearchPlanIds])];
    const researchPlans = researchPlanIds.length ? await prisma.researchPlan.findMany({
      where: { id: { in: researchPlanIds } },
      select: { id: true, projectId: true },
    }) : [];
    if (researchPlans.length !== researchPlanIds.length) return { error: "One or more selected Research Plans no longer exist." };
    if (sourceVersion.protocol.scope === "project" && researchPlans.some((plan) => plan.projectId !== sourceVersion.protocol.projectId)) {
      return { error: "A Project Protocol can only be linked to Research Plans in the same Project." };
    }

    const recordStatus = recordStatusFor(parsed.reviewStage);
    const duplicateVersion = await prisma.protocolVersion.findFirst({
      where: {
        protocolId: parsed.protocolId,
        displayVersion: parsed.displayVersion,
        NOT: { id: sourceVersion.id },
      },
    });
    if (duplicateVersion) return { error: `Version ${parsed.displayVersion} already exists for this Protocol.` };

    const latestVersion = sourceVersion.reviewStage === "reviewed"
      ? await prisma.protocolVersion.findFirst({ where: { protocolId: parsed.protocolId }, orderBy: { revision: "desc" } })
      : undefined;

    await prisma.$transaction(async (transaction) => {
      await transaction.protocol.update({
        where: { id: parsed.protocolId },
        data: {
          title: parsed.canonicalTitle,
          canonicalTitle: parsed.canonicalTitle,
          shortTitle: parsed.shortTitle,
          englishTitle: parsed.englishTitle,
          description: projection.description,
          availability: parsed.availability,
          recordStatus,
          tags: parsed.tags,
        },
      });

      const versionData = {
        displayVersion: parsed.displayVersion,
        reviewStage: parsed.reviewStage,
        recordStatus,
        title: `${parsed.canonicalTitle} v${parsed.displayVersion}`,
        purpose: projection.purpose,
        background: projection.background,
        materialsJson: projection.materials,
        stepsJson: projection.steps,
        resultTemplatesJson: projection.resultTemplates,
        consumptionRulesJson: projection.consumptionRules,
        equipmentJson: projection.equipment,
        contentJson: JSON.parse(JSON.stringify(document)),
        changeSummary: parsed.changeSummary,
      } as const;

      let savedVersionId = sourceVersion.id;
      if (sourceVersion.reviewStage === "reviewed") {
        const createdVersion = await transaction.protocolVersion.create({
          data: {
            protocolId: parsed.protocolId,
            revision: (latestVersion?.revision ?? sourceVersion.revision) + 1,
            previousVersionId: sourceVersion.id,
            sourceType: "manual",
            scope: sourceVersion.scope,
            notes: sourceVersion.notes,
            parametersJson: cloneJson(sourceVersion.parametersJson),
            adaptationRationale: sourceVersion.adaptationRationale,
            ...versionData,
          },
        });
        savedVersionId = createdVersion.id;
      } else {
        await transaction.protocolVersion.update({ where: { id: sourceVersion.id }, data: versionData });
      }

      await transaction.researchPlanProtocol.deleteMany({ where: { protocolId: parsed.protocolId } });
      if (researchPlanIds.length) {
        await transaction.researchPlanProtocol.createMany({
          data: researchPlanIds.map((researchPlanId) => ({
            protocolId: parsed.protocolId,
            researchPlanId,
            isPrimary: parsed.primaryResearchPlanIds.includes(researchPlanId),
          })),
        });
      }
      await transaction.activityLog.create({
        data: {
          action: sourceVersion.reviewStage === "reviewed" ? "create_revision" : "update",
          targetType: "protocol",
          targetId: parsed.protocolId,
          metadataJson: {
            sourceVersionId: sourceVersion.id,
            savedVersionId,
            displayVersion: parsed.displayVersion,
            reviewStage: parsed.reviewStage,
            researchPlanIds,
          },
        },
      });
    });

    revalidatePath("/protocols");
    revalidatePath(`/protocols/${parsed.protocolId}`);
    redirect(`/protocols/${parsed.protocolId}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { error: error instanceof Error ? error.message : "The Protocol could not be saved." };
  }
}
