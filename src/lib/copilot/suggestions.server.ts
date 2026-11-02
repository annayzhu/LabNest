import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '../db';
import { taskSpecs, type SpecId } from './specs';
import { adoptionNumbers, changedFields, openStatuses, type IgnoreReason } from './suggestions';

type Db = Prisma.TransactionClient | typeof prisma;
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const isOpen = (status: string) => (openStatuses as string[]).includes(status);

/** The thing a suggestion is about: a record, and the block, field or finding inside it. */
export type SuggestionSubject = { targetType: string; targetId: string; kind: string; subject?: string };
export type NewSuggestion = SuggestionSubject & {
  requestKey: string; specId: SpecId; providerId?: string; provider?: string; model?: string;
  before?: unknown; proposed: unknown; checks?: unknown;
};

/**
 * Keeps what a model proposed (Q336). A key already kept is left alone, so a retried write adds nothing; open
 * suggestions about the same thing are ignored as "regenerated", since the author asked for a new one instead.
 */
export async function recordSuggestions(db: Db, items: NewSuggestion[]) {
  for (const item of items) await ignoreOpen(db, { ...item, subject: item.subject ?? '', except: item.requestKey }, 'regenerated');
  if (items.length) await db.copilotSuggestion.createMany({ skipDuplicates: true, data: items.map(item => ({
    requestKey: item.requestKey, module: taskSpecs[item.specId].module, kind: item.kind, specId: item.specId, specVersion: taskSpecs[item.specId].version,
    providerId: item.providerId, provider: item.provider, model: item.model, targetType: item.targetType, targetId: item.targetId, subject: item.subject ?? '',
    beforeJson: item.before === undefined ? undefined : json(item.before), proposedJson: json(item.proposed), checksJson: item.checks === undefined ? undefined : json(item.checks),
  })) });
}

/** Ignores the open suggestions on a record: about one thing, of one kind, or all of them when the record goes. */
export const ignoreOpen = (db: Db, scope: { targetType: string; targetId: string; kind?: string; subject?: string; except?: string }, reason: IgnoreReason, note?: string) => db.copilotSuggestion.updateMany({
  where: {
    targetType: scope.targetType, targetId: scope.targetId, status: { in: openStatuses },
    ...(scope.kind ? { kind: scope.kind } : {}), ...(scope.subject !== undefined ? { subject: scope.subject } : {}), ...(scope.except ? { requestKey: { not: scope.except } } : {}),
  },
  data: { status: 'ignored', ignoreReason: reason, note: note ?? null, decidedAt: new Date() },
});

/** The latest suggestion about this thing that the author could still act on, or did (not one set aside as regenerated). */
export const latestSuggestion = (db: Db, about: SuggestionSubject) => db.copilotSuggestion.findFirst({
  // In SQL a missing reason is neither equal nor unequal to "regenerated", so it is asked for on its own.
  where: { targetType: about.targetType, targetId: about.targetId, kind: about.kind, subject: about.subject ?? '', OR: [{ ignoreReason: null }, { ignoreReason: { not: 'regenerated' } }] },
  orderBy: { createdAt: 'desc' },
});

export type Decision =
  | { status: 'adopted'; changed?: (proposed: Record<string, unknown>) => string[] }
  | { status: 'ignored'; reason: IgnoreReason; note?: string }
  | { status: 'edited' }
  | { status: 'pending' };

/** Adopted as the author kept it: the fields they changed, compared top level with what was proposed. */
export const adoptedAs = (kept: Record<string, unknown>, skip: readonly string[] = []): Decision => ({ status: 'adopted', changed: proposed => changedFields(proposed, kept, skip) });

/**
 * The author's decision on the latest suggestion about this thing. Adopting records the fields `changed` finds
 * between the proposal and what was kept (none when adopted as proposed). `edited` only marks one still open;
 * `pending` takes a decision back.
 */
export async function decideSuggestion(db: Db, about: SuggestionSubject, decision: Decision) {
  const row = await latestSuggestion(db, about);
  if (!row || (decision.status === 'edited' && !isOpen(row.status))) return;
  const data: Prisma.CopilotSuggestionUpdateInput = decision.status === 'adopted'
    ? { status: 'adopted', ignoreReason: null, note: null, decidedAt: new Date(), editedFields: decision.changed?.(row.proposedJson as Record<string, unknown>) ?? [] }
    : decision.status === 'ignored' ? { status: 'ignored', ignoreReason: decision.reason, note: decision.note?.slice(0, 600) ?? null, decidedAt: new Date() }
    : decision.status === 'edited' ? { status: 'edited' }
    : { status: 'pending', ignoreReason: null, note: null, decidedAt: null, editedFields: [] };
  await db.copilotSuggestion.update({ where: { id: row.id }, data });
}

/** Adoption over the last `days`, per service and per task spec version (Q334). Counted here, sent nowhere. */
export async function adoptionSummary(days = 30) {
  const rows = await prisma.copilotSuggestion.findMany({
    where: { createdAt: { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) } },
    select: { providerId: true, specId: true, specVersion: true, status: true, editedFields: true, ignoreReason: true },
  });
  const group = (key: (row: typeof rows[number]) => string) => {
    const groups = new Map<string, typeof rows>();
    for (const row of rows) groups.set(key(row), [...(groups.get(key(row)) ?? []), row]);
    return new Map([...groups].map(([name, members]) => [name, adoptionNumbers(members)]));
  };
  return { byProvider: group(row => row.providerId ?? ''), bySpec: group(row => `${row.specId}@${row.specVersion}`) };
}
