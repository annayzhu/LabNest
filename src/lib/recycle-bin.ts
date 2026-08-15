import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { recyclableRecordTypes, recycleBinHref, type RecyclableRecordType } from "@/lib/recycle-bin-meta";

export { recyclableRecordTypes, recycleBinHref, recycleBinTypeLabel } from "@/lib/recycle-bin-meta";
export type { RecyclableRecordType } from "@/lib/recycle-bin-meta";

type StoredAttachmentLink = {
  id: string;
  attachmentId: string;
  targetType: string;
  targetId: string;
  linkType: string;
  order: number;
  createdAt: string | Date;
};

type StoredItemLink = {
  id: string;
  sourceType: string;
  sourceId: string;
  targetType: string;
  targetId: string;
  linkType: string;
  createdBy: "user" | "system" | "ai";
  confidence: number | null;
  note: string | null;
  createdAt: string | Date;
};

export type RecycleBinSnapshot = {
  schemaVersion: 1;
  deletionMode?: "physical" | "soft";
  record: Record<string, unknown>;
  related?: Record<string, unknown>;
  attachmentLinks?: StoredAttachmentLink[];
  itemLinks?: StoredItemLink[];
};

export type StoreDeletedRecordInput = {
  targetType: RecyclableRecordType;
  targetId: string;
  identifier: string;
  title: string;
  snapshot: RecycleBinSnapshot;
};

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export async function storeDeletedRecord(tx: Prisma.TransactionClient, input: StoreDeletedRecordInput) {
  const existing = await tx.deletedRecord.findFirst({
    where: { targetType: input.targetType, targetId: input.targetId, restoredAt: null },
    select: { id: true },
  });
  if (existing) throw new Error("This record is already in the Recycle Bin.");
  return tx.deletedRecord.create({
    data: {
      targetType: input.targetType,
      targetId: input.targetId,
      identifier: input.identifier,
      title: input.title,
      snapshotJson: jsonClone(input.snapshot) as Prisma.InputJsonValue,
    },
  });
}

async function genericLinks(
  tx: Prisma.TransactionClient,
  selectors: { attachmentTargets: Array<{ targetType: string; targetIds: string[] }>; itemTargets: Array<{ type: string; ids: string[] }> },
) {
  const attachmentWhere = selectors.attachmentTargets.flatMap(({ targetType, targetIds }) => targetIds.length ? [{ targetType, targetId: { in: targetIds } }] : []);
  const itemWhere = selectors.itemTargets.flatMap(({ type, ids }) => ids.length ? [
    { sourceType: type, sourceId: { in: ids } },
    { targetType: type, targetId: { in: ids } },
  ] : []);
  const [attachmentLinks, itemLinks] = await Promise.all([
    attachmentWhere.length ? tx.attachmentLink.findMany({ where: { OR: attachmentWhere } }) : Promise.resolve([]),
    itemWhere.length ? tx.itemLink.findMany({ where: { OR: itemWhere } }) : Promise.resolve([]),
  ]);
  return { attachmentLinks, itemLinks };
}

