import type { Prisma } from "@/generated/prisma/client";
import { MAX_ENTRY_FILES, MAX_ENTRY_TOTAL_BYTES } from "@/lib/attachment-limits";
import {
  cleanupPreparedAttachmentFiles,
  prepareAttachmentFile,
  writePreparedAttachmentFiles,
  type PreparedAttachmentFile,
} from "@/lib/attachment-files";
import { calculateConsumption, type ProtocolParameterValues } from "@/lib/protocol";
import { buildEntryContent } from "@/lib/entry-content";
import { prisma } from "@/lib/db";
import type { EntryMutationInput } from "@/lib/entry-mutations";
import { reserveRecordCode } from "@/lib/record-codes";
import { experimentSearchText } from "@/lib/experiment-document";
import { experimentSections, resultSections, scientificDocumentFromSectionText } from "@/lib/scientific-document";
import { createResultInTransaction } from "@/lib/result-creation";
import type { ConsumptionRule, ProtocolMaterial, ProtocolParameter, ProtocolStep, ResultTemplate } from "@/lib/types";
import { normalizeResultTemplates } from "@/lib/result-templates";

type PersistedAttachment = {
  id: string;
  originalFilename: string;
  mimeType: string;
  size: number;
  sha256?: string | null;
};

export type EntryMediaOrderToken = { kind: "existing"; id: string } | { kind: "new"; id: string };

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function parameterDefaults(parameters: ProtocolParameter[]): ProtocolParameterValues {
  return parameters.reduce<ProtocolParameterValues>((values, parameter) => {
    if (parameter.default !== undefined) values[parameter.name] = parameter.default;
    return values;
  }, {});
}

function materialSummary(materials: ProtocolMaterial[]) {
  return materials.map((material) => [material.name, material.unit, material.role].filter(Boolean).join(" / ")).join("\n");
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return cloneJson(value) as Prisma.InputJsonValue;
}

async function resolveContext(
  tx: Prisma.TransactionClient,
  projectId?: string,
  researchPlanId?: string,
) {
  const project = projectId ? await tx.project.findUnique({ where: { id: projectId }, select: { id: true } }) : undefined;
  if (projectId && !project) throw new Error("Selected Project no longer exists.");

  const plan = researchPlanId
    ? await tx.researchPlan.findUnique({ where: { id: researchPlanId }, select: { id: true, projectId: true } })
    : undefined;
  if (researchPlanId && !plan) throw new Error("Selected Research Plan no longer exists.");
  if (projectId && plan && plan.projectId !== projectId) throw new Error("The Research Plan does not belong to the selected Project.");

  return { projectId: projectId ?? plan?.projectId, researchPlanId: plan?.id };
}

async function createAttachmentRecords(
  tx: Prisma.TransactionClient,
  files: PreparedAttachmentFile[],
): Promise<PersistedAttachment[]> {
  const records: PersistedAttachment[] = [];
  for (const file of files) {
    const attachment = await tx.attachment.create({
      data: {
        filename: file.filename,
        originalFilename: file.originalFilename,
        mimeType: file.mimeType,
        size: file.size,
        storagePath: file.storagePath,
        sha256: file.sha256,
        metadataJson: jsonValue(file.metadataJson),
      },
    });
    records.push(attachment);
  }
  return records;
}

