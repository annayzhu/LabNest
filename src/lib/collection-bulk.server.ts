import { createHash } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { lockEntrySourceGraph } from "@/lib/entry-source-lock";
import { captureDeletedRecord } from "@/lib/recycle-bin";
import { experimentDeleteBlockers, projectDeleteBlockers, protocolRequiresAssociationPreservingRecycle, researchPlanRequiresAssociationPreservingRecycle, resultRequiresAssociationPreservingRecycle } from "@/lib/record-lifecycle";
import { bulkValues, collectionBulkSchema, collectionSelectionSchema, collectionStatuses, planCollectionBulk, type BulkRow, type BulkSnapshot, type CollectionBulkRequest, type CollectionKind } from "@/lib/collection-bulk";

type Tx = Prisma.TransactionClient;
export type BulkPreview = { token: string; rows: BulkRow[]; records: BulkSnapshot[] };
export type BulkApplyResult = { applied: true; batchId: string; rows: BulkRow[] } | { applied: false; preview: BulkPreview };
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const tables = { project: Prisma.sql`"Project"`, research_plan: Prisma.sql`"ResearchPlan"`, protocol: Prisma.sql`"Protocol"`, experiment: Prisma.sql`"Experiment"`, result: Prisma.sql`"Result"` };

async function loadRecords(tx: Tx, kind: CollectionKind, ids: string[]): Promise<BulkSnapshot[]> {
  const common = { id: true, updatedAt: true } as const;
  const rows = kind === "project" ? await tx.project.findMany({ where: { id: { in: ids } }, select: { ...common, name: true, status: true, tags: true } })
    : kind === "research_plan" ? await tx.researchPlan.findMany({ where: { id: { in: ids } }, select: { ...common, title: true, status: true, tags: true } })
    : kind === "protocol" ? await tx.protocol.findMany({ where: { id: { in: ids } }, select: { ...common, title: true, canonicalTitle: true, availability: true, recordStatus: true, tags: true } })
    : kind === "experiment" ? await tx.experiment.findMany({ where: { id: { in: ids } }, select: { ...common, title: true, status: true, recordStatus: true, tags: true, protocolRun: { select: { status: true } } } })
    : await tx.result.findMany({ where: { id: { in: ids } }, select: { ...common, title: true, status: true, recordStatus: true, notes: true } });
  const recycled = new Set((await tx.deletedRecord.findMany({ where: { targetType: kind, targetId: { in: ids }, restoredAt: null }, select: { targetId: true } })).map(row => row.targetId));
  return rows.map(row => ({
    id: row.id, title: "name" in row ? row.name : "canonicalTitle" in row ? row.canonicalTitle ?? row.title : row.title,
    status: "availability" in row ? row.availability : row.status,
    updatedAt: row.updatedAt.toISOString(),
    ...("tags" in row ? { tags: row.tags } : {}), ...("notes" in row ? { notes: row.notes } : {}),
    ...("recordStatus" in row ? { recordStatus: row.recordStatus } : {}),
    ...("protocolRun" in row && row.protocolRun ? { runStatus: row.protocolRun.status } : {}),
    ...(recycled.has(row.id) ? { recycled: true } : {}),
  }));
}

