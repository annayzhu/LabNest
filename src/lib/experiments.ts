import { createHash } from "node:crypto";
import { normalizeProtocolDocument, projectProtocolDocument } from "./protocol-document";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { associateDocumentMedia } from "@/lib/document-media.server";
import { experimentSearchText } from "@/lib/experiment-document";
import { buildProtocolExperimentSteps } from "@/lib/experiment-planning";
import { isValidRecordCode, reserveRecordCode } from "@/lib/record-codes";
import type { ProtocolStep } from "@/lib/types";

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}


export type ExperimentSnapshotInput = {
  creationKey?: string;
  researchPlanId: string;
  runCode?: string;
  title: string;
  date: Date;
  status: "planned" | "running" | "completed" | "failed" | "archived";
  recordStatus: "draft" | "recorded" | "submitted" | "reviewed";
  purpose?: string;
  tags: string[];
  contentJson: Prisma.InputJsonValue;
  methodMode: "protocol" | "custom";
  protocolVersionIds: string[];
  customSteps: ProtocolStep[];
};

export async function createExperimentWithProtocolSnapshotInTransaction(
  tx: Prisma.TransactionClient,
  input: ExperimentSnapshotInput,
) {
  const fingerprint = createHash("sha256").update(JSON.stringify({...input,creationKey:undefined})).digest("hex");
  if(input.creationKey) {
    const previous=await tx.experiment.findUnique({where:{creationKey:input.creationKey}});
    if(previous) {
      if((previous.protocolSnapshotJson as {creationFingerprint?:string}).creationFingerprint!==fingerprint)throw new Error("This creation request was already used for different Experiment data.");
      return previous;
    }
  }
  const plan = await tx.researchPlan.findUnique({
    where: { id: input.researchPlanId },
    include: { project: true, protocols: { select: { protocolId: true } } },
  });
  if (!plan) throw new Error("Selected Research Plan does not exist.");

  const versionIds = Array.from(new Set(input.protocolVersionIds)).filter(Boolean);
  if (input.methodMode === "protocol" && !versionIds.length) {
    throw new Error("Select at least one ProtocolVersion or choose a fully custom Experiment.");
  }
  if (input.methodMode === "custom" && versionIds.length) {
    throw new Error("A fully custom Experiment cannot submit locked ProtocolVersions.");
  }
  const versions = await tx.protocolVersion.findMany({
    where: { id: { in: versionIds } },
    include: { protocol: true },
  });
  if (versions.length !== versionIds.length) throw new Error("One or more selected ProtocolVersions no longer exist.");
  const versionMap = new Map(versions.map((version) => [version.id, version]));
  const orderedVersions = versionIds.map((id) => versionMap.get(id)!);
  const primary = orderedVersions[0];
  const contracts=new Map(orderedVersions.map(version=>{
    const document=normalizeProtocolDocument(version.contentJson);
    const projection=document?projectProtocolDocument(document):undefined;
    if(!projection || projection.executionNeedsReview)throw new Error(`${version.protocol.humanCode}: confirm execution ownership in the Protocol editor before creating a new Experiment.`);
    return [version.id,projection] as const;
  }));

  if(input.methodMode==="protocol" && [...contracts.values()].every(contract=>!contract.steps.length))throw new Error("No execution operations are confirmed. Organize the Protocol steps or select a custom freeform Experiment.");

  if (orderedVersions.length) {
    const protocolIds = Array.from(new Set(orderedVersions.map((version) => version.protocolId)));
    await tx.projectProtocol.createMany({
      data: protocolIds.map((protocolId) => ({ projectId: plan.projectId, protocolId })),
      skipDuplicates: true,
    });
    await tx.researchPlanProtocol.createMany({
      data: protocolIds.map((protocolId) => ({ researchPlanId: plan.id, protocolId, isPrimary: false })),
      skipDuplicates: true,
    });
  }
  const suppliedRunCode = input.runCode?.trim().toUpperCase();
  if (suppliedRunCode && !isValidRecordCode("experiment", suppliedRunCode)) {
    throw new Error("Experiment code must use EXP- followed by at least three digits.");
  }
  const runCode = suppliedRunCode ?? await reserveRecordCode(tx, "experiment");
  if (suppliedRunCode) {
    const duplicate = await tx.experiment.findUnique({ where: { runCode }, select: { id: true } });
    if (duplicate) throw new Error(`${runCode} is already in use. Enter a different suffix.`);
  }
  const snapshot = {
    schemaVersion: 1,
    ...(input.creationKey?{creationFingerprint:fingerprint}:{}),
    methodMode: input.methodMode,
    researchPlanTitle: plan.title,
    capturedAt: new Date().toISOString(),
    versions: orderedVersions.map((version) => ({
      protocolId: version.protocolId,
      protocolVersionId: version.id,
      humanCode: version.protocol.humanCode,
      protocolTitle: version.protocol.canonicalTitle ?? version.protocol.title,
      revision: version.revision,
      displayVersion: version.displayVersion,
      reviewStage: version.reviewStage,
      parametersJson: cloneJson(version.parametersJson),
      materialsJson: cloneJson(version.materialsJson),
      equipmentJson: cloneJson(version.equipmentJson),
      stepsJson: cloneJson(contracts.get(version.id)!.steps),
      resultTemplatesJson: cloneJson(version.resultTemplatesJson),
      contentJson: cloneJson(version.contentJson),
    })),
  };

  const experiment = await tx.experiment.create({
      data: {
        runCode,
        creationKey: input.creationKey,
        title: input.title,
        projectId: plan.projectId,
        researchPlanId: plan.id,
        date: input.date,
        status: input.status,
        recordStatus: input.recordStatus,
        purpose: input.purpose,
        tags: input.tags,
        contentJson: input.contentJson,
        searchText: experimentSearchText(input.purpose, input.contentJson),
        protocolSnapshotJson: snapshot,
        primaryProtocolVersionId: primary?.id,
        protocolVersions: versionIds.length ? {
          create: versionIds.map((versionId, order) => ({
            protocolVersionId: versionId,
            role: versionId === primary?.id ? "primary" : "supporting",
            order,
          })),
        } : undefined,
        steps: {
          create: input.methodMode === "custom"
            ? input.customSteps.map((step, index) => ({
                protocolStepRef: `manual:${index + 1}`,
                groupKey: "manual",
                groupTitle: "Custom experiment steps",
                groupOrder: 0,
                order: step.order ?? index + 1,
                title: step.title || `Step ${index + 1}`,
                description: step.description ?? "",
                requiresConfirmation: step.requires_confirmation ?? true,
                allowsDeviation: step.allows_deviation ?? true,
              }))
            : buildProtocolExperimentSteps(orderedVersions.map((version) => ({
                versionId: version.id,
                humanCode: version.protocol.humanCode,
                protocolTitle: version.protocol.title,
                versionTitle: version.title,
                displayVersion: version.displayVersion,
                steps: contracts.get(version.id)!.steps,
              }))),
        },
      },
    });

    if (primary) {
      await tx.protocolRun.create({
        data: { protocolVersionId: primary.id, experimentId: experiment.id, status: input.status, parametersJson: {}, calculatedConsumptionJson: [] },
      });
      await tx.itemLink.createMany({
        data: orderedVersions.map((version, order) => ({ sourceType: "experiment", sourceId: experiment.id, targetType: "protocol_version", targetId: version.id, linkType: "executed_from", createdBy: "system", note: `Protocol execution order ${order + 1}; exact version locked at experiment creation.` })),
      });
    }

    await tx.activityLog.create({ data: { action: "create", targetType: "experiment", targetId: experiment.id, metadataJson: { runCode, researchPlanId: plan.id, methodMode: input.methodMode, protocolVersionIds: versionIds } } });
  await associateDocumentMedia(tx, [input.contentJson, experiment.protocolSnapshotJson], "experiment", experiment.id);
  return experiment;
}

export async function createExperimentWithProtocolSnapshot(input: ExperimentSnapshotInput) {
  try {return await prisma.$transaction((tx) => createExperimentWithProtocolSnapshotInTransaction(tx, input));}
  catch(error) {
    if(input.creationKey && error && typeof error==='object' && 'code' in error && error.code==='P2002') {
      // A racing retry reuses the durable unique request rather than allocating more steps/files.
      return prisma.$transaction(tx=>createExperimentWithProtocolSnapshotInTransaction(tx,input));
    }
    throw error;
  }
}
