import { lockEntrySourceGraph } from "@/lib/entry-source-lock";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "./db";
import { lockAttachmentOriginals } from "./attachment-reference-protection";
import { assertRecordEditable, isRecordLocked } from "./record-lifecycle";
import { entryTargetKey, type EntryAssignmentInput } from "./entry-assignment";
import { getEntryMarkdown, selectEntryAttachments } from "./entry-content";
import { reserveRecordCode } from "./record-codes";
import { createResultInTransaction } from "./result-creation";

export type EntrySource = { id: string; title: string; markdown: string; createdAt: string; occurredAt: string; eventTimePrecision: string; updatedAt: string; author: string | null; attachments: { id: string; originalFilename: string; mimeType: string; size: number }[] };
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

async function lockTarget(tx: Prisma.TransactionClient, type: string, id: string) {
  if (type === "experiment") await tx.$queryRaw`SELECT id FROM "Experiment" WHERE id=${id} FOR UPDATE`;
  else if (type === "result") await tx.$queryRaw`SELECT id FROM "Result" WHERE id=${id} FOR UPDATE`;
}
async function assertTargetOpen(tx: Prisma.TransactionClient, type: string, id: string) {
  await lockTarget(tx, type, id);
  const target = type === "experiment" ? await tx.experiment.findUnique({ where: { id } }) : await tx.result.findUnique({ where: { id } });
  if (!target) throw new Error("归属目标已失效，请重新选择");
  assertRecordEditable(target.recordStatus);
  if (target.status === "archived") throw new Error("归属目标已归档，请先恢复目标");
  if (await tx.deletedRecord.findFirst({ where: { targetType: type, targetId: id, restoredAt: null } })) throw new Error("归属目标在回收站，请先恢复目标");
  return target;
}

/** The Entry row serializes requests; the partial unique index additionally enforces one primary target. */
export async function assignEntry(entryId: string, input: EntryAssignmentInput) {
  return prisma.$transaction(async tx => {
    await lockEntrySourceGraph(tx);
    await tx.$queryRaw`SELECT id FROM "Entry" WHERE id=${entryId} FOR UPDATE`;
    const entry = await tx.entry.findUnique({ where: { id: entryId } });
    if (!entry) throw new Error("快速记录不存在");
    assertRecordEditable(entry.recordStatus);
    const signature = JSON.stringify(input);
    const replay = await tx.activityLog.findFirst({ where: { action: "entry_assign", targetType: "entry", targetId: entryId, metadataJson: { path: ["mutationId"], equals: input.mutationId } } });
    if (replay) {
      if ((replay.metadataJson as Record<string, unknown>).request !== signature) throw new Error("重试请求内容不同，请重新确认归属");
      return { replay: true };
    }
    const current = await tx.itemLink.findFirst({ where: { sourceType: "entry", sourceId: entryId, linkType: "entry_primary" } });
    if (entryTargetKey(current) !== input.expectedTarget) throw new Error("归属已被另一窗口更改，请刷新后再确认");
    if (current) {
      const exists = current.targetType === "experiment" ? await tx.experiment.findUnique({where:{id:current.targetId}}) : await tx.result.findUnique({where:{id:current.targetId}});
      // Invalid/removed targets can be detached. Frozen targets cannot be silently altered.
      if (exists) await lockTarget(tx, current.targetType, current.targetId);
      const latest = exists ? current.targetType === "experiment" ? await tx.experiment.findUnique({where:{id:current.targetId}}) : await tx.result.findUnique({where:{id:current.targetId}}) : null;
      if (latest && current.targetType === "result" && "experimentId" in latest && latest.experimentId) {
        await lockTarget(tx, "experiment", latest.experimentId);
        const parent = await tx.experiment.findUnique({where:{id:latest.experimentId}});
        if (parent && isRecordLocked(parent.recordStatus)) throw new Error("所属实验的来源已冻结，请先重新打开实验");
      }
      if (latest && isRecordLocked(latest.recordStatus)) throw new Error("已提交或审核目标的来源已冻结，请先按现有流程重新打开目标");
    }
    let targetId = input.targetId;
    let experimentId: string | null = null;
    if (input.type === "result") {
      const experiment = await assertTargetOpen(tx, "experiment", input.experimentId!);
      experimentId = experiment.id;
      if (targetId) {
        const result = await assertTargetOpen(tx, "result", targetId);
        if (!("experimentId" in result) || result.experimentId !== experimentId) throw new Error("该结果不属于所选实验");
      } else {
        const result = await createResultInTransaction(tx, { experimentId, title: input.newTitle!, resultType: "Observation", recordStatus: "draft", sourceType: "manual", qualityStatus: "not_assessed", origin: { kind: "manual" } });
        targetId = result.resultId;
      }
    } else if (input.type === "experiment") {
      if (targetId) experimentId = (await assertTargetOpen(tx, "experiment", targetId)).id;
      else {
        const experiment = await tx.experiment.create({ data: { title: input.newTitle!, runCode: await reserveRecordCode(tx, "experiment"), projectId: entry.projectId, researchPlanId: entry.researchPlanId, status: "planned", recordStatus: "draft" } });
        targetId = experiment.id; experimentId = experiment.id;
      }
    }
    if (experimentId) {
      const experiment = await tx.experiment.findUniqueOrThrow({ where: { id: experimentId } });
      if (entry.projectId && entry.projectId !== experiment.projectId) throw new Error("快速记录与目标实验不属于同一研究项目");
      if (entry.researchPlanId && entry.researchPlanId !== experiment.researchPlanId) throw new Error("快速记录与目标实验不属于同一研究方案");
    }
    await tx.itemLink.deleteMany({ where: { sourceType: "entry", sourceId: entryId, linkType: "entry_primary" } });
    if (input.type !== "none") await tx.itemLink.create({ data: { sourceType: "entry", sourceId: entryId, targetType: input.type, targetId: targetId!, linkType: "entry_primary", createdBy: "user" } });
    // Relationship-only update: never submit a cached body, contentJson or timestamp.
    await tx.entry.update({ where: { id: entryId }, data: { experimentId, experimentStepId: current?.targetId === targetId ? entry.experimentStepId : null } });
    await tx.activityLog.create({ data: { action: "entry_assign", targetType: "entry", targetId: entryId, metadataJson: json({ mutationId: input.mutationId, request: signature, from: entryTargetKey(current), to: input.type === "none" ? null : `${input.type}:${targetId}`, assignedAt: new Date().toISOString() }) } });
    return { replay: false, targetType: input.type, targetId };
  });
}

