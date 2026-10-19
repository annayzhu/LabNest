import type { Prisma } from '@/generated/prisma/client';
import { nextDisplayVersion } from './protocol';
import type { ProtocolDocument } from './protocol-document';
import { versionContent } from './protocol-draft.server';

const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

type SourceVersion = Prisma.ProtocolVersionGetPayload<{ include: { protocol: true } }>;

/** The display version after `latest` that no version of the Protocol has taken yet. */
export function nextFreeDisplayVersion(latest: string, taken: Set<string>) {
  let next = nextDisplayVersion(latest);
  while (taken.has(next)) next = nextDisplayVersion(next);
  return next;
}

/**
 * A new draft version of the source's Protocol holding `document`, derived from the source: next free display version,
 * its scope, notes and parameters, and the attachments it had. The source and every Experiment that used it stay as they
 * were. Call inside a transaction that holds the Protocol's lock.
 */
export async function createDraftRevision(tx: Prisma.TransactionClient, source: SourceVersion, document: ProtocolDocument, changeSummary: string) {
  const versions = await tx.protocolVersion.findMany({ where: { protocolId: source.protocolId }, select: { displayVersion: true, revision: true }, orderBy: { revision: 'desc' } });
  const latest = versions[0];
  const displayVersion = nextFreeDisplayVersion(latest?.displayVersion ?? source.displayVersion, new Set(versions.map(version => version.displayVersion)));
  const title = source.protocol.canonicalTitle ?? source.protocol.title;
  const version = await tx.protocolVersion.create({ data: {
    protocolId: source.protocolId, revision: (latest?.revision ?? source.revision) + 1, previousVersionId: source.id, sourceType: 'manual',
    reviewStage: 'draft', recordStatus: 'draft', displayVersion, title: `${title} v${displayVersion}`,
    scope: source.scope, notes: source.notes, parametersJson: json(source.parametersJson), adaptationRationale: source.adaptationRationale,
    ...versionContent(document), changeSummary,
  } });
  const inherited = await tx.attachmentLink.findMany({ where: { targetType: 'protocol_version', targetId: source.id }, select: { attachmentId: true, linkType: true, order: true } });
  if (inherited.length) await tx.attachmentLink.createMany({ data: inherited.map(link => ({ ...link, targetType: 'protocol_version', targetId: version.id })) });
  return { version, displayVersion };
}