export async function captureDeletedRecord(
  tx: Prisma.TransactionClient,
  targetType: RecyclableRecordType,
  targetId: string,
  options?: { deletionMode?: "physical" | "soft" },
) {
  const deletionMode = options?.deletionMode ?? "physical";
  if (targetType === "project") {
    const record = await tx.project.findUnique({ where: { id: targetId } });
    if (!record) throw new Error("This Project no longer exists.");
    const links = await genericLinks(tx, { attachmentTargets: [{ targetType: "project", targetIds: [record.id] }], itemTargets: [{ type: "project", ids: [record.id] }] });
    return storeDeletedRecord(tx, { targetType, targetId, identifier: record.name, title: record.name, snapshot: { schemaVersion: 1, deletionMode, record, ...links } });
  }
  if (targetType === "research_plan") {
    const source = await tx.researchPlan.findUnique({ where: { id: targetId }, include: { protocols: true } });
    if (!source) throw new Error("This Research Plan no longer exists.");
    const { protocols, ...record } = source;
    const links = await genericLinks(tx, { attachmentTargets: [{ targetType: "research_plan", targetIds: [record.id] }], itemTargets: [{ type: "research_plan", ids: [record.id] }] });
    return storeDeletedRecord(tx, { targetType, targetId, identifier: record.code, title: record.title, snapshot: { schemaVersion: 1, deletionMode, record, related: { protocols }, ...links } });
  }
  if (targetType === "protocol") {
    const source = await tx.protocol.findUnique({ where: { id: targetId }, include: { versions: true } });
    if (!source) throw new Error("This Protocol no longer exists.");
    const { versions, ...record } = source;
    const versionIds = versions.map((version) => version.id);
    const links = await genericLinks(tx, {
      attachmentTargets: [{ targetType: "protocol", targetIds: [record.id] }, { targetType: "protocol_version", targetIds: versionIds }],
      itemTargets: [{ type: "protocol", ids: [record.id] }, { type: "protocol_version", ids: versionIds }],
    });
    return storeDeletedRecord(tx, { targetType, targetId, identifier: record.humanCode, title: record.canonicalTitle ?? record.title, snapshot: { schemaVersion: 1, deletionMode, record, related: { versions }, ...links } });
  }
  if (targetType === "experiment") {
    const source = await tx.experiment.findUnique({ where: { id: targetId }, include: { protocolRun: true, steps: true, protocolVersions: true } });
    if (!source) throw new Error("This Experiment no longer exists.");
    const { protocolRun, steps, protocolVersions, ...record } = source;
    const links = await genericLinks(tx, { attachmentTargets: [{ targetType: "experiment", targetIds: [record.id] }], itemTargets: [{ type: "experiment", ids: [record.id] }] });
    return storeDeletedRecord(tx, { targetType, targetId, identifier: record.runCode, title: record.title, snapshot: { schemaVersion: 1, deletionMode, record, related: { protocolRun: protocolRun ? [protocolRun] : [], steps, protocolVersions }, ...links } });
  }
  if (targetType === "result") {
    const record = await tx.result.findUnique({ where: { id: targetId } });
    if (!record) throw new Error("This Result no longer exists.");
    const links = await genericLinks(tx, { attachmentTargets: [{ targetType: "result", targetIds: [record.id] }], itemTargets: [{ type: "result", ids: [record.id] }] });
    return storeDeletedRecord(tx, { targetType, targetId, identifier: record.title, title: record.title, snapshot: { schemaVersion: 1, deletionMode, record, ...links } });
  }
  if (targetType === "report") {
    const source = await tx.report.findUnique({ where: { id: targetId }, include: { sources: true } });
    if (!source) throw new Error("This Report no longer exists.");
    const { sources, ...record } = source;
    const links = await genericLinks(tx, { attachmentTargets: [{ targetType: "report", targetIds: [record.id] }], itemTargets: [{ type: "report", ids: [record.id] }] });
    return storeDeletedRecord(tx, { targetType, targetId, identifier: record.title, title: record.title, snapshot: { schemaVersion: 1, deletionMode, record, related: { sources }, ...links } });
  }
  const record = await tx.entry.findUnique({ where: { id: targetId } });
  if (!record) throw new Error("This Entry no longer exists.");
  const links = await genericLinks(tx, { attachmentTargets: [{ targetType: "entry", targetIds: [record.id] }], itemTargets: [{ type: "entry", ids: [record.id] }] });
  return storeDeletedRecord(tx, { targetType, targetId, identifier: record.title, title: record.title, snapshot: { schemaVersion: 1, deletionMode, record, ...links } });
}

function snapshotFrom(value: unknown): RecycleBinSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("This recycle-bin snapshot is invalid.");
  const snapshot = value as Partial<RecycleBinSnapshot>;
  if (snapshot.schemaVersion !== 1 || !snapshot.record || typeof snapshot.record !== "object" || Array.isArray(snapshot.record)) {
    throw new Error("This recycle-bin snapshot uses an unsupported format.");
  }
  return snapshot as RecycleBinSnapshot;
}

export function isAssociationPreservingSnapshot(value: unknown) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && (value as { deletionMode?: unknown }).deletionMode === "soft");
}

function relatedArray<T>(snapshot: RecycleBinSnapshot, key: string) {
  const value = snapshot.related?.[key];
  return Array.isArray(value) ? value as T[] : [];
}

async function restoreAttachmentLinks(tx: Prisma.TransactionClient, links: StoredAttachmentLink[] = []) {
  if (!links.length) return;
  const attachmentIds = [...new Set(links.map((link) => link.attachmentId))];
  const existing = await tx.attachment.count({ where: { id: { in: attachmentIds } } });
  if (existing !== attachmentIds.length) throw new Error("One or more archived attachments no longer exist, so this record cannot be restored safely.");
  await tx.attachmentLink.createMany({ data: links.map((link) => ({ ...link, createdAt: new Date(link.createdAt) })) });
}

