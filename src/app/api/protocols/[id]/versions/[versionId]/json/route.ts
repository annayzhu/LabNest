import { prisma } from "@/lib/db";
import { normalizeProtocolDocument, projectProtocolDocument, protocolDocumentFromLegacy } from "@/lib/protocol-document";
import type { ConsumptionRule, ProtocolMaterial, ProtocolStep, ResultTemplate } from "@/lib/types";

function asArray<T>(value: unknown): T[] { return Array.isArray(value) ? value as T[] : []; }

export async function GET(_request: Request, context: { params: Promise<{ id: string; versionId: string }> }) {
  const { id, versionId } = await context.params;
  const version = await prisma.protocolVersion.findUnique({ where: { id: versionId }, include: { protocol: { include: { project: true, researchPlans: { include: { researchPlan: true } } } } } });
  if (!version || version.protocolId !== id) return Response.json({ error: "Protocol version not found." }, { status: 404 });
  const document = normalizeProtocolDocument(version.contentJson) ?? protocolDocumentFromLegacy({
    description: version.protocol.description,
    purpose: version.purpose,
    background: version.background,
    materials: asArray<ProtocolMaterial>(version.materialsJson),
    equipment: asArray<ProtocolMaterial>(version.equipmentJson),
    steps: asArray<ProtocolStep>(version.stepsJson),
    resultTemplates: asArray<ResultTemplate>(version.resultTemplatesJson),
    consumptionRules: asArray<ConsumptionRule>(version.consumptionRulesJson),
  });
  return Response.json({
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    protocol: {
      id: version.protocol.id,
      humanCode: version.protocol.humanCode,
      canonicalTitle: version.protocol.canonicalTitle ?? version.protocol.title,
      shortTitle: version.protocol.shortTitle,
      englishTitle: version.protocol.englishTitle,
      scope: version.protocol.scope,
      project: version.protocol.project ? { id: version.protocol.project.id, name: version.protocol.project.name } : null,
      availability: version.protocol.availability,
      tags: version.protocol.tags,
      researchPlans: version.protocol.researchPlans.map((link) => ({ id: link.researchPlan.id, code: link.researchPlan.code, title: link.researchPlan.title, isPrimary: link.isPrimary })),
    },
    version: {
      id: version.id,
      revision: version.revision,
      displayVersion: version.displayVersion,
      reviewStage: version.reviewStage,
      recordStatus: version.recordStatus,
      sourceType: version.sourceType,
      sourceFileName: version.sourceFileName,
      changeSummary: version.changeSummary,
      previousVersionId: version.previousVersionId,
      derivedFromVersionId: version.derivedFromVersionId,
      adaptationRationale: version.adaptationRationale,
      createdAt: version.createdAt,
    },
    document,
    structuredProjection: projectProtocolDocument(document),
  });
}
