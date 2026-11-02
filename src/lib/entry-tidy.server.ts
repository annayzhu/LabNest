import { randomUUID } from 'node:crypto';
import type { Prisma } from '@/generated/prisma/client';
import { resolveConnectedAdapter } from './ai-server';
import { suggestedExperimentId } from './ai-suggestion';
import { askJson } from './copilot/structured';
import { changedFields, type IgnoreReason } from './copilot/suggestions';
import { decideSuggestion, latestSuggestion, recordSuggestions } from './copilot/suggestions.server';
import { prisma } from './db';
import { assignEntryInTransaction } from './entry-assignment.server';
import { buildEntryContent, getEntryMarkdown, plainTextFromEntryMarkdown, withEntryMarkdown } from './entry-content';
import { lockEntrySourceGraph } from './entry-source-lock';
import { keptLines, parseTidy, tidyMarkdown, tidyPrompt, unsupportedTokens, type TidyDraft } from './entry-tidy';
import { assertRecordEditable } from './record-lifecycle';

const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const tidyOf = (entryId: string) => ({ targetType: 'entry', targetId: entryId, kind: 'entry_tidy' });
const assignOf = (entryId: string) => ({ targetType: 'entry', targetId: entryId, kind: 'entry_assign' });

/**
 * Asks the default service to tidy a record and keeps the draft as a suggestion (Q336), with the numbers and codes it
 * has that the words do not. Nothing on the record changes until the author adopts the draft.
 */
export async function draftTidy(entryId: string): Promise<TidyDraft> {
  const entry = await prisma.entry.findUnique({ where: { id: entryId }, select: { title: true, body: true, contentJson: true, recordStatus: true } });
  if (!entry) throw new Error('This record no longer exists');
  assertRecordEditable(entry.recordStatus);
  const markdown = getEntryMarkdown(entry.contentJson, entry.body);
  const words = wordsOf(markdown);
  if (!words) throw new Error('There are no words to tidy in this record');
  const resolved = await resolveConnectedAdapter({ timeoutMs: 120_000 });
  if (!resolved.ok) throw new Error(resolved.error);
  const { adapter, config, gate } = resolved;
  if (!adapter.complete) throw new Error(`The service “${config.name}” cannot write text; choose another default service on the AI page`);
  const { value, model } = await askJson((system, user, options) => adapter.complete!(system, user, options), tidyPrompt({ title: entry.title, words }), parseTidy);
  await gate.assertAllowed();
  const draft = tidyMarkdown(value);
  const unsupported = unsupportedTokens(`${value.title}\n${draft}`, `${entry.title}\n${words}`);
  // 归入 is offered only for a record not filed anywhere yet (Q340).
  const filed = await prisma.itemLink.findFirst({ where: { sourceType: 'entry', sourceId: entryId, linkType: 'entry_primary' }, select: { id: true } });
  const experiment = filed ? undefined : await namedExperiment(value.experiment, `${entry.title}\n${words}`);
  const requestKey = `tidy:${entryId}:${randomUUID()}`;
  const source = { requestKey, specId: 'entry.tidy' as const, providerId: config.id, provider: config.name, model };
  await prisma.$transaction(tx => recordSuggestions(tx, [
    { ...tidyOf(entryId), ...source, before: { title: entry.title, markdown }, proposed: { title: value.title, markdown: draft }, checks: { unsupported, unclear: value.unclear } },
    ...(experiment ? [{ ...assignOf(entryId), ...source, requestKey: `${requestKey}:assign`, subject: experiment.id, proposed: experiment }] : []),
  ]));
  return { requestKey, title: value.title, markdown: draft, unsupported, provider: config.name, model, experiment };
}

/**
 * Adopts the draft as the author left it: the record takes the new title and text, keeps its pictures, tables, plate
 * layouts and files, and the words as they were stay with the suggestion (shown as "Original words"). Words changed
 * since the draft, or a newer draft, stop it; 归入 meanwhile does not.
 */
