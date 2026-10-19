import { describe, expect, it } from 'vitest';
import { europePmcAdapter, europePmcQuery, parseFullText, parseSearchResult, shortLicense } from './europe-pmc';
import { parseProtocol, parseSearchItem, protocolsIoAdapter } from './protocols-io';
import { stripHtml } from './types';

describe('method sources', () => {
  it('asks Europe PMC with Latin terms only and falls back from all terms to any', async () => {
    expect(europePmcQuery('siRNA transfection knockdown validation by qPCR KYSE150 贴壁细胞')).toBe('siRNA AND transfection AND knockdown AND qPCR AND KYSE150');
    expect(europePmcQuery('组织 DNA 提取')).toBe('DNA');
    expect(europePmcQuery('组织提取')).toBe('');
    const urls: string[] = [];
    const adapter = europePmcAdapter(async url => { urls.push(url); return JSON.stringify({ resultList: { result: urls.length === 1 ? [] : [{ pmcid: 'PMC123', title: 'A', authorString: 'B C', pubYear: '2021', journalTitle: 'J' }] } }); });
    const hits = await adapter.search('siRNA transfection');
    expect(urls.map(url => decodeURIComponent(url).match(/query=\((.*?)\) AND OPEN_ACCESS/)?.[1])).toEqual(['siRNA AND transfection', 'siRNA OR transfection']);
    expect(hits).toEqual([{ key: 'europe_pmc:PMC123', source: 'europe_pmc', externalId: 'PMC123', title: 'A', authors: 'B C', year: '2021', venue: 'J', url: 'https://europepmc.org/article/PMC/PMC123', license: undefined, snippet: undefined }]);
    expect(parseSearchResult({ title: 'no pmcid' })).toEqual([]);
  });

  it('keeps the Methods sections of a JATS article and its license, whole article when none is marked', () => {
    const xml = `<article><front><article-meta><title-group><article-title>Knockdown <i>of</i> LRP1</article-title></title-group><permissions><license><license-p>CC BY 4.0</license-p></license></permissions></article-meta></front><body>
      <sec><title>Introduction</title><p>Intro text.</p></sec>
      <sec><title>Materials and Methods</title><sec><title>Transfection</title><p>Cells were transfected with 20 nM siRNA using Lipofectamine.</p></sec><sec><title>qPCR</title><p>Total RNA was extracted.</p></sec></sec>
      <sec><title>Results</title><p>It worked.</p></sec></body></article>`;
    const text = parseFullText(xml, 'PMC1');
    expect(text.title).toBe('Knockdown of LRP1');
    expect(text.license).toBe('CC BY 4.0');
    expect(text.sections.map(section => section.title)).toEqual(['Materials and Methods']);
    expect(text.sections[0].text).toContain('20 nM siRNA');
    expect(text.sections[0].text).toContain('Total RNA');
    expect(text.text).not.toContain('It worked');
    expect(parseFullText('<body><sec><title>Only</title><p>All of it.</p></sec></body>', 'PMC2').sections).toHaveLength(1);
  });

  it('reads protocols.io search items and both step shapes, keeping the license when given', async () => {
    expect(parseSearchItem({ id: 42, title: 'DNeasy', uri: 'dneasy-x', creator: { name: 'Qiagen' }, published_on: 1700000000, description: '<p>Column &amp; spin</p>', license: { name: 'CC BY 4.0' } })).toEqual([{ key: 'protocols_io:42', source: 'protocols_io', externalId: '42', title: 'DNeasy', authors: 'Qiagen', year: '2023', venue: 'protocols.io', url: 'https://www.protocols.io/view/dneasy-x', license: 'CC BY 4.0', snippet: 'Column & spin' }]);
    const text = parseProtocol({ title: 'DNeasy', description: '<p>Intro</p>', steps: [{ title: 'Lyse', step: '<p>Add 20 µL Proteinase K</p>' }, { components: [{ type_id: 1, source: { body: '<p>Incubate at 56 °C</p>' } }] }] });
    expect(text.sections.map(section => [section.title, section.text])).toEqual([['Description', 'Intro'], ['Lyse', 'Add 20 µL Proteinase K'], ['Step 2', 'Incubate at 56 °C']]);
    const calls: Array<{ url: string; auth?: string }> = [];
    const adapter = protocolsIoAdapter(async (url, init) => { calls.push({ url, auth: (init?.headers as Record<string, string>)?.Authorization }); return url.includes('/protocols/42') ? { protocol: { title: 'DNeasy', steps: [] } } : { items: [{ id: 42, title: 'DNeasy' }] }; }, 'tok');
    expect((await adapter.search('dna')).map(hit => hit.key)).toEqual(['protocols_io:42']);
    expect((await adapter.fetch('42')).title).toBe('DNeasy');
    expect(calls.every(call => call.auth === 'Bearer tok' && call.url.startsWith('https://www.protocols.io/api/v4/'))).toBe(true);
  });

  it('names a license from its statement', () => {
    expect(shortLicense('This is an open access article distributed under the terms of the Creative Commons Attribution License, which permits unrestricted use, distribution, and reproduction in any medium, provided the original author and source are credited.')).toBe('CC BY');
    expect(shortLicense('Licensed under a Creative Commons Attribution-NonCommercial 4.0 International License.')).toBe('CC BY-NC 4.0');
    expect(shortLicense('Copyright the authors. All rights reserved. Contact for reuse.')).toBe('Copyright the authors.');
    expect(shortLicense('  ')).toBeUndefined();
  });

  it('strips markup into readable lines', () => {
    expect(stripHtml('<p>Add <b>20 µL</b>&nbsp;buffer</p><ul><li>mix</li><li>spin</li></ul>')).toBe('Add 20 µL buffer\nmix\nspin');
  });
});