export async function liveEntrySources(tx: Prisma.TransactionClient, type: "experiment" | "result", id: string): Promise<EntrySource[]> {
  const links = await tx.itemLink.findMany({ where: { sourceType: "entry", linkType: "entry_primary", ...(type === "result" ? { targetType: type, targetId: id } : { OR: [{targetType:"experiment",targetId:id}, {targetType:"result",targetId:{in:(await tx.result.findMany({where:{experimentId:id},select:{id:true}})).map(r=>r.id)}}] }) } });
  const entries = await tx.entry.findMany({ where: { id: { in: links.map(link => link.sourceId) } }, orderBy: { createdAt: "asc" } });
  const attachments = await tx.attachmentLink.findMany({ where: { targetType: "entry", targetId: { in: entries.map(entry=>entry.id) } }, include: { attachment: true } });
  return entries.map(entry => ({ id: entry.id, title: entry.title, markdown: getEntryMarkdown(entry.contentJson, entry.body), createdAt: entry.createdAt.toISOString(), occurredAt: entry.occurredAt.toISOString(), eventTimePrecision: entry.eventTimePrecision, updatedAt: entry.updatedAt.toISOString(), author: null, attachments: selectEntryAttachments(entry.contentJson, attachments.filter(link=>link.targetId===entry.id)).map(a=>({id:a.id,originalFilename:a.originalFilename,mimeType:a.mimeType,size:a.size})) }));
}

/** Existing ActivityLog holds frozen source versions; indexed evidence links preserve their originals. */
export async function freezeEntrySources(tx: Prisma.TransactionClient, type: "experiment" | "result", id: string) {
  const sources = await liveEntrySources(tx, type, id);
  await tx.activityLog.create({ data: { action: "entry_sources_frozen", targetType: type, targetId: id, metadataJson: json({ sources, capturedAt: new Date().toISOString() }) } });
  const attachmentIds = sources.flatMap(s=>s.attachments.map(a=>a.id));
  await lockAttachmentOriginals(tx, attachmentIds);
  for (const attachmentId of new Set(attachmentIds)) {
    if (!await tx.attachmentLink.findFirst({ where: { attachmentId, targetType: "entry_source_snapshot", targetId: `${type}:${id}` } })) await tx.attachmentLink.create({ data: { attachmentId, targetType: "entry_source_snapshot", targetId: `${type}:${id}`, linkType: "frozen_source" } });
  }
}

export async function getEntrySources(type: "experiment" | "result", id: string, locked: boolean) {
  if (locked) {
    const frozen = await prisma.activityLog.findFirst({ where: { action: "entry_sources_frozen", targetType: type, targetId: id }, orderBy: { createdAt: "desc" } });
    if (frozen) return { frozen: true, sources: (frozen.metadataJson as unknown as { sources: EntrySource[] }).sources, legacy: false };
    // Never claim a mutable current source represents an already-signed historical version.
    return { frozen: true, sources: [] as EntrySource[], legacy: (await prisma.$transaction(tx=>liveEntrySources(tx,type,id))).length > 0 };
  }
  return { frozen: false, sources: await prisma.$transaction(tx=>liveEntrySources(tx,type,id)), legacy: false };
}