export async function adoptTidy(entryId: string, input: { requestKey: string; title: string; markdown: string }) {
  const title = input.title.trim(), text = input.markdown.trim();
  if (!title || title.length > 160) throw new Error('Give the record a title of 160 characters at most');
  if (!text) throw new Error('The tidied text is empty');
  await prisma.$transaction(async tx => {
    await lockEntrySourceGraph(tx);
    await tx.$queryRaw`SELECT id FROM "Entry" WHERE id=${entryId} FOR UPDATE`;
    const entry = await tx.entry.findUnique({ where: { id: entryId } });
    if (!entry) throw new Error('This record no longer exists');
    assertRecordEditable(entry.recordStatus);
    const latest = await latestSuggestion(tx, tidyOf(entryId));
    if (latest?.requestKey !== input.requestKey || !['pending', 'edited'].includes(latest.status)) throw new Error('This draft is not the latest one; tidy the record again');
    const current = getEntryMarkdown(entry.contentJson, entry.body);
    const before = latest.beforeJson as { title?: string; markdown?: string } | null;
    if (before?.title !== entry.title || before?.markdown !== current) throw new Error('The record changed after this draft was made; tidy it again');
    const markdown = [text, ...keptLines(current)].join('\n\n');
    const files = async () => (await tx.attachmentLink.findMany({ where: { targetType: 'entry', targetId: entryId, linkType: 'entry_content' }, orderBy: { order: 'asc' }, include: { attachment: true } })).map(link => link.attachment);
    const content = withEntryMarkdown(entry.contentJson, markdown) ?? buildEntryContent(markdown, await files());
    await tx.entry.update({ where: { id: entryId }, data: { title, body: plainTextFromEntryMarkdown(markdown), contentJson: json(content) } });
    await decideSuggestion(tx, tidyOf(entryId), { status: 'adopted', changed: proposed => changedFields(proposed, { title, markdown: text }) });
    // Activity entries print their fields as text: keep them flat.
    await tx.activityLog.create({ data: { action: 'entry_tidied', targetType: 'entry', targetId: entryId, metadataJson: { suggestion: input.requestKey, previousTitle: entry.title } } });
  });
}

/** Ignores the latest draft, with the author's reason. */
export async function ignoreTidy(entryId: string, requestKey: string, reason: IgnoreReason) {
  const latest = await latestSuggestion(prisma, tidyOf(entryId));
  if (latest?.requestKey !== requestKey) return;
  await decideSuggestion(prisma, tidyOf(entryId), { status: 'ignored', reason });
}

/** Files the record under the experiment its words named, through the record's own 归入, or ignores that suggestion. */
export async function decideAssignment(entryId: string, experimentId: string, adopt: boolean) {
  await prisma.$transaction(async tx => {
    // `expectedTarget: null`: a record filed somewhere meanwhile stays where it is.
    if (adopt) await assignEntryInTransaction(tx, entryId, { type: 'experiment', expectedTarget: null, targetId: experimentId, mutationId: randomUUID() });
    await decideSuggestion(tx, { ...assignOf(entryId), subject: experimentId }, adopt ? { status: 'adopted' } : { status: 'ignored', reason: 'not_needed' });
  });
}

/** The record's words before its first adopted tidy, for the "Original words" fold (Q339). */
export async function originalWords(entryId: string) {
  const first = await prisma.copilotSuggestion.findFirst({ where: { ...tidyOf(entryId), status: 'adopted' }, orderBy: { decidedAt: 'asc' }, select: { beforeJson: true } });
  const before = first?.beforeJson as { markdown?: string } | null | undefined;
  return before?.markdown;
}

/** The words a tidy reads: the record's text without its pictures, tables and plate layouts. */
function wordsOf(markdown: string) {
  const kept = new Set(keptLines(markdown));
  return plainTextFromEntryMarkdown(markdown.split('\n').filter(line => !kept.has(line)).join('\n')).trim();
}

/** The open experiment the words themselves name, by run code or title; a name the model made up is not one. */
async function namedExperiment(name: string, words: string) {
  if (!name || !words.toLowerCase().includes(name.toLowerCase())) return undefined;
  const open = await prisma.experiment.findMany({ where: { status: { not: 'archived' } }, select: { id: true, title: true, runCode: true } });
  const found = open.find(item => item.id === suggestedExperimentId({ experiment: name }, open));
  return found && { id: found.id, label: `${found.runCode} ${found.title}` };
}
