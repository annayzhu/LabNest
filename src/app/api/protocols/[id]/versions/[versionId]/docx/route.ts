import { prisma } from "@/lib/db";
import { exportProtocolDocx, protocolDocxFilename } from "@/lib/protocol-docx-export";
import { normalizeProtocolDocument, protocolDocumentFromLegacy } from "@/lib/protocol-document";
import type { ConsumptionRule, ProtocolMaterial, ProtocolStep, ResultTemplate } from "@/lib/types";

function asArray<T>(value: unknown): T[] { return Array.isArray(value) ? value as T[] : []; }

export async function GET(_request: Request, context: { params: Promise<{ id: string; versionId: string }> }) {
  const { id, versionId } = await context.params;
  const version = await prisma.protocolVersion.findUnique({ where: { id: versionId }, include: { protocol: { include: { project: true } } } });
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
  const identity = {
    humanCode: version.protocol.humanCode,
    canonicalTitle: version.protocol.canonicalTitle ?? version.protocol.title,
    englishTitle: version.protocol.englishTitle,
    availability: version.protocol.availability,
    reviewStage: version.reviewStage,
    displayVersion: version.displayVersion,
    scope: version.protocol.scope,
    projectName: version.protocol.project?.name,
    tags: version.protocol.tags,
  };
  const bytes = exportProtocolDocx(identity, document);
  const filename = protocolDocxFilename(identity);
  return new Response(bytes, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Content-Length": String(bytes.byteLength),
    },
  });
}