/** Load the same dependency counts used by the individual record lifecycle actions. */
async function deletionDependencies(tx: Tx, kind: CollectionKind, id: string): Promise<BulkSnapshot["deletion"]> {
  if (kind === "project") {
    const row = await tx.project.findUniqueOrThrow({ where: { id }, select: { _count: { select: { researchPlans: true, protocols: true, experiments: true, results: true, reports: true, entries: true, entities: true, procurementInquiries: true, protocolAssociations: true, samples: true, sequences: true, sequencePairs: true, sequenceCollections: true, sequenceWorkflows: true } } } });
    // Newer modules also reference Projects; retain those links rather than let onDelete:SetNull detach them.
    const genericReferences = await tx.itemLink.count({ where: { OR: [{ sourceType: kind, sourceId: id }, { targetType: kind, targetId: id }] } }) + row._count.protocolAssociations + row._count.samples + row._count.sequences + row._count.sequencePairs + row._count.sequenceCollections + row._count.sequenceWorkflows;
    const counts = { ...row._count, genericReferences };
    const blockers = projectDeleteBlockers(counts);
    return { counts, mode: blockers.length ? "archive" : "physical", ...(blockers.length ? { reason: { en: `Linked records; archive instead: ${blockers.map(b => `${b.label} (${b.count})`).join(", ")}.`, zh: `存在关联，改为归档：${blockers.map(b => `${b.labelZh}（${b.count}）`).join("、")}。` } } : {}) };
  }
  if (kind === "research_plan") {
    const row = await tx.researchPlan.findUniqueOrThrow({ where: { id }, select: { _count: { select: { entries: true, experiments: true, results: true, reports: true } } } });
    const counts = { ...row._count, reportSourceReferences: await tx.reportSource.count({ where: { sourceType: kind, sourceId: id } }) };
    return { counts, mode: researchPlanRequiresAssociationPreservingRecycle(counts) ? "soft" : "physical" };
  }
  if (kind === "protocol") {
    const row = await tx.protocol.findUniqueOrThrow({ where: { id }, select: { versions: { select: { id: true } }, _count: { select: { projectAssociations: true, researchPlans: true } } } });
    const versionIds = row.versions.map(v => v.id).sort();
    const [experiments, results, nonDraftVersions, derivedVersions, reportSourceReferences] = await Promise.all([
      tx.experimentProtocolVersion.count({ where: { protocolVersion: { protocolId: id } } }),
      tx.result.count({ where: { protocolVersion: { protocolId: id } } }),
      tx.protocolVersion.count({ where: { protocolId: id, OR: [{ recordStatus: { not: "draft" } }, { reviewStage: { not: "draft" } }] } }),
      tx.protocolVersion.count({ where: { protocolId: { not: id }, derivedFromVersion: { protocolId: id } } }),
      tx.reportSource.count({ where: { OR: [{ sourceType: kind, sourceId: id }, { sourceType: "protocol_version", sourceId: { in: versionIds } }] } }),
    ]);
    const counts = { projects: row._count.projectAssociations, researchPlans: row._count.researchPlans, experiments, results, nonDraftVersions, derivedVersions, reportSourceReferences };
    return { counts, versionIds, mode: protocolRequiresAssociationPreservingRecycle(counts) ? "soft" : "physical" };
  }
  if (kind === "experiment") {
    const row = await tx.experiment.findUniqueOrThrow({ where: { id }, select: { status: true, recordStatus: true, protocolRun: { select: { id: true } }, _count: { select: { results: true, inventoryTransactions: true } } } });
    const [samplesProduced, samplesUsed, completedSteps, deviations, attachments, reportSourceReferences, entryReferences, proposedActions] = await Promise.all([
      tx.experimentSample.count({ where: { experimentId: id, role: "output" } }),
      tx.experimentSample.count({ where: { experimentId: id, role: "input", usedAmount: { not: null } } }),
      tx.experimentStep.count({ where: { experimentId: id, completed: true } }),
      tx.experimentStep.count({ where: { experimentId: id, deviationNote: { not: null } } }),
      tx.attachmentLink.count({ where: { targetType: kind, targetId: id } }),
      tx.reportSource.count({ where: { sourceType: kind, sourceId: id } }),
      tx.itemLink.count({ where: { sourceType: "entry", targetType: kind, targetId: id } }),
      row.protocolRun ? tx.proposedAction.count({ where: { sourceType: "protocol", sourceId: row.protocolRun.id } }) : Promise.resolve(0),
    ]);
    const counts = { ...row._count, samplesProduced, samplesUsed, completedSteps, deviations, attachments, reportSourceReferences, entryReferences, proposedActions };
    const blockers = experimentDeleteBlockers(row.status, row.recordStatus, counts);
    return { counts, mode: blockers.length ? "archive" : "physical", ...(blockers.length ? { reason: { en: `Execution evidence or protected state; archive instead: ${blockers.map(b => b.label).join(", ")}.`, zh: `存在执行证据或受保护状态，改为归档：${blockers.map(b => b.labelZh).join("、")}。` } } : {}) };
  }
  const row = await tx.result.findUniqueOrThrow({ where: { id }, select: { _count: { select: { datasets: true, reportSources: true } } } });
  const [attachments, inboundLinks] = await Promise.all([tx.attachmentLink.count({ where: { targetType: kind, targetId: id } }), tx.itemLink.count({ where: { targetType: kind, targetId: id } })]);
  const counts = { ...row._count, attachments, inboundLinks };
  return { counts, mode: resultRequiresAssociationPreservingRecycle(counts) ? "soft" : "physical" };
}

