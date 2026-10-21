import { describe, expect, it } from 'vitest';
import { paperDigest, paperFromResult, paperText, searchPapers } from './literature';

const xml = `<article><body>
<sec><title>Introduction</title><p>Background text.</p></sec>
<sec><title>Materials and Methods</title><p>Cells were seeded in 96-well plates.</p></sec>
<sec><title>Results</title><p>Knockdown reduced viability by 40%.</p></sec>
<sec><title>Discussion</title><p>We discuss.</p></sec>
</body></article>`;

describe('Papers from Europe PMC', () => {
  it('keys an open-access paper by its PMC number and any other by its PubMed number, with the abstract as plain text', () => {
    expect(paperFromResult({ pmcid: 'PMC123', isOpenAccess: 'Y', title: 'Gene <i>A</i> and growth', authorString: 'Li X.', pubYear: '2021', journalTitle: 'Cancer Res', abstractText: '<h4>Background</h4><p>We show it.</p>', doi: '10.1/x' }))
      .toMatchObject({ key: 'PMC123', title: 'Gene A and growth', year: '2021', openAccess: true, abstract: expect.stringContaining('We show it.'), url: 'https://europepmc.org/article/PMC/PMC123' });
    expect(paperFromResult({ pmid: '999', pmcid: 'PMC5', isOpenAccess: 'N', title: 'Closed paper' })).toMatchObject({ key: 'MED:999', openAccess: false, url: 'https://europepmc.org/article/MED/999' });
    expect(paperFromResult({ source: 'MED', id: '7', title: 'Only an id' })).toMatchObject({ key: 'MED:7' });
    expect(paperFromResult({ title: 'No identifier' })).toBeUndefined();
    expect(paperFromResult(null)).toBeUndefined();
  });

  it('searches every term first and any of them when nothing has them all', async () => {
    const urls: string[] = [];
    const fetchText = async (url: string) => { urls.push(url); return JSON.stringify({ resultList: { result: urls.length === 1 ? [] : [{ pmid: '1', title: 'Hit', isOpenAccess: 'N' }] } }); };
    const papers = await searchPapers('gene-A proliferation esophageal', fetchText, 'https://www.ebi.ac.uk');
    expect(papers.map(paper => paper.key)).toEqual(['MED:1']);
    expect(urls).toHaveLength(2);
    expect(decodeURIComponent(urls[0])).toContain('gene-A AND proliferation AND esophageal');
    expect(decodeURIComponent(urls[1])).toContain('gene-A OR proliferation OR esophageal');
    expect(urls[0]).toContain('resultType=core');
  });

  it('reads the Methods and Results of an open-access full text, and only the abstract of anything else', async () => {
    const fetchText = async () => xml;
    const open = await paperText({ key: 'PMC1', title: 'T', openAccess: true }, fetchText, 'https://x', true);
    expect(open.basis).toBe('fulltext');
    expect(open.text).toContain('Cells were seeded');
    expect(open.text).toContain('Knockdown reduced viability');
    expect(open.text).not.toContain('Background text');
    const limited = await paperText({ key: 'PMC1', title: 'T', openAccess: true, abstract: 'Short abstract.' }, fetchText, 'https://x', false);
    expect(limited).toEqual({ text: 'T\n\nShort abstract.', basis: 'abstract' });
    const closed = await paperText({ key: 'MED:2', title: 'Closed', openAccess: false, abstract: 'Abstract only.' }, async () => { throw new Error('never fetched'); }, 'https://x', true);
    expect(closed.basis).toBe('abstract');
  });

  it('shows the agent a short digest to pick from', () => {
    expect(paperDigest({ key: 'PMC1', title: 'T', year: '2020', openAccess: true, abstract: 'x'.repeat(500) }, 'r3')).toMatchObject({ ref: 'r3', openAccess: true, abstract: 'x'.repeat(280) });
  });
});
