import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { Prisma } from '@/generated/prisma/client';
import { keepAttachment } from './attachment-files';
import { resolveAttachmentPath } from './attachments';
import { prisma } from './db';
import { designDraft } from './method-design';
import type { MethodCard } from './method-card';
import type { MethodHit, MethodText } from './method-sources/types';
import { createDraftProtocol } from './protocol-draft.server';

const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
export type DesignSessionRecord = NonNullable<Awaited<ReturnType<typeof loadDesignSession>>>;
export type ChosenHit = { key: string; reason?: string };

export async function loadDesignSession(id: string) {
  const session = await prisma.methodDesignSession.findUnique({ where: { id } });
  if (!session) return null;
  return { ...session, hits: (Array.isArray(session.hitsJson) ? session.hitsJson : []) as MethodHit[], cards: (session.cardsJson && typeof session.cardsJson === 'object' && !Array.isArray(session.cardsJson) ? session.cardsJson : {}) as Record<string, MethodCard>, chosen: (Array.isArray(session.chosenJson) ? session.chosenJson : []) as ChosenHit[] };
}

export const saveHits = (id: string, hits: MethodHit[]) => prisma.methodDesignSession.update({ where: { id }, data: { hitsJson: json(hits) } });
export const saveCards = (id: string, cards: Record<string, MethodCard>) => prisma.methodDesignSession.update({ where: { id }, data: { cardsJson: json(cards) } });
export const saveChosen = (id: string, chosen: ChosenHit[]) => prisma.methodDesignSession.update({ where: { id }, data: { chosenJson: json(chosen), status: chosen.length ? 'comparing' : 'searching' } });

/** The fetched text is kept as an attachment of the session, so what the model and the reader saw stays reviewable. */
export async function keepMethodText(sessionId: string, hit: MethodHit, text: MethodText) {
  const name = `${hit.source}-${hit.externalId}`.replace(/[^\w.-]+/g, '_');
  const file = new File([JSON.stringify({ hit, text }, null, 2)], `${name}.method.json`, { type: 'application/json' });
  return keepAttachment(file, { targetType: 'method_design_session', targetId: sessionId, linkType: 'method_source' });
}

export async function readMethodText(attachmentId: string): Promise<{ hit: MethodHit; text: MethodText } | null> {
  const attachment = await prisma.attachment.findUnique({ where: { id: attachmentId } });
  if (!attachment) return null;
  try { return JSON.parse(await readFile(resolveAttachmentPath(attachment.storagePath), 'utf8')); } catch { return null; }
}

/**
 * The draft Protocol: a new Protocol with a reserved code and one draft version of `sourceType = ai_design`.
 * Never reviewed, never used by an Experiment until a person has gone through it.
 */
export async function createDesignDraft(session: { id: string; goal: string; sampleType: string | null; conditions: string | null }, hit: MethodHit, text: MethodText, card: MethodCard | undefined) {
  const { document, title } = designDraft({ goal: session.goal, sampleType: session.sampleType ?? undefined, conditions: session.conditions ?? undefined, hit, text, card, sessionId: session.id, newId: prefix => `${prefix}-${randomUUID()}` });
  return prisma.$transaction(async tx => {
    const { protocol, version } = await createDraftProtocol(tx, { title, document, sourceType: 'ai_design', changeSummary: `由方案设计生成（来源：${hit.title}）`, tags: ['方案设计'] });
    await tx.methodDesignSession.update({ where: { id: session.id }, data: { status: 'drafted', draftVersionId: version.id } });
    await tx.activityLog.create({ data: { action: 'design_draft_created', targetType: 'protocol', targetId: protocol.id, metadataJson: json({ sessionId: session.id, hitKey: hit.key, versionId: version.id, unverified: card?.unverified ?? null }) } });
    return { protocolId: protocol.id, versionId: version.id, humanCode: protocol.humanCode };
  });
}
