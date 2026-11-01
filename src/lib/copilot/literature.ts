import { DOMParser } from '@xmldom/xmldom';
import { europePmcQuery, topLevelSections } from '../method-sources/europe-pmc';
import { joinSections, plainTitle, stripHtml, textOf } from '../method-sources/types';
import type { Paper } from './types';

export type FetchText = (url: string, init?: RequestInit) => Promise<string>;

/** A Europe PMC result as a paper: an open-access one is keyed by its PMC number, any other by its PubMed number. */
export function paperFromResult(item: unknown): Paper | undefined {
  if (!item || typeof item !== 'object') return undefined;
  const record = item as Record<string, unknown>;
  const pmcid = textOf(record.pmcid), pmid = textOf(record.pmid) || (textOf(record.source) === 'MED' ? textOf(record.id) : '');
  const openAccess = textOf(record.isOpenAccess) === 'Y' && Boolean(pmcid);
  const key = openAccess ? pmcid : pmid ? `MED:${pmid}` : pmcid || undefined;
  const title = plainTitle(textOf(record.title));
  if (!key || !title) return undefined;
  const abstract = stripHtml(textOf(record.abstractText));
  return { key, title, source: 'europe_pmc', ...(textOf(record.authorString) ? { authors: plainTitle(textOf(record.authorString)) } : {}), ...(textOf(record.pubYear) ? { year: textOf(record.pubYear) } : {}),
    ...(textOf(record.journalTitle) ? { venue: plainTitle(textOf(record.journalTitle)) } : {}), ...(textOf(record.doi) ? { doi: textOf(record.doi) } : {}),
    url: openAccess ? `https://europepmc.org/article/PMC/${pmcid}` : pmid ? `https://europepmc.org/article/MED/${pmid}` : undefined, openAccess, ...(abstract ? { abstract } : {}) };
}

