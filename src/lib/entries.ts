import { entries as demoEntries } from "@/lib/demo-data";
import { prisma } from "@/lib/db";
import { getEntryMarkdown, getOrderedAttachmentIds } from "@/lib/entry-content";
import type { Entry, EntryAttachment } from "@/lib/types";

export type EntryItemLinkRecord = {
  id: string;
  direction: "outbound" | "inbound";
  counterpartType: string;
  counterpartId: string;
  linkType: string;
  createdBy: string;
  confidence?: number;
  note?: string;
  createdAt: string;
};

export type EntryPendingActionRecord = {
  id: string;
  actionType: string;
  status: string;
  confidence?: number;
  reason?: string;
  createdAt: string;
};

export type EntryDetailRecord = Entry & {
  attachments: EntryAttachment[];
  itemLinks: EntryItemLinkRecord[];
  pendingActions: EntryPendingActionRecord[];
};

function serializeAttachment(attachment: {
  id: string;
  originalFilename: string;
  mimeType: string;
  size: number;
  uploadedAt: Date;
  sha256: string | null;
  metadataJson: unknown;
  derivativeKind: string | null;
}): EntryAttachment {
  return {
    id: attachment.id,
    originalFilename: attachment.originalFilename,
    mimeType: attachment.mimeType,
    size: attachment.size,
    uploadedAt: attachment.uploadedAt.toISOString(),
    sha256: attachment.sha256 ?? undefined,
    metadata: attachment.metadataJson && typeof attachment.metadataJson === "object" && !Array.isArray(attachment.metadataJson)
      ? attachment.metadataJson as Record<string, unknown>
      : undefined,
    derivativeKind: attachment.derivativeKind ?? undefined,
  };
}

