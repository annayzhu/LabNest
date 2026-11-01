import { describe, expect, it, vi } from 'vitest';
import { literatureSearcher, searchPubMed, paperDigest, paperFromResult, paperText, searchPapers } from './literature';

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


const pubmedXml = '<PubmedArticleSet><PubmedArticle><MedlineCitation><PMID>123</PMID><Article><ArticleTitle>A binding study</ArticleTitle><Journal><Title>Methods</Title><JournalIssue><PubDate><Year>2024</Year></PubDate></JournalIssue></Journal><Abstract><AbstractText Label="RESULTS">Binding was tested.</AbstractText></Abstract><AuthorList><Author><LastName>Li</LastName><Initials>X</Initials></Author></AuthorList></Article></MedlineCitation><PubmedData><ArticleIdList><ArticleId IdType="doi">10.123/x</ArticleId></ArticleIdList></PubmedData></PubmedArticle></PubmedArticleSet>';
it('switches once to PubMed and keeps actual provenance and abstracts', async () => {
  const urls: string[] = [], notices: string[] = [];
  const search = literatureSearcher(async url => {
    urls.push(url);
    if (url.includes('europepmc')) throw new Error('503');
    return url.includes('esearch') ? JSON.stringify({ esearchresult: { idlist: ['123'] } }) : pubmedXml;
  }, 'https://www.ebi.ac.uk');
  const papers = await search('SRGN AND LRP1', true, note => notices.push(note));
  await search('far-Western', true);
  expect(urls.filter(url => url.includes('europepmc'))).toHaveLength(1);
  expect(papers[0]).toMatchObject({ key: 'MED:123', source: 'pubmed', title: 'A binding study', authors: 'Li X', year: '2024', abstract: 'RESULTS: Binding was tested.', openAccess: false, doi: '10.123/x' });
  expect(notices.join(' ')).toContain('Europe PMC 检索失败');
  expect(notices.join(' ')).toContain('PubMed：返回 1');
});
it('does not contact PubMed without the per-run setting, and fails when both sources fail', async () => {
  const urls: string[] = [];
  const search = literatureSearcher(async url => { urls.push(url); throw new Error('offline'); }, 'https://www.ebi.ac.uk');
  await expect(search('binding')).rejects.toThrow('未启用 PubMed');
  expect(urls).toHaveLength(1);
  await expect(search('binding', true)).rejects.toThrow('均未能完成检索');
});
it('uses publication dates instead of earlier citation revision dates', async () => {
  const revised = pubmedXml.replace('<Article>', '<DateRevised><Year>2026</Year></DateRevised><Article>');
  const read = (xml: string) => searchPubMed('binding', async url => url.includes('esearch') ? '{"esearchresult":{"idlist":["123"]}}' : xml);
  expect((await read(revised))[0].year).toBe('2024');
  expect((await read(revised.replace('<PubDate><Year>2024</Year></PubDate>', '<PubDate><MedlineDate>2023 Dec-2024 Jan</MedlineDate></PubDate>')))[0].year).toBe('2023 Dec-2024 Jan');
  expect((await read(revised.replace('<PubDate><Year>2024</Year></PubDate>', '')))[0].year).toBeUndefined();
});
it('rejects malformed PubMed responses instead of calling them empty results', async () => {
  await expect(searchPubMed('binding', async () => '{}')).rejects.toThrow('无效');
});
it('preserves quoted Boolean queries and falls back to an abstract when a full text cannot be read', async () => {
  const urls: string[] = [];
  await searchPapers('(SRGN OR serglycin) AND "far western"', async url => { urls.push(decodeURIComponent(url)); return '{"resultList":{"result":[]}}'; }, 'https://x');
  expect(urls).toHaveLength(1);
  expect(urls[0]).toContain('(SRGN OR serglycin) AND "far western"');
  expect(await paperText({ key: 'PMC1', title: 'T', openAccess: true, abstract: 'Original abstract' }, async () => { throw new Error('503'); }, 'https://x', true)).toEqual({ text: 'T\n\nOriginal abstract', basis: 'abstract' });
});


it('spaces concurrent PubMed requests and retries rate limits at most twice', async () => {
  vi.useFakeTimers();
  try {
    const times: number[] = [], notices: string[] = [];
    let attempts = 0;
    const fetchText = async () => { times.push(Date.now()); if (++attempts <= 2) throw new Error('eutils.ncbi.nlm.nih.gov returned 429'); return '{"esearchresult":{"idlist":[]}}'; };
    const pending = Promise.all([searchPubMed('one', fetchText, note => notices.push(note)), searchPubMed('two', fetchText)]);
    await vi.advanceTimersByTimeAsync(5000);
    expect(await pending).toEqual([[], []]);
    expect(attempts).toBe(4);
    expect(times.slice(1).every((time, index) => time - times[index] >= 500)).toBe(true);
    expect(notices).toHaveLength(2);
    let failures = 0;
    const failed = searchPubMed('three', async () => { failures++; throw new Error('eutils.ncbi.nlm.nih.gov returned 429'); });
    const assertion = expect(failed).rejects.toThrow('429');
    await vi.advanceTimersByTimeAsync(5000);
    await assertion;
    expect(failures).toBe(3);
  } finally { vi.useRealTimers(); }
});
