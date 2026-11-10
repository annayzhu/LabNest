import { prisma } from "./db";
import { normalizeProtocolDocument, projectProtocolDocument } from "./protocol-document";
import type { ExperimentProtocolVersionOption } from "@/components/ExperimentProtocolPicker";

/** The Protocol versions an experiment can follow, for the method chooser of a new experiment and of a day (Q428). */
export async function loadProtocolVersionOptions(): Promise<ExperimentProtocolVersionOption[]> {
  const rows = await prisma.protocolVersion.findMany({ where: { protocol: { availability: { not: "archived" } } }, include: { protocol: { include: { researchPlans: { select: { researchPlanId: true } }, project: { select: { name: true } } } } }, orderBy: [{ protocol: { title: "asc" } }, { revision: "desc" }] });
  return rows.map((version) => {
    const document = normalizeProtocolDocument(version.contentJson);
    const execution = document ? { ...projectProtocolDocument(document), systems: document.systems } : { steps: [], commonBlocks: [], notePlacement: {}, executionNeedsReview: true };
    return { hasSystems: Boolean(document?.systems), execution, id: version.id, researchPlanIds: version.protocol.researchPlans.map(link => link.researchPlanId), revision: version.revision, displayVersion: version.displayVersion, versionTitle: version.title, reviewStage: version.reviewStage, stepCount: execution.steps.length, protocol: { id: version.protocol.id, humanCode: version.protocol.humanCode, title: version.protocol.canonicalTitle ?? version.protocol.title, scope: version.protocol.scope, projectName: version.protocol.project?.name ?? null } } as ExperimentProtocolVersionOption;
  });
}
