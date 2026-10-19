import { describe, expect, it } from 'vitest';
import { europePmcAdapter, parseFullText, parseSearchResult } from './europe-pmc';
import { parseProtocol, parseSearchItem } from './protocols-io';
import { decodeEntities, plainHit, plainTitle, stripHtml, type MethodHit } from './types';

describe('titles from outside sources read as plain text', () => {
  it('decodes escaped markup and strips it, whichever way the feed sends it', () => {
    expect(plainTitle('Detection of &lt;i&gt;Enterococcus&lt;/i&gt; faecalis in wastewater')).toBe('Detection of Enterococcus faecalis in wastewater');
    expect(plainTitle('Detection of <i>Enterococcus</i> faecalis')).toBe('Detection of Enterococcus faecalis');
    expect(plainTitle('&amp;lt;i&amp;gt;E. coli&amp;lt;/i&amp;gt; K-12')).toBe('E. coli K-12');
    expect(plainTitle('Ca<sup>2+</sup> imaging of <span class="genus">Bacillus</span><br/>subtilis')).toBe('Ca2+ imaging of Bacillus subtilis');
    expect(plainTitle('<mml:math><mml:mi>&#946;</mml:mi></mml:math>-lactamase &amp; &#x3B3;-H2AX, 37&deg;C')).toBe('β-lactamase & γ-H2AX, 37°C');
  });

  it('keeps comparison signs, unknown entities and ordinary text as written', () => {
    expect(plainTitle('Survival p &lt; 0.05 and n &gt; 10 in &lt;5 µm particles')).toBe('Survival p < 0.05 and n > 10 in <5 µm particles');
    expect(plainTitle('R&D of &unknown; buffers   at  pH 7')).toBe('R&D of &unknown; buffers at pH 7');
    expect(plainTitle('Plain title')).toBe('Plain title');
    expect(decodeEntities('&#0; &#xD800; &#1114112;')).toBe('&#0; &#xD800; &#1114112;');
  });

  it('cleans Europe PMC and protocols.io titles, authors and journals at the source', async () => {
    expect(parseSearchResult({ pmcid: 'PMC9', title: 'Typing &lt;i&gt;Enterococcus&lt;/i&gt; spp.', authorString: 'M&#252;ller A, Smith B', journalTitle: 'J Microbiol &amp; Biotech' })[0])
      .toMatchObject({ title: 'Typing Enterococcus spp.', authors: 'Müller A, Smith B', venue: 'J Microbiol & Biotech' });
    const adapter = europePmcAdapter(async () => JSON.stringify({ resultList: { result: [{ pmcid: 'PMC1', title: '<i>Enterococcus</i> DNA extraction' }] } }));
    expect((await adapter.search('Enterococcus DNA'))[0].title).toBe('Enterococcus DNA extraction');
    expect(parseFullText('<article-title>Knockdown of <italic>LRP1</italic> in Ca<sup>2+</sup>-free medium</article-title><body></body>', 'PMC2').title).toBe('Knockdown of LRP1 in Ca2+-free medium');
    expect(parseSearchItem({ id: 7, title: 'Ni-NTA &amp; &lt;i&gt;His&lt;/i&gt;-tag', creator: { name: 'Jos&eacute;' } })[0]).toMatchObject({ title: 'Ni-NTA & His-tag', authors: 'José' });
    expect(parseProtocol({ title: '<b>DNeasy</b> kit' }).title).toBe('DNeasy kit');
  });

  it('cleans hits saved before, but only from outside sources', () => {
    const hit = (source: MethodHit['source'], title: string): MethodHit => ({ key: `${source}:1`, source, externalId: '1', title });
    expect(plainHit({ ...hit('europe_pmc', '&lt;i&gt;Enterococcus&lt;/i&gt;'), authors: 'M&#252;ller A', venue: 'A &amp; B' })).toMatchObject({ title: 'Enterococcus', authors: 'Müller A', venue: 'A & B' });
    expect(plainHit(hit('protocols_io', '<i>x</i>')).title).toBe('x');
    expect(plainHit(hit('europe_pmc', '<i></i>')).title).toBe('1');
    expect(plainHit(hit('manual', 'My &lt;own&gt; title')).title).toBe('My &lt;own&gt; title');
    expect(plainHit(hit('local', 'Lab <draft>')).title).toBe('Lab <draft>');
  });

  it('decodes every entity in fetched text once, so escaped text stays text', () => {
    expect(stripHtml('<p>5&nbsp;&micro;L at 37&deg;C, &lt;b&gt; stays &amp;lt;</p>')).toBe('5 µL at 37°C, <b> stays &lt;');
  });
});