async function formalizeProtocolEntry(
  tx: Prisma.TransactionClient,
  entryId: string,
  input: EntryMutationInput,
  context: { projectId?: string; researchPlanId?: string },
) {
  if (!input.protocolVersionId) return;

  const version = await tx.protocolVersion.findUnique({
    where: { id: input.protocolVersionId },
    include: { protocol: true },
  });
  if (!version) throw new Error("Selected Protocol version no longer exists.");

  const parameters = asArray<ProtocolParameter>(version.parametersJson);
  const materials = asArray<ProtocolMaterial>(version.materialsJson);
  const steps = asArray<ProtocolStep>(version.stepsJson);
  const resultTemplates = normalizeResultTemplates(asArray<ResultTemplate>(version.resultTemplatesJson));
  const consumptionRules = asArray<ConsumptionRule>(version.consumptionRulesJson);
  const parameterValues = parameterDefaults(parameters);
  const calculatedConsumption = (() => {
    try {
      return calculateConsumption(consumptionRules, parameterValues);
    } catch {
      return [];
    }
  })();
  const experimentTitle = input.experimentTitle || input.title;
  const projectId = context.projectId ?? version.protocol.projectId ?? undefined;
  const researchPlanId = context.researchPlanId ?? (
    projectId
      ? (await tx.researchPlan.findFirst({
          where: { projectId, status: { in: ["active", "draft"] } },
          orderBy: { updatedAt: "desc" },
          select: { id: true },
        }))?.id
      : undefined
  );
  const runCode = await reserveRecordCode(tx, "experiment");
  // The entry's own text carries over into the Experiment document so the field
  // note and the formal record stay one continuous document, not two copies.
  const experimentDocument = scientificDocumentFromSectionText(experimentSections, {
    background: `Formalized from entry ${entryId}.`,
    setup: materialSummary(materials),
    observations: input.body,
    conclusion: resultTemplates.length
      ? "Result records registered from the protocol template; measurements pending."
      : "Result registration pending.",
  }, "from-entry");

  const experiment = await tx.experiment.create({
    data: {
      runCode,
      title: experimentTitle,
      projectId,
      researchPlanId,
      status: input.experimentStatus,
      recordStatus: "recorded",
      purpose: input.title,
      contentJson: jsonValue(experimentDocument),
      searchText: experimentSearchText(input.title, experimentDocument),
      primaryProtocolVersionId: version.id,
      protocolSnapshotJson: jsonValue({
        schemaVersion: 1,
        capturedAt: new Date().toISOString(),
        versions: [{
          protocolId: version.protocolId,
          protocolVersionId: version.id,
          humanCode: version.protocol.humanCode,
          protocolTitle: version.protocol.canonicalTitle ?? version.protocol.title,
          revision: version.revision,
          displayVersion: version.displayVersion,
          reviewStage: version.reviewStage,
          parametersJson: version.parametersJson,
          materialsJson: version.materialsJson,
          equipmentJson: version.equipmentJson,
          stepsJson: version.stepsJson,
          resultTemplatesJson: version.resultTemplatesJson,
          contentJson: version.contentJson,
        }],
      }),
      tags: Array.from(new Set([...input.tags, "from-entry", "protocol-based"])),
      steps: {
        create: steps.map((step) => ({
          protocolStepRef: String(step.order),
          order: step.order,
          title: step.title,
          description: step.description,
        })),
      },
      protocolVersions: { create: { protocolVersionId: version.id, role: "primary", order: 0 } },
    },
  });

  const protocolRun = await tx.protocolRun.create({
    data: {
      protocolVersionId: version.id,
      experimentId: experiment.id,
      parametersJson: jsonValue(parameterValues),
      calculatedConsumptionJson: jsonValue(calculatedConsumption),
      status: input.experimentStatus,
    },
  });

  await tx.itemLink.createMany({
    data: [
      {
        sourceType: "entry",
        sourceId: entryId,
        targetType: "experiment",
        targetId: experiment.id,
        linkType: "formalized_as",
        createdBy: "user",
        note: "Entry was recorded as a protocol-based formal experiment.",
      },
      {
        sourceType: "experiment",
        sourceId: experiment.id,
        targetType: "protocol_version",
        targetId: version.id,
        linkType: "derived_from",
        createdBy: "system",
        note: "Experiment was created from a locked Protocol version.",
      },
    ],
  });

  if (calculatedConsumption.length) {
    await tx.proposedAction.createMany({
      data: calculatedConsumption.map((item) => ({
        sourceType: "protocol" as const,
        sourceId: protocolRun.id,
        actionType: "consume_inventory" as const,
        status: "pending" as const,
        confidence: 1,
        reason: `Calculated from ${item.formula}; review inventory source before execution.`,
        payloadJson: {
          protocol_run_id: protocolRun.id,
          experiment_id: experiment.id,
          material_name: item.materialName,
          quantity_change: -item.quantity,
          unit: item.unit,
          requires_inventory_selection: item.requiresInventorySelection,
        },
      })),
    });
  }

  if (input.createInitialResult) {
    await createResultInTransaction(tx, {
      experimentId: experiment.id,
      title: input.resultTitle || `${experimentTitle} result`,
      resultType: input.resultType || "manual_result",
      recordStatus: "recorded",
      sourceType: "manual",
      qualityStatus: "not_assessed",
      origin: { kind: "entry", entryId, includeAttachments: true },
      templateProtocolVersionId: version.id,
      contentJson: jsonValue(scientificDocumentFromSectionText(resultSections, { summary: input.contentMarkdown }, `entry-${entryId}`)),
      textValue: input.resultTextValue,
      notes: input.resultNotes,
    });
  }
}