function orderAttachments<T extends { id: string }>(attachments: T[], contentJson: unknown) {
  const positions = new Map(getOrderedAttachmentIds(contentJson).map((id, index) => [id, index]));
  return [...attachments].sort((a, b) => (positions.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (positions.get(b.id) ?? Number.MAX_SAFE_INTEGER));
}

function fallbackEntries(): Entry[] {
  return demoEntries.map((entry) => ({
    ...entry,
    attachments: entry.attachments ?? [],
    linkedItemCount: entry.linkedItemCount ?? entry.relevantItems.length,
  }));
}

export async function getEntryRecords(): Promise<Entry[]> {
  try {
    const records = await prisma.entry.findMany({
      include: { project: true, researchPlan: true },
      orderBy: { occurredAt: "desc" },
    });
    const entryIds = records.map((entry) => entry.id);

    if (!entryIds.length) return [];

    const [attachmentLinks, itemLinks, pendingActions] = await Promise.all([
      prisma.attachmentLink.findMany({
        where: { targetType: "entry", targetId: { in: entryIds } },
        include: { attachment: true },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      }),
      prisma.itemLink.findMany({
        where: {
          OR: [
            { sourceType: "entry", sourceId: { in: entryIds } },
            { targetType: "entry", targetId: { in: entryIds } },
          ],
        },
        select: { id: true, sourceType: true, sourceId: true, targetType: true, targetId: true },
      }),
      prisma.proposedAction.findMany({
        where: { sourceType: "entry", sourceId: { in: entryIds }, status: "pending" },
        select: { id: true, sourceId: true },
      }),
    ]);
    const entryIdSet = new Set(entryIds);

    const attachmentsByEntry = new Map<string, EntryAttachment[]>();
    attachmentLinks.forEach((link) => {
      const attachments = attachmentsByEntry.get(link.targetId) ?? [];
      attachments.push(serializeAttachment(link.attachment));
      attachmentsByEntry.set(link.targetId, attachments);
    });

    const linkIdsByEntry = new Map<string, Set<string>>();
    itemLinks.forEach((link) => {
      const linkedEntryIds = new Set<string>();
      if (link.sourceType === "entry" && entryIdSet.has(link.sourceId)) linkedEntryIds.add(link.sourceId);
      if (link.targetType === "entry" && entryIdSet.has(link.targetId)) linkedEntryIds.add(link.targetId);

      linkedEntryIds.forEach((entryId) => {
        const linkIds = linkIdsByEntry.get(entryId) ?? new Set<string>();
        linkIds.add(link.id);
        linkIdsByEntry.set(entryId, linkIds);
      });
    });

    const pendingCounts = new Map<string, number>();
    pendingActions.forEach((action) => {
      if (!action.sourceId) return;
      pendingCounts.set(action.sourceId, (pendingCounts.get(action.sourceId) ?? 0) + 1);
    });

    return records.map((entry) => {
      const attachments = orderAttachments(attachmentsByEntry.get(entry.id) ?? [], entry.contentJson);

      return {
        id: entry.id,
        title: entry.title,
        body: entry.body,
        occurredAt: entry.occurredAt.toISOString(),
        projectId: entry.projectId ?? undefined,
        projectName: entry.project?.name,
        researchPlanId: entry.researchPlanId ?? undefined,
        researchPlanTitle: entry.researchPlan?.title,
        tags: entry.tags,
        sourceType: entry.sourceType,
        recordStatus: entry.recordStatus,
        moodStatus: entry.moodStatus ?? undefined,
        attachmentCount: attachments.length,
        attachments,
        relevantItems: [],
        linkedItemCount: linkIdsByEntry.get(entry.id)?.size ?? 0,
        pendingActionCount: pendingCounts.get(entry.id) ?? 0,
        contentMarkdown: getEntryMarkdown(entry.contentJson, entry.body),
      };
    });
  } catch {
    return fallbackEntries();
  }
}

export async function getEntryDetailRecord(id: string): Promise<EntryDetailRecord | undefined> {
  try {
    const entry = await prisma.entry.findUnique({
      where: { id },
      include: { project: true, researchPlan: true },
    });

    if (!entry) return undefined;

    const [attachmentLinks, itemLinks, pendingActions] = await Promise.all([
      prisma.attachmentLink.findMany({
        where: { targetType: "entry", targetId: id },
        include: { attachment: true },
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      }),
      prisma.itemLink.findMany({
        where: {
          OR: [
            { sourceType: "entry", sourceId: id },
            { targetType: "entry", targetId: id },
          ],
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.proposedAction.findMany({
        where: { sourceType: "entry", sourceId: id },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    const attachments = orderAttachments(attachmentLinks.map((link) => serializeAttachment(link.attachment)), entry.contentJson);

    return {
      id: entry.id,
      title: entry.title,
      body: entry.body,
      occurredAt: entry.occurredAt.toISOString(),
      projectId: entry.projectId ?? undefined,
      projectName: entry.project?.name,
      researchPlanId: entry.researchPlanId ?? undefined,
      researchPlanTitle: entry.researchPlan?.title,
      tags: entry.tags,
      sourceType: entry.sourceType,
      recordStatus: entry.recordStatus,
      moodStatus: entry.moodStatus ?? undefined,
      attachmentCount: attachments.length,
      attachments,
      relevantItems: [],
      linkedItemCount: itemLinks.length,
      pendingActionCount: pendingActions.filter((action) => action.status === "pending").length,
      contentMarkdown: getEntryMarkdown(entry.contentJson, entry.body),
      itemLinks: itemLinks.map((link) => {
        const outbound = link.sourceType === "entry" && link.sourceId === id;
        return {
          id: link.id,
          direction: outbound ? "outbound" : "inbound",
          counterpartType: outbound ? link.targetType : link.sourceType,
          counterpartId: outbound ? link.targetId : link.sourceId,
          linkType: link.linkType,
          createdBy: link.createdBy,
          confidence: link.confidence ?? undefined,
          note: link.note ?? undefined,
          createdAt: link.createdAt.toISOString(),
        };
      }),
      pendingActions: pendingActions.map((action) => ({
        id: action.id,
        actionType: action.actionType,
        status: action.status,
        confidence: action.confidence ?? undefined,
        reason: action.reason ?? undefined,
        createdAt: action.createdAt.toISOString(),
      })),
    };
  } catch {
    const entry = fallbackEntries().find((candidate) => candidate.id === id);
    if (!entry) return undefined;
    return { ...entry, attachments: entry.attachments ?? [], itemLinks: [], pendingActions: [] };
  }
}
