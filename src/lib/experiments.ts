import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { createScientificDocument, resultSections } from "@/lib/scientific-document";
import type { ProtocolStep, ResultTemplate } from "@/lib/types";

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

export async function createExperimentWithProtocolSnapshot(input: {
  researchPlanId: string;
  runCode?: string;
  title: string;
  date: Date;
  status: "planned" | "running" | "completed" | "failed" | "archived";
  recordStatus: "draft" | "recorded" | "submitted" | "reviewed";
  purpose?: string;
  background?: string;
  materialsText?: string;
  stepsText?: string;
  observations?: string;
  resultSummary?: string;
  conclusion?: string;
  deviations?: string;
  tags: string[];
  contentJson: Prisma.InputJsonValue;
  primaryProtocolVersionId: string;
  supportingProtocolVersionIds: string[];
  createResultTemplates: boolean;
}) {
  const plan = await prisma.researchPlan.findUnique({
    where: { id: input.researchPlanId },
    include: { project: true, protocols: { select: { protocolId: true } } },
  });
  if (!plan) throw new Error("Selected Research Plan does not exist.");

  const versionIds = Array.from(new Set([input.primaryProtocolVersionId, ...input.supportingProtocolVersionIds])).filter(Boolean);
  const versions = await prisma.protocolVersion.findMany({
    where: { id: { in: versionIds } },
    include: { protocol: true },
  });
  if (versions.length !== versionIds.length) throw new Error("One or more selected ProtocolVersions no longer exist.");
  const allowedProtocols = new Set(plan.protocols.map((link) => link.protocolId));
  const unlinked = versions.find((version) => !allowedProtocols.has(version.protocolId));
  if (unlinked) throw new Error(`${unlinked.protocol.humanCode ?? unlinked.protocol.title} is not associated with this Research Plan.`);
  const primary = versions.find((version) => version.id === input.primaryProtocolVersionId);
  if (!primary) throw new Error("A primary ProtocolVersion is required.");

  const primarySteps = asArray<ProtocolStep>(primary.stepsJson);
  const resultTemplates = asArray<ResultTemplate>(primary.resultTemplatesJson);
  const snapshot = {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    versions: versions.map((version) => ({
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

  return prisma.$transaction(async (tx) => {
    const experiment = await tx.experiment.create({
      data: {
        runCode: input.runCode,
        title: input.title,
        projectId: plan.projectId,
        researchPlanId: plan.id,
        date: input.date,
        status: input.status,
        recordStatus: input.recordStatus,
        purpose: input.purpose,
        background: input.background,
        materialsText: input.materialsText,
        stepsText: input.stepsText,
        observations: input.observations,
        resultSummary: input.resultSummary,
        conclusion: input.conclusion,
        deviations: input.deviations,
        tags: input.tags,
        contentJson: input.contentJson,
        protocolSnapshotJson: snapshot,
        primaryProtocolVersionId: primary.id,
        protocolVersions: {
          create: versionIds.map((versionId, order) => ({
            protocolVersionId: versionId,
            role: versionId === primary.id ? "primary" : "supporting",
            order,
          })),
        },
        steps: {
          create: primarySteps.map((step, index) => ({
            protocolStepRef: String(step.order ?? index + 1),
            order: step.order ?? index + 1,
            title: step.title || `Step ${index + 1}`,
            description: step.description ?? "",
          })),
        },
      },
    });

    await tx.protocolRun.create({
      data: { protocolVersionId: primary.id, experimentId: experiment.id, status: input.status, parametersJson: {}, calculatedConsumptionJson: [] },
    });
    await tx.itemLink.create({
      data: { sourceType: "experiment", sourceId: experiment.id, targetType: "protocol_version", targetId: primary.id, linkType: "executed_from", createdBy: "system", note: "Exact ProtocolVersion locked at experiment creation." },
    });

    if (input.createResultTemplates && resultTemplates.length) {
      await tx.result.createMany({
        data: resultTemplates.map((template) => {
          const content = createScientificDocument(resultSections);
          content.sections[0].blocks.push({ id: "template-summary", type: "text", text: "Result record created from the primary ProtocolVersion template. Measurement pending." });
          return {
            experimentId: experiment.id,
            projectId: plan.projectId,
            researchPlanId: plan.id,
            resultType: template.result_type,
            title: `${input.title} · ${template.result_type}`,
            recordStatus: "draft" as const,
            sourceType: "protocol_template" as const,
            qualityStatus: "not_assessed" as const,
            contentJson: content,
            metadataJson: { protocolVersionId: primary.id, templateFields: template.fields },
            provenanceJson: { experimentId: experiment.id, protocolVersionId: primary.id },
            notes: "Template registered; no measurement has been entered.",
          };
        }),
      });
    }
    await tx.activityLog.create({ data: { action: "create", targetType: "experiment", targetId: experiment.id, metadataJson: { researchPlanId: plan.id, protocolVersionIds: versionIds } } });
    return experiment;
  });
}