/** Papers for an English query: every term first, any of them when nothing has them all. Abstracts included, open access or not. */
export async function searchPapers(query: string, fetchText: FetchText, base: string): Promise<Paper[]> {
  for (const joiner of ['AND', 'OR'] as const) {
    const explicit = /["()]|\b(?:AND|OR|NOT)\b/.test(query);
    const terms = explicit ? query.trim() : europePmcQuery(query, joiner);
    if (!terms) return [];
    const url = `${base}/europepmc/webservices/rest/search?query=${encodeURIComponent(`(${terms}) AND (SRC:MED OR SRC:PMC)`)}&format=json&pageSize=10&resultType=core`;
    const payload = JSON.parse(await fetchText(url, { headers: { Accept: 'application/json' } })) as { resultList?: { result?: unknown[] } };
    if (!Array.isArray(payload.resultList?.result)) throw new Error('Europe PMC 返回了无效的检索结果');
    const papers = payload.resultList.result.flatMap(item => paperFromResult(item) ?? []);
    if (papers.length || explicit || joiner === 'OR') return papers;
  }
  return [];
}

const resultsLike = /method|material|procedure|protocol|experimental|result|finding|in vitro|in vivo|animal/i;

/** What is read of a paper: the Methods and Results of an open-access full text, otherwise the abstract. */
export async function paperText(paper: Paper, fetchText: FetchText, base: string, useFullText: boolean): Promise<{ text: string; basis: 'fulltext' | 'abstract' }> {
  if (useFullText && paper.openAccess && paper.key.startsWith('PMC')) {
    try {
    const xml = await fetchText(`${base}/europepmc/webservices/rest/${encodeURIComponent(paper.key)}/fullTextXML`, { headers: { Accept: 'application/xml' } });
    const sections = topLevelSections(xml);
    const chosen = sections.filter(section => resultsLike.test(section.title));
    const text = joinSections(chosen.length ? chosen : sections);
    if (text.trim()) return { text, basis: 'fulltext' };
    } catch (error) { if (!paper.abstract?.trim()) throw error; }
  }
  if (!paper.abstract?.trim()) throw new Error('论文没有可读取的摘要或全文');
  return { text: [paper.title, paper.abstract].filter(Boolean).join('\n\n'), basis: 'abstract' };
}

/** One search result as the agent sees it: a short reference to pick from, never the whole abstract. */
export const paperDigest = (paper: Paper, ref: string) => ({ ref, title: paper.title, year: paper.year, venue: paper.venue, openAccess: paper.openAccess, abstract: paper.abstract ? paper.abstract.slice(0, 280) : undefined });


// NCBI permits at most three unauthenticated requests per second. Serialize requests
// across runs in this process, with spacing and bounded backoff for HTTP 429.
let pubmedQueue: Promise<unknown> = Promise.resolve();
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
function fetchPubMed(url: string, fetchText: FetchText, onNotice?: (text: string) => void): Promise<string> {
  const request = pubmedQueue.then(async () => {
    await delay(500);
    for (let attempt = 0; ; attempt += 1) {
      try { return await fetchText(url); }
      catch (error) {
        if (attempt >= 2 || !(error instanceof Error) || !/returned 429\b/.test(error.message)) throw error;
        onNotice?.(`PubMed 暂时限流，稍候重试（${attempt + 1}/2）`);
        await delay(1000 * (attempt + 1));
      }
    }
  });
  pubmedQueue = request.catch(() => undefined);
  return request;
}

/** PubMed metadata and abstracts from NCBI E-utilities; this does not imply full-text access. */
export async function searchPubMed(query: string, fetchText: FetchText, onNotice?: (text: string) => void): Promise<Paper[]> {
  const base = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
  const result = JSON.parse(await fetchPubMed(`${base}/esearch.fcgi?db=pubmed&retmode=json&retmax=10&sort=relevance&tool=LabNest&term=${encodeURIComponent(query)}`, fetchText, onNotice)) as { error?: string; esearchresult?: { idlist?: string[]; errorlist?: unknown } };
  if (result.error || !result.esearchresult?.idlist) throw new Error('PubMed 返回了无效的检索结果');
  const ids = result.esearchresult.idlist.filter(id => /^\d+$/.test(id)).slice(0, 10);
  if (!ids.length) return [];
  const xml = await fetchPubMed(`${base}/efetch.fcgi?db=pubmed&retmode=xml&tool=LabNest&id=${ids.join(',')}`, fetchText, onNotice);
  const document = new DOMParser().parseFromString(xml, 'text/xml');
  if (document.getElementsByTagName('ERROR').length || !document.getElementsByTagName('PubmedArticleSet').length) throw new Error('PubMed 文献详情读取失败');
  return Array.from(document.getElementsByTagName('PubmedArticle')).flatMap(article => {
    const get = (tag: string) => article.getElementsByTagName(tag)[0]?.textContent?.trim() ?? '';
    const pmid = get('PMID'), title = get('ArticleTitle');
    if (!/^\d+$/.test(pmid) || !title) return [];
    const authors = Array.from(article.getElementsByTagName('Author')).map(author => {
      const part = (tag: string) => author.getElementsByTagName(tag)[0]?.textContent?.trim();
      return [part('LastName'), part('Initials')].filter(Boolean).join(' ') || part('CollectiveName') || '';
    }).filter(Boolean).join(', ');
    const abstract = Array.from(article.getElementsByTagName('AbstractText')).map(node => [node.getAttribute('Label'), node.textContent?.trim()].filter(Boolean).join(': ')).join('\n');
    const doi = Array.from(article.getElementsByTagName('ArticleId')).find(node => node.getAttribute('IdType') === 'doi')?.textContent?.trim();
    return [{ key: `MED:${pmid}`, source: 'pubmed' as const, title, authors, year: get('Year') || get('MedlineDate'), venue: get('Title'), url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`, doi, abstract, openAccess: false }];
  });
}

/** One failed primary request switches this stage to the permitted fallback; no repeated calls to an unavailable source. */
export function literatureSearcher(fetchText: FetchText, base: string) {
  let primaryFailed = false;
  return async (query: string, allowFallback = false, onNotice?: (text: string) => void): Promise<Paper[]> => {
    if (!primaryFailed) {
      try {
        const papers = await searchPapers(query, fetchText, base);
        onNotice?.(`Europe PMC：返回 ${papers.length} 篇文献`);
        return papers;
      } catch (error) {
        primaryFailed = true;
        onNotice?.(`Europe PMC 检索失败：${error instanceof Error ? error.message : '请求失败'}`);
        if (!allowFallback) throw new Error('Europe PMC 检索失败，已暂停。本轮未启用 PubMed 备用来源。');
      }
    }
    if (!allowFallback) throw new Error('Europe PMC 不可用，已暂停检索');
    onNotice?.('使用本轮已启用的 PubMed 备用来源');
    try {
      const papers = await searchPubMed(query, fetchText, onNotice);
      onNotice?.(`PubMed：返回 ${papers.length} 篇文献（摘要）`);
      return papers;
    } catch (error) {
      throw new Error(`Europe PMC 和 PubMed 均未能完成检索，已暂停：${error instanceof Error ? error.message : '请求失败'}`);
    }
  };
}
