"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { reserveRecordCode } from "@/lib/record-codes";

export type ProtocolAdaptState = { error?: string };

const adaptSchema = z.object({
  protocolId: z.string().min(1),
  sourceVersionId: z.string().min(1),
  projectId: z.string().min(1),
  researchPlanId: z.string().min(1),
  canonicalTitle: z.string().trim().min(1).max(180),
  adaptationRationale: z.string().trim().min(1),
  displayVersion: z.string().trim().regex(/^\d+\.\d+(?:\.\d+)?$/),
});

function cloneJson(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}

export async function adaptProtocolToProject(
  _previousState: ProtocolAdaptState,
  formData: FormData,
): Promise<ProtocolAdaptState> {
  try {
    const parsed = adaptSchema.parse(Object.fromEntries(formData));
    const [sourceVersion, researchPlan] = await Promise.all([
      prisma.protocolVersion.findUnique({ where: { id: parsed.sourceVersionId }, include: { protocol: true } }),
      prisma.researchPlan.findUnique({ where: { id: parsed.researchPlanId } }),
    ]);
    if (!sourceVersion || sourceVersion.protocolId !== parsed.protocolId) return { error: "Source Protocol version not found." };
    if (sourceVersion.protocol.scope !== "general") return { error: "Only a General Protocol can start this adaptation workflow." };
    if (!researchPlan || researchPlan.projectId !== parsed.projectId) return { error: "The selected Research Plan does not belong to the selected Project." };

    const protocol = await prisma.$transaction(async (transaction) => {
      const humanCode = await reserveRecordCode(transaction, "protocol");
      const created = await transaction.protocol.create({ data: {
        humanCode,
        title: parsed.canonicalTitle,
        canonicalTitle: parsed.canonicalTitle,
        shortTitle: sourceVersion.protocol.shortTitle,
        englishTitle: sourceVersion.protocol.englishTitle,
        description: sourceVersion.protocol.description,
        scope: "project",
        availability: "draft",
        recordStatus: "draft",
        projectId: parsed.projectId,
        tags: Array.from(new Set([...sourceVersion.protocol.tags, "project-adapted"])),
        researchPlans: {
          create: { researchPlanId: parsed.researchPlanId, isPrimary: true, note: parsed.adaptationRationale },
        },
        versions: {
          create: {
            revision: 1,
            displayVersion: parsed.displayVersion,
            reviewStage: "draft",
            recordStatus: "draft",
            derivedFromVersionId: sourceVersion.id,
            adaptationRationale: parsed.adaptationRationale,
            changeSummary: "Initial project adaptation.",
            sourceType: "derived",
            title: `${parsed.canonicalTitle} v${parsed.displayVersion}`,
            purpose: sourceVersion.purpose,
            background: sourceVersion.background,
            scope: sourceVersion.scope,
            notes: sourceVersion.notes,
            parametersJson: cloneJson(sourceVersion.parametersJson),
            materialsJson: cloneJson(sourceVersion.materialsJson),
            equipmentJson: cloneJson(sourceVersion.equipmentJson),
            stepsJson: cloneJson(sourceVersion.stepsJson),
            consumptionRulesJson: cloneJson(sourceVersion.consumptionRulesJson),
            resultTemplatesJson: cloneJson(sourceVersion.resultTemplatesJson),
            contentJson: cloneJson(sourceVersion.contentJson),
          },
        },
      }, include: { versions: { select: { id: true } } } });
      await transaction.projectProtocol.create({ data: { projectId: parsed.projectId, protocolId: created.id } });
      await transaction.activityLog.create({ data: {
        action: "adapt_to_project",
        targetType: "protocol",
        targetId: created.id,
        metadataJson: { sourceProtocolId: parsed.protocolId, sourceVersionId: sourceVersion.id, protocolVersionId: created.versions[0]?.id, projectId: parsed.projectId, researchPlanId: parsed.researchPlanId },
      } });
      return created;
    });

    revalidatePath("/protocols");
    revalidatePath("/research-plans");
    redirect(`/protocols/${protocol.id}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { error: error instanceof Error ? error.message : "The project adaptation could not be created." };
  }
}