async function restoreItemLinks(tx: Prisma.TransactionClient, links: StoredItemLink[] = []) {
  if (!links.length) return;
  await tx.itemLink.createMany({ data: links.map((link) => ({ ...link, createdAt: new Date(link.createdAt) })) });
}

async function assertIdsExist(
  count: () => Promise<number>,
  expected: number,
  message: string,
) {
  if (!expected) return;
  if (await count() !== expected) throw new Error(message);
}

async function restoreProject(tx: Prisma.TransactionClient, snapshot: RecycleBinSnapshot) {
  await tx.project.create({ data: snapshot.record as unknown as Prisma.ProjectUncheckedCreateInput });
}

async function restoreResearchPlan(tx: Prisma.TransactionClient, snapshot: RecycleBinSnapshot) {
  const links = relatedArray<Prisma.ResearchPlanProtocolUncheckedCreateInput>(snapshot, "protocols");
  const protocolIds = [...new Set(links.map((link) => link.protocolId))];
  await assertIdsExist(
    () => tx.protocol.count({ where: { id: { in: protocolIds } } }),
    protocolIds.length,
    "One or more linked Protocols no longer exist, so this Research Plan cannot be restored safely.",
  );
  await tx.researchPlan.create({ data: snapshot.record as unknown as Prisma.ResearchPlanUncheckedCreateInput });
  if (links.length) await tx.researchPlanProtocol.createMany({ data: links });
}

async function restoreProtocol(tx: Prisma.TransactionClient, snapshot: RecycleBinSnapshot) {
  const versions = relatedArray<Prisma.ProtocolVersionUncheckedCreateInput>(snapshot, "versions");
  await tx.protocol.create({ data: snapshot.record as unknown as Prisma.ProtocolUncheckedCreateInput });
  for (const version of versions) {
    const { previousVersionId, derivedFromVersionId, ...base } = version;
    await tx.protocolVersion.create({ data: { ...base, previousVersionId: null, derivedFromVersionId: null } });
    if (previousVersionId || derivedFromVersionId) {
      await tx.protocolVersion.update({ where: { id: String(version.id) }, data: { previousVersionId, derivedFromVersionId } });
    }
  }
}

async function restoreExperiment(tx: Prisma.TransactionClient, snapshot: RecycleBinSnapshot) {
  const steps = relatedArray<Prisma.ExperimentStepUncheckedCreateInput>(snapshot, "steps");
  const versionLinks = relatedArray<Prisma.ExperimentProtocolVersionUncheckedCreateInput>(snapshot, "protocolVersions");
  const protocolRuns = relatedArray<Prisma.ProtocolRunUncheckedCreateInput>(snapshot, "protocolRun");
  const versionIds = [...new Set(versionLinks.map((link) => link.protocolVersionId))];
  await assertIdsExist(
    () => tx.protocolVersion.count({ where: { id: { in: versionIds } } }),
    versionIds.length,
    "One or more locked Protocol versions no longer exist, so this Experiment cannot be restored safely.",
  );
  await tx.experiment.create({ data: snapshot.record as unknown as Prisma.ExperimentUncheckedCreateInput });
  if (steps.length) await tx.experimentStep.createMany({ data: steps });
  if (versionLinks.length) await tx.experimentProtocolVersion.createMany({ data: versionLinks });
  for (const run of protocolRuns) await tx.protocolRun.create({ data: run });
}

async function restoreResult(tx: Prisma.TransactionClient, snapshot: RecycleBinSnapshot) {
  await tx.result.create({ data: snapshot.record as unknown as Prisma.ResultUncheckedCreateInput });
}

async function restoreReport(tx: Prisma.TransactionClient, snapshot: RecycleBinSnapshot) {
  const sources = relatedArray<Prisma.ReportSourceUncheckedCreateInput>(snapshot, "sources");
  const resultIds = [...new Set(sources.flatMap((source) => source.resultId ? [source.resultId] : []))];
  await assertIdsExist(
    () => tx.result.count({ where: { id: { in: resultIds } } }),
    resultIds.length,
    "One or more Result sources no longer exist, so this Report cannot be restored safely.",
  );
  await tx.report.create({ data: snapshot.record as unknown as Prisma.ReportUncheckedCreateInput });
  if (sources.length) await tx.reportSource.createMany({ data: sources });
}

