import { describe, expect, it } from 'vitest';
import { mergeSearchHits } from './method-design';
import { europePmcAdapter } from './method-sources/europe-pmc';
import type { MethodHit } from './method-sources/types';

const hit = (key: string, extra: Partial<MethodHit> = {}): MethodHit => {
  const [source, externalId] = key.split(':') as [MethodHit['source'], string];
  return { key, source, externalId, title: key, ...extra };
};

describe('换个关键词再搜 (search again)', () => {
  it('sends the new keywords to Europe PMC, not the earlier ones', async () => {
    const queries: string[] = [];
    const adapter = europePmcAdapter(async url => {
      queries.push(decodeURIComponent(url).match(/query=\((.*?)\) AND OPEN_ACCESS/)?.[1] ?? '');
      return JSON.stringify({ resultList: { result: [{ pmcid: `PMC${queries.length}`, title: 'T' }] } });
    });
    await adapter.search('粪肠球菌 DNA 提取 Enterococcus');
    await adapter.search('Enterococcus faecalis genomic DNA extraction kit');
    expect(queries).toEqual(['DNA AND Enterococcus', 'Enterococcus AND faecalis AND genomic AND DNA AND extraction AND kit']);
  });

  it('lists the new search first and drops earlier hits nobody worked on', () => {
    const known = [hit('local:v1'), hit('europe_pmc:PMC1'), hit('europe_pmc:PMC2'), hit('europe_pmc:PMC3')];
    const found = [hit('europe_pmc:PMC9'), hit('europe_pmc:PMC2', { title: 'fresh metadata' }), hit('local:v4')];
    expect(mergeSearchHits(known, found).map(item => item.key)).toEqual(['europe_pmc:PMC9', 'europe_pmc:PMC2', 'local:v4']);
  });

  it('keeps what was done with a hit: fetched or pasted text, a card, a choice, and the hits of a source that failed this time', () => {
    const fetched = hit('europe_pmc:PMC2', { attachmentId: 'att-2', fetchedAt: '2026-10-19T08:00:00Z', textChars: 900 });
    const known = [hit('local:v1'), fetched, hit('europe_pmc:PMC3'), hit('europe_pmc:PMC4'), hit('manual:m1'), hit('protocols_io:42'), hit('europe_pmc:PMC5')];
    const found = [hit('local:v1'), hit('europe_pmc:PMC2'), hit('europe_pmc:PMC2'), hit('europe_pmc:PMC8')];
    const merged = mergeSearchHits(known, found, { keys: ['europe_pmc:PMC3', 'europe_pmc:PMC4'], failedSources: ['protocols_io'] });
    expect(merged.map(item => item.key)).toEqual(['local:v1', 'europe_pmc:PMC2', 'europe_pmc:PMC8', 'europe_pmc:PMC3', 'europe_pmc:PMC4', 'manual:m1', 'protocols_io:42']);
    expect(merged[1]).toBe(fetched);
  });
});