export async function createEntryWithFiles(input: EntryMutationInput, files: File[]) {
  if (input.clientMutationId) {
    const replay = await prisma.entry.findUnique({ where: { clientMutationId: input.clientMutationId }, select: { id: true } });
    if (replay) return replay;
  }
  const prepared = await Promise.all(files.map((file) => prepareAttachmentFile(file)));

  try {
    await writePreparedAttachmentFiles(prepared);
    return await prisma.$transaction(async (tx) => {
      const context = await resolveContext(tx, input.projectId, input.researchPlanId);
      const entry = await tx.entry.create({
        data: {
          title: input.title,
          body: input.body,
          occurredAt: input.occurredAt,
          projectId: context.projectId,
          researchPlanId: context.researchPlanId,
          tags: input.tags,
          sourceType: input.sourceType,
          recordStatus: input.recordStatus,
          moodStatus: input.moodStatus,
          clientMutationId: input.clientMutationId,
          deviceCreatedAt: input.deviceCreatedAt,
          contentJson: jsonValue(buildEntryContent(input.contentMarkdown, [])),
        },
      });
      const attachments = await createAttachmentRecords(tx, prepared);
      const content = buildEntryContent(input.contentMarkdown, attachments);

      if (attachments.length) {
        await tx.attachmentLink.createMany({
          data: attachments.map((attachment, order) => ({
            attachmentId: attachment.id,
            targetType: "entry",
            targetId: entry.id,
            linkType: "entry_content",
            order,
          })),
        });
        await tx.entry.update({ where: { id: entry.id }, data: { contentJson: jsonValue(content) } });
      }

      await formalizeProtocolEntry(tx, entry.id, input, context);
      await tx.activityLog.create({
        data: {
          action: "create",
          targetType: "entry",
          targetId: entry.id,
          metadataJson: {
            attachmentCount: attachments.length,
            attachmentIds: attachments.map((attachment) => attachment.id),
            attachmentSha256: attachments.flatMap((attachment) => attachment.sha256 ? [attachment.sha256] : []),
            sourceType: input.sourceType,
            recordStatus: input.recordStatus,
            clientMutationId: input.clientMutationId ?? null,
            deviceCreatedAt: input.deviceCreatedAt?.toISOString() ?? null,
          },
        },
      });
      return { id: entry.id };
    });
  } catch (error) {
    await cleanupPreparedAttachmentFiles(prepared);
    if (input.clientMutationId && typeof error === "object" && error && "code" in error && error.code === "P2002") {
      const replay = await prisma.entry.findUnique({ where: { clientMutationId: input.clientMutationId }, select: { id: true } });
      if (replay) return replay;
    }
    throw error;
  }
}

export async function updateEntryWithFiles(
  entryId: string,
  input: EntryMutationInput,
  newFiles: File[],
  newFileIds: string[],
  order: EntryMediaOrderToken[],
) {
  if (newFiles.length !== newFileIds.length) throw new Error("New attachment order is invalid.");
  const prepared = await Promise.all(newFiles.map((file) => prepareAttachmentFile(file)));

  try {
    await writePreparedAttachmentFiles(prepared);
    return await prisma.$transaction(async (tx) => {
      const current = await tx.entry.findUnique({ where: { id: entryId } });
      if (!current) throw new Error("Entry no longer exists.");
      const context = await resolveContext(tx, input.projectId, input.researchPlanId);
      const existingLinks = await tx.attachmentLink.findMany({
        where: { targetType: "entry", targetId: entryId },
        include: { attachment: true },
      });
      const existingMap = new Map(existingLinks.map((link) => [link.attachmentId, link.attachment]));
      const created = await createAttachmentRecords(tx, prepared);
      const newMap = new Map(newFileIds.map((id, index) => [id, created[index]]));
      const orderedAttachments: PersistedAttachment[] = [];
      const seen = new Set<string>();

      order.forEach((token) => {
        const attachment = token.kind === "existing" ? existingMap.get(token.id) : newMap.get(token.id);
        if (!attachment) throw new Error("An attachment changed while this Entry was being edited.");
        if (seen.has(attachment.id)) throw new Error("Attachment order contains duplicates.");
        seen.add(attachment.id);
        orderedAttachments.push(attachment);
      });
      if (created.some((attachment) => !seen.has(attachment.id))) throw new Error("One or more new files are missing from the Entry order.");
      if (orderedAttachments.length > MAX_ENTRY_FILES) throw new Error(`An Entry can contain at most ${MAX_ENTRY_FILES} files.`);
      if (orderedAttachments.reduce((total, attachment) => total + attachment.size, 0) > MAX_ENTRY_TOTAL_BYTES) {
        throw new Error("Combined Entry attachments cannot exceed 100 MB.");
      }

      const content = buildEntryContent(input.contentMarkdown, orderedAttachments);
      await tx.entry.update({
        where: { id: entryId },
        data: {
          title: input.title,
          body: input.body,
          occurredAt: input.occurredAt,
          projectId: context.projectId,
          researchPlanId: context.researchPlanId,
          tags: input.tags,
          sourceType: input.sourceType,
          recordStatus: input.recordStatus,
          moodStatus: input.moodStatus,
          contentJson: jsonValue(content),
        },
      });
      await tx.attachmentLink.deleteMany({ where: { targetType: "entry", targetId: entryId } });
      if (orderedAttachments.length) {
        await tx.attachmentLink.createMany({
          data: orderedAttachments.map((attachment, attachmentOrder) => ({
            attachmentId: attachment.id,
            targetType: "entry",
            targetId: entryId,
            linkType: "entry_content",
            order: attachmentOrder,
          })),
        });
      }

      const keptExisting = new Set(orderedAttachments.map((attachment) => attachment.id));
      const removedAttachmentIds = existingLinks.map((link) => link.attachmentId).filter((id) => !keptExisting.has(id));
      await tx.activityLog.create({
        data: {
          action: "update",
          targetType: "entry",
          targetId: entryId,
          metadataJson: {
            addedAttachmentIds: created.map((attachment) => attachment.id),
            removedAttachmentIds,
            attachmentCount: orderedAttachments.length,
            previousUpdatedAt: current.updatedAt.toISOString(),
          },
        },
      });
      return { id: entryId };
    });
  } catch (error) {
    await cleanupPreparedAttachmentFiles(prepared);
    throw error;
  }
}