async function restoreEntry(tx: Prisma.TransactionClient, snapshot: RecycleBinSnapshot) {
  await tx.entry.create({ data: snapshot.record as unknown as Prisma.EntryUncheckedCreateInput });
}

function updateDataFromSnapshot(record: Record<string, unknown>) {
  const data = { ...record };
  delete data.id;
  return data;
}

async function restoreSoftDeletedRecord(tx: Prisma.TransactionClient, targetType: RecyclableRecordType, snapshot: RecycleBinSnapshot) {
  const id = String(snapshot.record.id ?? "");
  if (!id) throw new Error("This recycle-bin snapshot is missing its original record ID.");
  const data = updateDataFromSnapshot(snapshot.record);
  if (targetType === "protocol") await tx.protocol.update({ where: { id }, data: data as Prisma.ProtocolUncheckedUpdateInput });
  else if (targetType === "research_plan") await tx.researchPlan.update({ where: { id }, data: data as Prisma.ResearchPlanUncheckedUpdateInput });
  else if (targetType === "result") await tx.result.update({ where: { id }, data: data as Prisma.ResultUncheckedUpdateInput });
  else throw new Error("This soft-deleted record type cannot be restored.");
}

export async function restoreDeletedRecord(deletedRecordId: string) {
  return prisma.$transaction(async (tx) => {
    const deleted = await tx.deletedRecord.findUnique({ where: { id: deletedRecordId } });
    if (!deleted) throw new Error("This recycle-bin record no longer exists.");
    if (deleted.restoredAt) throw new Error("This record has already been restored.");
    if (!recyclableRecordTypes.includes(deleted.targetType as RecyclableRecordType)) throw new Error("This record type cannot be restored.");
    const snapshot = snapshotFrom(deleted.snapshotJson);
    const targetType = deleted.targetType as RecyclableRecordType;
    const softDeleted = snapshot.deletionMode === "soft";

    if (softDeleted) await restoreSoftDeletedRecord(tx, targetType, snapshot);
    else if (deleted.targetType === "project") await restoreProject(tx, snapshot);
    else if (deleted.targetType === "research_plan") await restoreResearchPlan(tx, snapshot);
    else if (deleted.targetType === "protocol") await restoreProtocol(tx, snapshot);
    else if (deleted.targetType === "experiment") await restoreExperiment(tx, snapshot);
    else if (deleted.targetType === "result") await restoreResult(tx, snapshot);
    else if (deleted.targetType === "report") await restoreReport(tx, snapshot);
    else if (deleted.targetType === "entry") await restoreEntry(tx, snapshot);

    if (!softDeleted) {
      await restoreAttachmentLinks(tx, snapshot.attachmentLinks);
      await restoreItemLinks(tx, snapshot.itemLinks);
    }
    const restoredAt = new Date();
    await tx.deletedRecord.update({ where: { id: deleted.id }, data: { restoredAt } });
    await tx.activityLog.create({
      data: {
        action: "restore",
        targetType: deleted.targetType,
        targetId: deleted.targetId,
        metadataJson: { recycleBinId: deleted.id, identifier: deleted.identifier, title: deleted.title, deletedAt: deleted.deletedAt.toISOString() },
      },
    });
    return { targetType: deleted.targetType, targetId: deleted.targetId, href: recycleBinHref(deleted.targetType, deleted.targetId) };
  });
}

export async function permanentlyDeleteSnapshot(deletedRecordId: string, confirmation: string) {
  return prisma.$transaction(async (tx) => {
    const deleted = await tx.deletedRecord.findUnique({ where: { id: deletedRecordId } });
    if (!deleted) throw new Error("This recycle-bin record no longer exists.");
    if (deleted.restoredAt) throw new Error("A restored record cannot be purged from the active recycle bin.");
    if (confirmation !== deleted.identifier) throw new Error(`Enter ${deleted.identifier} exactly to confirm permanent deletion.`);
    if (snapshotFrom(deleted.snapshotJson).deletionMode === "soft") {
      throw new Error("This recovery entry preserves live scientific associations and cannot be purged. Restore the record instead.");
    }
    await tx.activityLog.create({
      data: {
        action: "purge",
        targetType: deleted.targetType,
        targetId: deleted.targetId,
        metadataJson: { recycleBinId: deleted.id, identifier: deleted.identifier, title: deleted.title, deletedAt: deleted.deletedAt.toISOString() },
      },
    });
    await tx.deletedRecord.delete({ where: { id: deleted.id } });
  });
}
