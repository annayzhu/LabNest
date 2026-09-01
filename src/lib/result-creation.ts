import type { Prisma } from "@/generated/prisma/client";
import type { RecordLifecycleStatus, ResultQualityStatus, ResultSourceType } from "@/generated/prisma/enums";
import { buildExperimentResultReportTemplate, EXPERIMENT_RESULT_REPORT_KEY, experimentResultModules, isSingleResultTemplate } from "@/lib/experiment-results";
import { normalizeResultTemplates, validateResultRecord } from "@/lib/result-templates";
import { createScientificDocument, resultSections } from "@/lib/scientific-document";

type ResultOrigin =
  | { kind: "manual"; requireManagedResultType?: boolean }
  | { kind: "structured_import"; sourceMetadata: Record<string, string> }
  | { kind: "entry"; entryId: string; includeAttachments?: boolean };

export type ResultCreationRequest = {
  experimentId: string;
  title: string;
  resultType: string;
  recordStatus: RecordLifecycleStatus;
  sourceType: ResultSourceType;
  qualityStatus: ResultQualityStatus;
  origin: ResultOrigin;
  templateKey?: string;
  templateProtocolVersionId?: string;
  templateModuleIds?: string[];
  templateInstanceKey?: string;
  templateInstanceLabel?: string;
  valuesJson?: Prisma.InputJsonValue;
  contentJson?: Prisma.InputJsonValue;
  textValue?: string | null;
  numericValue?: number | null;
  unit?: string | null;
  analysisMethod?: string | null;
  notes?: string | null;
  metadataJson?: Record<string, unknown>;
  provenanceJson?: Record<string, unknown>;
};

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function createResultInTransaction(
  tx: Prisma.TransactionClient,
  request: ResultCreationRequest,
) {
  const experiment = await tx.experiment.findUnique({
    where: { id: request.experimentId },
    select: {
      id: true,
      projectId: true,
      researchPlanId: true,
      protocolVersions: {
        orderBy: { order: "asc" },
        select: {
          protocolVersionId: true,
          protocolVersion: { select: { displayVersion: true, resultTemplatesJson: true, protocol: { select: { humanCode: true, canonicalTitle: true, title: true } } } },
        },
      },
    },
  });
  if (!experiment) throw new Error("Selected Experiment does not exist.");

  const templateVersionLink = request.templateKey
    ? request.templateProtocolVersionId
      ? experiment.protocolVersions.find((link) => link.protocolVersionId === request.templateProtocolVersionId)
      : experiment.protocolVersions.find((link) => normalizeResultTemplates(link.protocolVersion.resultTemplatesJson).some((item) => item.templateKey === request.templateKey))
    : undefined;
  const lockedModules = experimentResultModules(experiment.protocolVersions.map((link) => ({
    protocolVersionId: link.protocolVersionId,
    protocolCode: link.protocolVersion.protocol.humanCode,
    protocolTitle: link.protocolVersion.protocol.canonicalTitle ?? link.protocolVersion.protocol.title,
    displayVersion: link.protocolVersion.displayVersion,
    resultTemplatesJson: link.protocolVersion.resultTemplatesJson,
  })));
  if (request.templateModuleIds?.some((id) => !lockedModules.some((module) => module.id === id))) {
    throw new Error("One or more selected Result modules are not part of this Experiment.");
  }
  if (request.templateModuleIds && !request.templateModuleIds.length) throw new Error("Choose at least one Result module.");
  const reportTemplate = request.templateModuleIds
    ? buildExperimentResultReportTemplate(lockedModules, request.templateModuleIds)
    : undefined;
  const template = reportTemplate ?? (request.templateKey
    ? normalizeResultTemplates(templateVersionLink?.protocolVersion.resultTemplatesJson).find((item) => item.templateKey === request.templateKey)
    : undefined);
  if (request.templateKey && request.templateKey !== EXPERIMENT_RESULT_REPORT_KEY && (!template || !templateVersionLink)) {
    throw new Error("The selected Result Template is not part of this Experiment's locked ProtocolVersions.");
  }

  if (reportTemplate) {
    const existingReport = await tx.result.findFirst({ where: { experimentId: experiment.id, templateKey: EXPERIMENT_RESULT_REPORT_KEY, status: { not: "archived" } }, select: { id: true, title: true } });
    if (existingReport) throw new Error(`This Experiment already has a Result (${existingReport.title}). Open the existing Result instead.`);
  }

  if (template && templateVersionLink && isSingleResultTemplate(template)) {
    const existing = await tx.result.findFirst({
      where: {
        experimentId: experiment.id,
        protocolVersionId: templateVersionLink.protocolVersionId,
        templateKey: template.templateKey,
        sourceType: "protocol_template",
        status: { not: "archived" },
      },
      select: { id: true, title: true },
    });
    if (existing) throw new Error(`This Protocol template already has a Result record (${existing.title}). Open the existing record instead of creating a duplicate.`);
  }

  if (!template && request.origin.kind === "manual" && request.origin.requireManagedResultType) {
    const typeDefinition = await tx.resultTypeDefinition.findUnique({ where: { label: request.resultType }, select: { id: true } });
    if (!typeDefinition) throw new Error("Choose an available Result type or add it in Manage types.");
  }

  const entry = request.origin.kind === "entry"
    ? await tx.entry.findUnique({
        where: { id: request.origin.entryId },
        select: { id: true, projectId: true, researchPlanId: true, occurredAt: true },
      })
    : undefined;
  if (request.origin.kind === "entry" && !entry) throw new Error("Selected Entry does not exist.");
  if (entry?.projectId && entry.projectId !== experiment.projectId) throw new Error("The Entry and Experiment belong to different Projects.");
  if (entry?.researchPlanId && entry.researchPlanId !== experiment.researchPlanId) throw new Error("The Entry and Experiment belong to different Research Plans.");

  const values = request.valuesJson ?? {};
  const validation = validateResultRecord({ template, values, instanceKey: request.templateInstanceKey });
  if (["submitted", "reviewed"].includes(request.recordStatus) && !validation.complete) {
    throw new Error(`This Result cannot be ${request.recordStatus}: ${validation.errors.join(" ")}`);
  }

  const protocolVersionId = reportTemplate ? undefined : template ? templateVersionLink?.protocolVersionId : request.templateProtocolVersionId;
  const sourceMetadata = request.origin.kind === "structured_import" ? request.origin.sourceMetadata : {};
  const result = await tx.result.create({
    data: {
      experimentId: experiment.id,
      projectId: experiment.projectId,
      researchPlanId: experiment.researchPlanId,
      protocolVersionId,
      title: request.title,
      resultType: template?.result_type ?? request.resultType,
      recordStatus: request.recordStatus,
      sourceType: template ? "protocol_template" : request.sourceType,
      qualityStatus: request.qualityStatus,
      templateKey: template?.templateKey,
      templateInstanceKey: template ? request.templateInstanceKey : undefined,
      templateInstanceLabel: template ? request.templateInstanceLabel : undefined,
      templateSnapshotJson: jsonValue(template ?? {}),
      valuesJson: jsonValue(values),
      validationStatus: validation.status,
      validationJson: jsonValue(validation),
      viewSpecJson: jsonValue(template?.view ?? {}),
      textValue: request.textValue,
      numericValue: request.numericValue,
      unit: request.unit,
      analysisMethod: request.analysisMethod,
      notes: request.notes,
      contentJson: request.contentJson ?? jsonValue(createScientificDocument(resultSections)),
      provenanceJson: jsonValue({
        ...request.provenanceJson,
        ...sourceMetadata,
        experimentId: experiment.id,
        projectId: experiment.projectId,
        researchPlanId: experiment.researchPlanId,
        protocolVersionId,
        ...(entry ? { sourceEntryId: entry.id, sourceEntryOccurredAt: entry.occurredAt.toISOString() } : {}),
      }),
      metadataJson: jsonValue({
        ...request.metadataJson,
        ...(template ? { templateKey: template.templateKey, cardinality: template.cardinality, viewPreset: template.view?.preset } : {}),
        ...(reportTemplate ? { moduleIds: request.templateModuleIds } : {}),
        ...(entry ? { sourceEntryId: entry.id } : {}),
      }),
    },
  });

  const itemLinks: Prisma.ItemLinkCreateManyInput[] = [{
    sourceType: "result",
    sourceId: result.id,
    targetType: "experiment",
    targetId: experiment.id,
    linkType: "produced_by",
    createdBy: "system",
  }];
  if (entry) itemLinks.push({
    sourceType: "result",
    sourceId: result.id,
    targetType: "entry",
    targetId: entry.id,
    linkType: "derived_from",
    createdBy: "user",
  });
  await tx.itemLink.createMany({ data: itemLinks });

  let attachmentCount = 0;
  if (entry && request.origin.kind === "entry" && request.origin.includeAttachments) {
    const sourceLinks = await tx.attachmentLink.findMany({
      where: { targetType: "entry", targetId: entry.id },
      select: { attachmentId: true, order: true },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });
    attachmentCount = sourceLinks.length;
    if (sourceLinks.length) await tx.attachmentLink.createMany({
      data: sourceLinks.map((link, index) => ({
        attachmentId: link.attachmentId,
        targetType: "result",
        targetId: result.id,
        linkType: "source_evidence",
        order: link.order ?? index,
      })),
    });
  }

  await tx.activityLog.create({
    data: {
      action: request.origin.kind === "structured_import" ? "structured_import" : "create",
      targetType: "result",
      targetId: result.id,
      metadataJson: jsonValue({
        experimentId: experiment.id,
        sourceType: template ? "protocol_template" : request.sourceType,
        origin: request.origin.kind,
        ...(entry ? { sourceEntryId: entry.id, attachmentCount } : {}),
        ...sourceMetadata,
      }),
    },
  });

  return { resultId: result.id, experimentId: experiment.id, researchPlanId: experiment.researchPlanId };
}
