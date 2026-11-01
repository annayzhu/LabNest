import {emptyExecutionPlan, parseExecutionPlan} from "./structured-run";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { reserveRecordCode } from "@/lib/record-codes";
import { associateDocumentMedia } from "@/lib/document-media.server";
import type { Prisma } from "@/generated/prisma/client";
import { addDays, daysBetween, defaultWorkHours, labDayKey, labInstant, nextWorkMoment } from "@/lib/experiment-schedule";
import { experimentDateOf } from "@/lib/experiment-schedule.server";

/**
 * The schedule comes along as a plan (Q269): the same days and clock times, starting on the next working day, nothing
 * ticked off. A custom step's reference is its row, so it follows the copied row; a Protocol step's reference stays.
 */
async function copySchedule(tx: Prisma.TransactionClient, sourceId: string, copyId: string, stepIds: Map<string, string>) {
  const blocks = await tx.experimentScheduleBlock.findMany({ where: { experimentId: sourceId }, orderBy: { startAt: "asc" } });
  if (!blocks.length) return;
  const startDay = labDayKey(nextWorkMoment(labInstant(addDays(labDayKey(new Date()), 1), defaultWorkHours.start)));
  const shift = daysBetween(labDayKey(blocks[0].startAt), startDay) * 86_400_000;
  const ids = new Map(blocks.map(block => [block.id, randomUUID()]));
  const refOf = (ref: string) => stepIds.get(ref) ?? ref;
  await tx.experimentScheduleBlock.createMany({ data: blocks.map(block => ({
    id: ids.get(block.id)!, experimentId: copyId, kind: block.kind, title: block.title, stepRefs: block.stepRefs.map(refOf), startAt: new Date(block.startAt.getTime() + shift),
    allDay: block.allDay, estimatedMinutes: block.estimatedMinutes, afterBlockId: block.afterBlockId ? ids.get(block.afterBlockId) ?? null : null,
    minGapMinutes: block.minGapMinutes, maxGapMinutes: block.maxGapMinutes, gapSource: block.gapSource?.replace(/^(step|overnight):(.+)$/, (_, kind: string, ref: string) => `${kind}:${refOf(ref)}`) ?? null,
    note: block.note, doneAt: null,
  })) });
  await tx.experiment.update({ where: { id: copyId }, data: { date: experimentDateOf(startDay) } });
}

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
    // Group configuration and every execution write hold this same parent lock.
    await tx.$queryRaw`SELECT id FROM "Experiment" WHERE id=${sourceId} FOR UPDATE`;
    const source = await tx.experiment.findUniqueOrThrow({ where: { id: sourceId }, include: { steps: true, protocolVersions: true, protocolRun: true, materialUses: true, sampleGroups: true, samples: { where: { role: "input" } } } });
    const stepIds = new Map(source.steps.map(step=>[step.id,randomUUID()]));
    const capturedPlan = parseExecutionPlan(source.protocolRun?.executionPlanJson);
    const freshPlan = {...emptyExecutionPlan(),groups:capturedPlan.groups,stepGroups:Object.fromEntries(Object.entries(capturedPlan.stepGroups).filter(([old])=>stepIds.has(old)).map(([old,group])=>[stepIds.get(old)!,group]))};
    const copy = await tx.experiment.create({ data: {
      id, runCode: await reserveRecordCode(tx,"experiment"), title: `${source.title} · 副本`, status: "planned", recordStatus: "draft",
      projectId: source.projectId, researchPlanId: source.researchPlanId, purpose: source.purpose, tags: source.tags,
      contentJson: source.contentJson as Prisma.InputJsonValue, searchText: source.searchText,
      protocolSnapshotJson: source.protocolSnapshotJson as Prisma.InputJsonValue, primaryProtocolVersionId: source.primaryProtocolVersionId,
      protocolVersions: { create: source.protocolVersions.map(v => ({ protocolVersionId: v.protocolVersionId, role: v.role, order: v.order })) },
      steps: { create: source.steps.map(s => ({ id:stepIds.get(s.id), protocolStepRef: s.protocolStepRef, groupKey: s.groupKey, groupTitle: s.groupTitle, groupOrder: s.groupOrder, order: s.order, title: s.title, description: s.description, requiresConfirmation: s.requiresConfirmation, allowsDeviation: s.allowsDeviation, timerDurationSeconds: s.timerDurationSeconds })) },
      materialUses: { create: source.materialUses.filter(r => !r.correctionOfId).map(r => ({ id: randomUUID(), name: r.name, expected: r.expected, unit: r.unit, source: `Copied plan from ${source.runCode}: ${r.source}`, status: "recorded" })) },
    } });
    if (source.protocolRun) await tx.protocolRun.create({ data: { experimentId: id, protocolVersionId: source.protocolRun.protocolVersionId, executionPlanJson:freshPlan as Prisma.InputJsonValue, parametersJson: source.protocolRun.parametersJson as Prisma.InputJsonValue, calculatedConsumptionJson: source.protocolRun.calculatedConsumptionJson as Prisma.InputJsonValue } });
    // The samples it takes and their groups come along (S12); what was taken from them and what it produced do not.
    const groupIds = new Map(source.sampleGroups.map(group => [group.id, randomUUID()]));
    if (groupIds.size) await tx.experimentSampleGroup.createMany({ data: source.sampleGroups.map(group => ({ id: groupIds.get(group.id)!, experimentId: id, label: group.label, sortOrder: group.sortOrder })) });
    if (source.samples.length) await tx.experimentSample.createMany({ data: source.samples.map(link => ({ experimentId: id, sampleId: link.sampleId, role: "input" as const, groupId: link.groupId ? groupIds.get(link.groupId) ?? null : null, sortOrder: link.sortOrder })) });
    await copySchedule(tx, sourceId, id, stepIds);
    await associateDocumentMedia(tx, [copy.contentJson,copy.protocolSnapshotJson], "experiment",id);
    await tx.activityLog.create({ data: { action: "copy", targetType: "experiment", targetId: id, metadataJson: { sourceId, sourceRunCode: source.runCode, executionReset: true } } });
    return copy;
  });
}
