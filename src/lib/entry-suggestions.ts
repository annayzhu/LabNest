import { randomUUID } from 'node:crypto';
import { assignmentForSuggestion, type SuggestionDecision } from './ai-suggestion';
import { prisma } from './db';
import { assignEntryInTransaction } from './entry-assignment.server';
import { lockEntrySourceGraph } from './entry-source-lock';

const fromEntries = { sourceType: { in: ['ai' as const, 'entry' as const] } };

/** Quick entries with AI suggestions waiting for 采纳 or 忽略, most recent first: the AI panel lists them. */
export async function pendingSuggestionEntries(): Promise<{ entryId: string; title: string; count: number }[]> {
  const groups = await prisma.proposedAction.groupBy({ by: ['sourceId'], where: { ...fromEntries, status: 'pending', sourceId: { not: null } }, _count: { _all: true }, _max: { createdAt: true } });
  const ids = groups.map(group => group.sourceId!);
  const [entries, recycled] = await Promise.all([
    prisma.entry.findMany({ where: { id: { in: ids }, archivedAt: null }, select: { id: true, title: true } }),
    prisma.deletedRecord.findMany({ where: { targetType: 'entry', targetId: { in: ids }, restoredAt: null }, select: { targetId: true } }),
  ]);
  const hidden = new Set(recycled.map(record => record.targetId));
  const titles = new Map(entries.filter(entry => !hidden.has(entry.id)).map(entry => [entry.id, entry.title]));
  return groups.filter(group => titles.has(group.sourceId!))
    .sort((left, right) => (right._max.createdAt?.getTime() ?? 0) - (left._max.createdAt?.getTime() ?? 0))
    .map(group => ({ entryId: group.sourceId!, title: titles.get(group.sourceId!)!, count: group._count._all }));
}

/**
 * 采纳 or 忽略 one suggestion on its own entry. Accepting runs the entry's 归入 in the same transaction that closes the
 * suggestion, so a suggestion is never marked done without its change, nor applied twice.
 */
export async function decideSuggestion(entryId: string, suggestionId: string, decision: SuggestionDecision) {
  return prisma.$transaction(async tx => {
    // The entry graph lock comes first, as everywhere else; row locks only after it.
    await lockEntrySourceGraph(tx);
    await tx.$queryRaw`SELECT id FROM "ProposedAction" WHERE id=${suggestionId} FOR UPDATE`;
    const suggestion = await tx.proposedAction.findUnique({ where: { id: suggestionId } });
    if (!suggestion || suggestion.sourceId !== entryId || !fromEntries.sourceType.in.includes(suggestion.sourceType as 'ai' | 'entry')) throw new Error('这条建议不存在或不属于这条记录');
    if (suggestion.status !== 'pending') throw new Error('这条建议已经处理过了，请刷新页面');
    const assigned = decision.accept ? await assignEntryInTransaction(tx, entryId, { ...assignmentForSuggestion(suggestion.actionType, decision), mutationId: randomUUID() }) : undefined;
    const experimentId = assigned && 'targetId' in assigned ? assigned.targetId : undefined;
    await tx.proposedAction.update({ where: { id: suggestionId }, data: decision.accept ? { status: 'executed', executedAt: new Date() } : { status: 'rejected' } });
    await tx.activityLog.create({ data: { action: decision.accept ? 'ai_suggestion_accepted' : 'ai_suggestion_ignored', targetType: 'entry', targetId: entryId,
      metadataJson: { suggestionId, actionType: suggestion.actionType, ...(experimentId ? { experimentId } : {}) } } });
    return { experimentId };
  });
}
