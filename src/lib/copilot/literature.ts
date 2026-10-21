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
  return { key, title, ...(textOf(record.authorString) ? { authors: plainTitle(textOf(record.authorString)) } : {}), ...(textOf(record.pubYear) ? { year: textOf(record.pubYear) } : {}),
    ...(textOf(record.journalTitle) ? { venue: plainTitle(textOf(record.journalTitle)) } : {}), ...(textOf(record.doi) ? { doi: textOf(record.doi) } : {}),
    url: openAccess ? `https://europepmc.org/article/PMC/${pmcid}` : pmid ? `https://europepmc.org/article/MED/${pmid}` : undefined, openAccess, ...(abstract ? { abstract } : {}) };
}

/** Papers for an English query: every term first, any of them when nothing has them all. Abstracts included, open access or not. */
export async function searchPapers(query: string, fetchText: FetchText, base: string): Promise<Paper[]> {
  for (const joiner of ['AND', 'OR'] as const) {
    const terms = europePmcQuery(query, joiner);
    if (!terms) return [];
    const url = `${base}/europepmc/webservices/rest/search?query=${encodeURIComponent(`(${terms}) AND (SRC:MED OR SRC:PMC)`)}&format=json&pageSize=10&resultType=core`;
    const payload = JSON.parse(await fetchText(url, { headers: { Accept: 'application/json' } })) as { resultList?: { result?: unknown[] } };
    const papers = (payload.resultList?.result ?? []).flatMap(item => paperFromResult(item) ?? []);
    if (papers.length || joiner === 'OR') return papers;
  }
  return [];
}

const resultsLike = /method|material|procedure|protocol|experimental|result|finding|in vitro|in vivo|animal/i;

/** What is read of a paper: the Methods and Results of an open-access full text, otherwise the abstract. */
export async function paperText(paper: Paper, fetchText: FetchText, base: string, useFullText: boolean): Promise<{ text: string; basis: 'fulltext' | 'abstract' }> {
  if (useFullText && paper.openAccess && paper.key.startsWith('PMC')) {
    const xml = await fetchText(`${base}/europepmc/webservices/rest/${encodeURIComponent(paper.key)}/fullTextXML`, { headers: { Accept: 'application/xml' } });
    const sections = topLevelSections(xml);
    const chosen = sections.filter(section => resultsLike.test(section.title));
    const text = joinSections(chosen.length ? chosen : sections);
    if (text.trim()) return { text, basis: 'fulltext' };
  }
  return { text: [paper.title, paper.abstract].filter(Boolean).join('\n\n'), basis: 'abstract' };
}

/** One search result as the agent sees it: a short reference to pick from, never the whole abstract. */
export const paperDigest = (paper: Paper, ref: string) => ({ ref, title: paper.title, year: paper.year, venue: paper.venue, openAccess: paper.openAccess, abstract: paper.abstract ? paper.abstract.slice(0, 280) : undefined });
