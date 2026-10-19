import type { Prisma } from '@/generated/prisma/client';
import { projectProtocolDocument, type ProtocolDocument } from './protocol-document';
import { reserveRecordCode } from './record-codes';

const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

/**
 * A new Protocol with a reserved code and one draft version holding `document`: never reviewed, never used by an
 * Experiment until a person has gone through it. Design drafts and recognised manuals both start here.
 */
export async function createDraftProtocol(tx: Prisma.TransactionClient, input: { title: string; document: ProtocolDocument; sourceType: Prisma.ProtocolVersionCreateInput['sourceType']; changeSummary: string; tags: string[] }) {
  const projection = projectProtocolDocument(input.document);
  const humanCode = await reserveRecordCode(tx, 'protocol');
  const protocol = await tx.protocol.create({ data: { humanCode, title: input.title, canonicalTitle: input.title, description: projection.description, availability: 'draft', recordStatus: 'draft', scope: 'general', tags: input.tags } });
  const version = await tx.protocolVersion.create({ data: {
    protocolId: protocol.id, revision: 1, displayVersion: '0.1', reviewStage: 'draft', recordStatus: 'draft', sourceType: input.sourceType, title: `${input.title} v0.1`,
    ...versionContent(input.document, projection), changeSummary: input.changeSummary,
  } });
  return { protocol, version };
}

/** The columns a version keeps beside its document, read from it, so lists and search never parse the document. */
export const versionContent = (document: ProtocolDocument, projection = projectProtocolDocument(document)) => ({
  purpose: projection.purpose, background: projection.background, materialsJson: json(projection.materials), equipmentJson: json(projection.equipment), stepsJson: json(projection.steps),
  resultTemplatesJson: json(projection.resultTemplates), consumptionRulesJson: json(projection.consumptionRules), contentJson: json(document),
});
