"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { formActionErrorMessage } from "@/lib/form-actions";
import { normalizeProtocolDocument, projectProtocolDocument } from "@/lib/protocol-document";
import { nextDisplayVersion } from "@/lib/protocol";
import { revisionCandidates, revisionFromExperiment } from "@/lib/protocol-revision";
import { structuredRunView } from "@/lib/structured-run";

export type ReviseState = { error?: string };
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

/**
 * 整理成规程修订: the chosen actual values and deviation notes of this Experiment become a new draft version of
 * each Protocol it used, derived from the version it ran. The run and the version it used stay as they are.
 */
export async function createRevisionFromExperiment(_previous: ReviseState, formData: FormData): Promise<ReviseState> {
  const experimentId = String(formData.get("experimentId") ?? "");
  const keys = new Set(formData.getAll("adopt").map(String));
  let target: { protocolId: string; versionId: string } | undefined;
  try {
    const experiment = await prisma.experiment.findUnique({ where: { id: experimentId }, include: { protocolRun: true, steps: true } });
    if (!experiment) throw new Error("实验不存在");
    const view = structuredRunView(experiment.protocolSnapshotJson, experiment.protocolRun?.executionPlanJson, experiment.steps);
    const chosen = revisionCandidates(view, experiment.steps).filter(candidate => keys.has(candidate.key));
    if (!chosen.length) throw new Error("请至少选择一项要采纳的内容");
    const bySource = new Map<string, typeof chosen>();
    for (const candidate of chosen) bySource.set(candidate.sourceVersionId, [...(bySource.get(candidate.sourceVersionId) ?? []), candidate]);
    for (const [sourceVersionId, group] of bySource) {
      const created = await prisma.$transaction(async tx => {
        const source = await tx.protocolVersion.findUnique({ where: { id: sourceVersionId }, include: { protocol: true } });
        if (!source) throw new Error("本次实验所用的规程版本已不存在");
        await tx.$queryRaw`SELECT id FROM "Protocol" WHERE id=${source.protocolId} FOR UPDATE`;
        const document = normalizeProtocolDocument(source.contentJson);
        if (!document) throw new Error(`${source.protocol.humanCode} 是旧格式规程，请先在编辑器中打开并保存，再整理`);
        const { document: revised, changes } = revisionFromExperiment(document, { id: experiment.id, runCode: experiment.runCode }, group.map(candidate => candidate.adoption));
        const latest = await tx.protocolVersion.findFirst({ where: { protocolId: source.protocolId }, orderBy: { revision: "desc" } });
        const taken = new Set((await tx.protocolVersion.findMany({ where: { protocolId: source.protocolId }, select: { displayVersion: true } })).map(version => version.displayVersion));
        let displayVersion = nextDisplayVersion(latest?.displayVersion ?? source.displayVersion);
        while (taken.has(displayVersion)) displayVersion = nextDisplayVersion(displayVersion);
        const projection = projectProtocolDocument(revised);
        const title = source.protocol.canonicalTitle ?? source.protocol.title;
        const version = await tx.protocolVersion.create({ data: {
          protocolId: source.protocolId, revision: (latest?.revision ?? source.revision) + 1, previousVersionId: source.id, sourceType: "manual",
          reviewStage: "draft", recordStatus: "draft", displayVersion, title: `${title} v${displayVersion}`,
          scope: source.scope, notes: source.notes, parametersJson: json(source.parametersJson), adaptationRationale: source.adaptationRationale,
          purpose: projection.purpose, background: projection.background, materialsJson: json(projection.materials), equipmentJson: json(projection.equipment), stepsJson: json(projection.steps),
          resultTemplatesJson: json(projection.resultTemplates), consumptionRulesJson: json(projection.consumptionRules), contentJson: json(revised),
          changeSummary: `来自 ${experiment.runCode} 的整理：${changes.join("；")}`,
        } });
        const inherited = await tx.attachmentLink.findMany({ where: { targetType: "protocol_version", targetId: source.id }, select: { attachmentId: true, linkType: true, order: true } });
        if (inherited.length) await tx.attachmentLink.createMany({ data: inherited.map(link => ({ ...link, targetType: "protocol_version", targetId: version.id })) });
        await tx.activityLog.create({ data: { action: "create_revision", targetType: "protocol", targetId: source.protocolId, metadataJson: json({ sourceVersionId: source.id, savedVersionId: version.id, displayVersion, fromExperimentId: experiment.id, changes }) } });
        await tx.activityLog.create({ data: { action: "experiment_tidied_into_revision", targetType: "experiment", targetId: experiment.id, metadataJson: json({ protocolId: source.protocolId, versionId: version.id, displayVersion, adopted: group.map(candidate => candidate.key) }) } });
        return { protocolId: source.protocolId, versionId: version.id };
      });
      target ??= created;
      revalidatePath(`/protocols/${created.protocolId}`);
    }
    revalidatePath(`/experiments/${experimentId}`);
  } catch (error) {
    return { error: formActionErrorMessage(error, "未能生成修订，请重试") };
  }
  // The first new draft opens in the editor; a run of several Protocols lists the rest on its Protocol pages.
  redirect(`/protocols/${target!.protocolId}/versions/${target!.versionId}/edit`);
}