async function prepare(tx: Tx, request: CollectionBulkRequest): Promise<BulkPreview> {
  const records = await loadRecords(tx, request.kind, request.ids);
  if (request.operation === "delete") for (const row of records) if (!row.recycled) row.deletion = await deletionDependencies(tx, request.kind, row.id);
  if (request.operation === "restore") {
    const logs = await tx.activityLog.findMany({ where: { targetType: request.kind, targetId: { in: request.ids }, action: "archive" }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
    for (const row of records) {
      const log = logs.find(log => log.targetId === row.id);
      const meta = log?.metadataJson as { previousStatus?: string; previousAvailability?: string; previousRunStatus?: string } | undefined;
      const status = meta?.previousStatus ?? meta?.previousAvailability;
      if (status && status !== "archived" && collectionStatuses[request.kind].includes(status)) {
        // Old experiment archives did not store the run's prior status. Ask rather than infer it.
        if (!row.runStatus || meta?.previousRunStatus) row.previousStatus = status;
        if (meta?.previousRunStatus && collectionStatuses.experiment.includes(meta.previousRunStatus)) row.previousRunStatus = meta.previousRunStatus;
      }
    }
  }
  if (request.kind === "project" && request.operation === "edit" && request.titles.length) {
    const names = await tx.project.findMany({ select: { id: true, name: true } });
    const titles = new Map(request.titles.map(row => [row.id, row.title]));
    for (const row of records) {
      const title = titles.get(row.id);
      if (title) row.nameConflict = names.some(other => other.id !== row.id && (titles.get(other.id) ?? other.name).toLocaleLowerCase() === title.toLocaleLowerCase());
    }
  }
  const rows = planCollectionBulk(request, records);
  // updatedAt plus lifecycle dependencies detect changes even when the visible patch is unchanged.
  return { token: digest({ request, records: [...records].sort((a, b) => a.id.localeCompare(b.id)), rows }), rows, records };
}

export async function loadCollectionSelection(input: unknown) {
  const { kind, ids } = collectionSelectionSchema.parse(input);
  return prisma.$transaction(tx => loadRecords(tx, kind, ids), { isolationLevel: "RepeatableRead", timeout: 30000 });
}
export async function previewCollectionBulk(input: unknown) {
  const request = collectionBulkSchema.parse(input);
  return prisma.$transaction(tx => prepare(tx, request), { isolationLevel: "RepeatableRead", timeout: 120000 });
}

async function updateValues(tx: Tx, kind: CollectionKind, row: BulkRow) {
  const { id, before, after } = row;
  if (!before || !after) throw new Error("Missing change values.");
  const title = before.title === after.title ? undefined : after.title;
  if (kind === "project") await tx.project.update({ where: { id }, data: { name: title, status: after.status as "active" | "paused" | "completed" | "archived", tags: after.tags } });
  else if (kind === "research_plan") await tx.researchPlan.update({ where: { id }, data: { title, status: after.status as "draft" | "active" | "paused" | "completed" | "archived", tags: after.tags } });
  else if (kind === "protocol") await tx.protocol.update({ where: { id }, data: { title, canonicalTitle: title, availability: after.status as "draft" | "active" | "retired" | "archived", tags: after.tags } });
  else if (kind === "experiment") {
    await tx.experiment.update({ where: { id }, data: { title, tags: after.tags, status: after.status as "planned" | "running" | "completed" | "failed" | "archived" } });
    if (after.runStatus !== undefined && after.runStatus !== before.runStatus) await tx.protocolRun.updateMany({ where: { experimentId: id }, data: { status: after.runStatus as "planned" | "running" | "completed" | "failed" | "archived" } });
  } else await tx.result.update({ where: { id }, data: { title, notes: after.notes, status: after.status as "active" | "inactive" | "archived" } });
}

async function recycle(tx: Tx, kind: CollectionKind, row: BulkSnapshot, soft: boolean) {
  const recycled = await captureDeletedRecord(tx, kind, row.id, { deletionMode: soft ? "soft" : "physical" });
  if (soft) await updateValues(tx, kind, { id: row.id, title: row.title, outcome: "retain_recycle", before: bulkValues(row), after: { ...bulkValues(row), status: "archived" } });
  else {
    const targets = [{ type: kind as string, ids: [row.id] }, ...(kind === "protocol" ? [{ type: "protocol_version", ids: row.deletion?.versionIds ?? [] }] : [])];
    await tx.attachmentLink.deleteMany({ where: { OR: targets.map(target => ({ targetType: target.type, targetId: { in: target.ids } })) } });
    await tx.itemLink.deleteMany({ where: { OR: targets.flatMap(target => [{ sourceType: target.type, sourceId: { in: target.ids } }, { targetType: target.type, targetId: { in: target.ids } }]) } });
    if (kind === "project") await tx.project.delete({ where: { id: row.id } });
    else if (kind === "research_plan") await tx.researchPlan.delete({ where: { id: row.id } });
    else if (kind === "protocol") await tx.protocol.delete({ where: { id: row.id } });
    else if (kind === "experiment") await tx.experiment.delete({ where: { id: row.id } });
    else await tx.result.delete({ where: { id: row.id } });
  }
  return recycled.id;
}

export async function applyCollectionBulk(input: unknown, token: string, batchId: string, confirmation?: string): Promise<BulkApplyResult> {
  const request = collectionBulkSchema.parse(input);
  if (!/^[a-f0-9-]{36}$/i.test(batchId) || !/^[a-f0-9]{64}$/.test(token)) throw new Error("Invalid preview or batch identifier.");
  if (request.operation === "delete" && confirmation !== String(request.ids.length)) throw new Error("Enter the selected record count to confirm.");
  const requestHash = digest(request);
  try { return await prisma.$transaction(async tx => {
    await lockEntrySourceGraph(tx);
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${batchId}, 71104))::text`;
    const existing = await tx.activityLog.findFirst({ where: { targetType: "collection_bulk", targetId: batchId, action: "bulk_complete" } });
    if (existing) {
      const stored = existing.metadataJson as { requestHash: string; rows: BulkRow[] };
      if (stored.requestHash !== requestHash) throw new Error("This batch identifier was already used for a different request.");
      return { applied: true, batchId, rows: stored.rows };
    }
    // Lock targets in a stable order. Serializable isolation also guards new dependency/reference rows.
    await tx.$queryRaw(Prisma.sql`SELECT id FROM ${tables[request.kind]} WHERE id IN (${Prisma.join(request.ids)}) ORDER BY id FOR UPDATE`);
    const preview = await prepare(tx, request);
    if (preview.token !== token) return { applied: false, preview };
    if (preview.rows.some(row => row.needsStatus)) throw new Error("Choose the missing restore statuses and preview again.");
    for (const row of preview.rows) {
      const record = preview.records.find(record => record.id === row.id);
      let recycleBinId: string | undefined;
      if (row.outcome === "recycle" || row.outcome === "retain_recycle") recycleBinId = await recycle(tx, request.kind, record!, row.outcome === "retain_recycle");
      else if (row.outcome !== "skip" && row.outcome !== "noop") await updateValues(tx, request.kind, row);
      const archived = row.before?.status !== "archived" && row.after?.status === "archived" && !["recycle", "retain_recycle"].includes(row.outcome);
      await tx.activityLog.create({ data: {
        action: archived ? "archive" : row.outcome === "recycle" ? "delete" : row.outcome === "retain_recycle" ? "recycle" : `bulk_${row.outcome}`,
        targetType: request.kind, targetId: row.id,
        metadataJson: json({ batchId, operation: request.operation, outcome: row.outcome, before: row.before, after: row.after, reason: row.reason, dependencyCounts: record?.deletion?.counts, recycleBinId, ...(archived ? { previousStatus: row.before?.status, previousAvailability: row.before?.status, previousRunStatus: row.before?.runStatus } : {}) }),
      } });
    }
    await tx.activityLog.create({ data: { action: "bulk_complete", targetType: "collection_bulk", targetId: batchId, metadataJson: json({ requestHash, kind: request.kind, operation: request.operation, rows: preview.rows }) } });
    return { applied: true, batchId, rows: preview.rows };
  }, { isolationLevel: "Serializable", timeout: 120000, maxWait: 15000 });
  } catch (error) {
    // A simultaneous retry can start its serializable snapshot before the first request commits.
    // Once that transaction wins, return its receipt rather than append again or replay its writes.
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2034" || error.code === "P2010" && JSON.stringify(error.meta).includes("TransactionWriteConflict"))) {
      const existing = await prisma.activityLog.findFirst({ where: { targetType: "collection_bulk", targetId: batchId, action: "bulk_complete" } });
      const stored = existing?.metadataJson as { requestHash: string; rows: BulkRow[] } | undefined;
      if (stored?.requestHash === requestHash) return { applied: true, batchId, rows: stored.rows };
      return { applied: false, preview: await previewCollectionBulk(request) };
    }
    throw error;
  }
}
