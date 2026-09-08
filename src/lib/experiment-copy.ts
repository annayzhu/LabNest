import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { reserveRecordCode } from "@/lib/record-codes";
import { associateDocumentMedia } from "@/lib/document-media.server";
import type { Prisma } from "@/generated/prisma/client";

/** Copy the saved plan and locked method, never the execution or consumption history. */
export async function copyExperiment(sourceId: string, raw: unknown) {
  const { clientMutationId: id } = z.object({ clientMutationId: z.string().uuid() }).parse(raw);
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`experiment-copy:${id}`},0))::text`;
    const replay = await tx.experiment.findUnique({ where: { id } });
    if (replay) {
      const origin = await tx.activityLog.findFirst({ where: { targetType: "experiment", targetId: id, action: "copy", metadataJson: { path: ["sourceId"], equals: sourceId } } });
      if (!origin) throw new Error("Copy request ID is already in use.");
      return replay;
    }
    const source = await tx.experiment.findUniqueOrThrow({ where: { id: sourceId }, include: { steps: true, protocolVersions: true, protocolRun: true, materialUses: true } });
    const copy = await tx.experiment.create({ data: {
      id, runCode: await reserveRecordCode(tx,"experiment"), title: `${source.title} · 副本`, status: "planned", recordStatus: "draft",
      projectId: source.projectId, researchPlanId: source.researchPlanId, purpose: source.purpose, tags: source.tags,
      contentJson: source.contentJson as Prisma.InputJsonValue, searchText: source.searchText,
      protocolSnapshotJson: source.protocolSnapshotJson as Prisma.InputJsonValue, primaryProtocolVersionId: source.primaryProtocolVersionId,
      protocolVersions: { create: source.protocolVersions.map(v => ({ protocolVersionId: v.protocolVersionId, role: v.role, order: v.order })) },
      steps: { create: source.steps.map(s => ({ protocolStepRef: s.protocolStepRef, groupKey: s.groupKey, groupTitle: s.groupTitle, groupOrder: s.groupOrder, order: s.order, title: s.title, description: s.description, requiresConfirmation: s.requiresConfirmation, allowsDeviation: s.allowsDeviation, timerDurationSeconds: s.timerDurationSeconds })) },
      materialUses: { create: source.materialUses.filter(r => !r.correctionOfId).map(r => ({ id: randomUUID(), name: r.name, expected: r.expected, unit: r.unit, source: `Copied plan from ${source.runCode}: ${r.source}`, status: "recorded" })) },
    } });
    if (source.protocolRun) await tx.protocolRun.create({ data: { experimentId: id, protocolVersionId: source.protocolRun.protocolVersionId, parametersJson: source.protocolRun.parametersJson as Prisma.InputJsonValue, calculatedConsumptionJson: source.protocolRun.calculatedConsumptionJson as Prisma.InputJsonValue } });
    await associateDocumentMedia(tx, [copy.contentJson,copy.protocolSnapshotJson], "experiment",id);
    await tx.activityLog.create({ data: { action: "copy", targetType: "experiment", targetId: id, metadataJson: { sourceId, sourceRunCode: source.runCode, executionReset: true } } });
    return copy;
  });
}
