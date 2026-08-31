import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { experimentSearchText } from "@/lib/experiment-document";
import { buildProtocolExperimentSteps } from "@/lib/experiment-planning";
import { isValidRecordCode, reserveRecordCode } from "@/lib/record-codes";
import type { ProtocolStep } from "@/lib/types";

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

export type ExperimentSnapshotInput = {
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
    methodMode: input.methodMode,
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
      stepsJson: cloneJson(version.stepsJson),
      resultTemplatesJson: cloneJson(version.resultTemplatesJson),
      contentJson: cloneJson(version.contentJson),
    })),
  };

  const experiment = await tx.experiment.create({
      data: {
        runCode,
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
              }))
            : buildProtocolExperimentSteps(orderedVersions.map((version) => ({
                versionId: version.id,
                humanCode: version.protocol.humanCode,
                protocolTitle: version.protocol.title,
                versionTitle: version.title,
                displayVersion: version.displayVersion,
                steps: asArray<ProtocolStep>(version.stepsJson),
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
  return experiment;
}

export async function createExperimentWithProtocolSnapshot(input: ExperimentSnapshotInput) {
  return prisma.$transaction((tx) => createExperimentWithProtocolSnapshotInTransaction(tx, input));
}
