import { prisma } from '../db';
import { searchLabNestRecords } from '../global-search';
import { normalizeProtocolDocument, protocolSectionKeys, sectionPlainText } from '../protocol-document';
import { joinSections, type MethodHit, type MethodSourceAdapter, type MethodText } from './types';

/** The words of a goal, each searched on its own: the global search matches a phrase, a goal is several ideas. */
export function localSearchTerms(query: string) {
  return [...new Set(query.split(/[\s,;，；、。：:/()（）]+/).map(term => term.trim()).filter(term => term.length >= 2))].slice(0, 8);
}

/** The group's own Protocols: always searched, never sent anywhere. Each hit is the Protocol's latest version, ranked by how many terms it matched. */
export const localAdapter: MethodSourceAdapter = {
  id: 'local',
  async search(query) {
    const terms = localSearchTerms(query);
    const matches = new Map<string, number>();
    const versionIds = new Set<string>();
    for (const results of await Promise.all(terms.map(term => searchLabNestRecords(term, 30)))) for (const result of results) {
      if (result.type === 'protocol') matches.set(result.id, (matches.get(result.id) ?? 0) + 1);
      if (result.type === 'protocol_version') versionIds.add(result.id);
    }
    const versions = await prisma.protocolVersion.findMany({
      where: { OR: [{ id: { in: [...versionIds] } }, { protocolId: { in: [...matches.keys()] } }] },
      include: { protocol: { select: { id: true, humanCode: true, canonicalTitle: true, title: true, tags: true } } },
      orderBy: [{ protocolId: 'asc' }, { revision: 'desc' }],
    });
    const seen = new Set<string>();
    const hits: Array<MethodHit & { score: number }> = [];
    for (const version of versions) {
      if (seen.has(version.protocolId)) continue;
      seen.add(version.protocolId);
      hits.push({ key: `local:${version.id}`, source: 'local', externalId: version.id, title: version.protocol.canonicalTitle ?? version.protocol.title, score: (matches.get(version.protocolId) ?? 0) + (versionIds.has(version.id) ? 1 : 0),
        authors: version.protocol.humanCode, year: version.createdAt.toISOString().slice(0, 4), venue: `v${version.displayVersion} · ${version.reviewStage}`, url: `/protocols/${version.protocolId}?version=${version.id}`,
        snippet: [version.purpose, version.protocol.tags.join('、')].filter(Boolean).join(' · ').slice(0, 240) || undefined });
    }
    return hits.sort((a, b) => b.score - a.score).map(({ score: _, ...hit }) => { void _; return hit; });
  },
  async fetch(externalId): Promise<MethodText> {
    const version = await prisma.protocolVersion.findUnique({ where: { id: externalId }, include: { protocol: { select: { humanCode: true, canonicalTitle: true, title: true } } } });
    if (!version) throw new Error('规程版本不存在');
    const document = normalizeProtocolDocument(version.contentJson);
    const sections = document ? protocolSectionKeys.map(key => ({ title: document.sections.find(section => section.key === key)?.title ?? key, text: sectionPlainText(document, key) })).filter(section => section.text.trim()) : [];
    return { title: `${version.protocol.humanCode} · ${version.protocol.canonicalTitle ?? version.protocol.title} v${version.displayVersion}`, sections, text: joinSections(sections), url: `/protocols/${version.protocolId}?version=${version.id}`, fetchedAt: new Date().toISOString() };
  },
};
