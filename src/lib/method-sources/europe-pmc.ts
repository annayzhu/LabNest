import { joinSections, plainTitle, stripHtml, textOf, type MethodHit, type MethodSourceAdapter, type MethodText } from './types';

export const europePmcHost = 'www.ebi.ac.uk';
type FetchText = (url: string, init?: RequestInit) => Promise<string>;

/** Europe PMC REST: open-access articles only, so the full text (and its Methods) can be fetched and quoted. No key needed. */
export function europePmcAdapter(fetchText: FetchText): MethodSourceAdapter {
  return {
    id: 'europe_pmc',
    async search(query) {
      // All terms first; when nothing has them all, any of them. Europe PMC ranks by relevance by default (a `sort` parameter it does not know answers 503).
      for (const joiner of ['AND', 'OR'] as const) {
        const terms = europePmcQuery(query, joiner);
        if (!terms) return [];
        const url = `https://${europePmcHost}/europepmc/webservices/rest/search?query=${encodeURIComponent(`(${terms}) AND OPEN_ACCESS:y AND HAS_FT:y`)}&format=json&pageSize=10&resultType=lite`;
        const payload = JSON.parse(await fetchText(url, { headers: { Accept: 'application/json' } })) as { resultList?: { result?: unknown[] } };
        const hits = (payload.resultList?.result ?? []).flatMap(item => parseSearchResult(item));
        if (hits.length || joiner === 'OR') return hits;
      }
      return [];
    },
    async fetch(externalId) {
      const xml = await fetchText(`https://${europePmcHost}/europepmc/webservices/rest/${encodeURIComponent(externalId)}/fullTextXML`, { headers: { Accept: 'application/xml' } });
      return parseFullText(xml, externalId);
    },
  };
}

const stopwords = new Set(['by', 'of', 'the', 'and', 'in', 'for', 'with', 'to', 'a', 'an', 'on', 'at', 'from', 'into', 'using', 'via', 'after', 'before', 'cells', 'cell', 'assay', 'method', 'protocol', 'validation']);
/** Europe PMC reads English: Latin terms only (a Chinese goal still searches the group's own library), common words dropped, at most six terms. */
export function europePmcQuery(query: string, joiner: 'AND' | 'OR' = 'AND') {
  const terms = [...new Set(query.split(/[^A-Za-z0-9µ\-+]+/).map(term => term.trim()).filter(term => term.length >= 2 && !stopwords.has(term.toLowerCase())))].slice(0, 6);
  return terms.length ? terms.map(term => (/^[A-Za-z0-9\-]+$/.test(term) ? term : `"${term}"`)).join(` ${joiner} `) : '';
}

export function parseSearchResult(item: unknown): MethodHit[] {
  if (!item || typeof item !== 'object') return [];
  const record = item as Record<string, unknown>;
  const pmcid = textOf(record.pmcid);
  if (!pmcid) return [];
  return [{ key: `europe_pmc:${pmcid}`, source: 'europe_pmc', externalId: pmcid, title: plainTitle(textOf(record.title)) || pmcid, authors: plainTitle(textOf(record.authorString)) || undefined, year: textOf(record.pubYear) || undefined,
    venue: plainTitle(textOf(record.journalTitle)) || undefined, url: `https://europepmc.org/article/PMC/${pmcid}` }];
}

/** A license statement as a name: "CC BY 4.0" from the Creative Commons boilerplate, else its first sentence. */
export function shortLicense(statement: string) {
  const text = statement.trim();
  if (!text) return undefined;
  const cc = text.match(/Creative Commons (Attribution(?:[- ](?:Non[- ]?Commercial|NoDerivs?|ShareAlike|NoDerivatives))*)(?:[^\d]{0,40}(\d\.\d))?/i);
  if (cc) { const parts = cc[1].split(/[- ]/).filter(Boolean).map(part => part.toLowerCase()); const code = ['BY', parts.some(p => p.startsWith('non')) ? 'NC' : '', parts.some(p => p.startsWith('noderiv')) ? 'ND' : '', parts.some(p => p.startsWith('share')) ? 'SA' : ''].filter(Boolean).join('-'); return `CC ${code}${cc[2] ? ` ${cc[2]}` : ''}`; }
  return text.split(/(?<=[.。])\s/)[0].slice(0, 120);
}

const sectionTitle = (block: string) => stripHtml(block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '');
const methodsLike = /method|material|procedure|protocol|experimental/i;

/** JATS full text → the Methods-like sections (whole article when none is marked), the license statement and a readable title. */
export function parseFullText(xml: string, pmcid: string): MethodText {
  const title = plainTitle(xml.match(/<article-title[^>]*>([\s\S]*?)<\/article-title>/i)?.[1] ?? '') || pmcid;
  const license = shortLicense(stripHtml(xml.match(/<license[^>]*>([\s\S]*?)<\/license>/i)?.[1] ?? ''));
  const sections = topLevelSections(xml);
  const methods = sections.filter(section => methodsLike.test(section.title));
  const kept = methods.length ? methods : sections;
  return { title, sections: kept, text: joinSections(kept), license, url: `https://europepmc.org/article/PMC/${pmcid}`, fetchedAt: new Date().toISOString() };
}

/** The article's top-level sections, each with its title and plain text; nested sections stay inside their parent. */
export function topLevelSections(xml: string) {
  const body = xml.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? xml;
  const sections: Array<{ title: string; text: string }> = [];
  const pattern = /<sec\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(body))) {
    let depth = 1, cursor = pattern.lastIndex;
    const inner = /<\/?sec\b[^>]*>/gi;
    inner.lastIndex = cursor;
    let close: RegExpExecArray | null;
    while ((close = inner.exec(body))) { depth += close[0].startsWith('</') ? -1 : 1; if (!depth) { cursor = close.index; break; } }
    const block = body.slice(match.index, cursor);
    const heading = sectionTitle(block);
    const content = stripHtml(block.replace(/<title[^>]*>[\s\S]*?<\/title>/i, ''));
    if (content) sections.push({ title: heading || `Section ${sections.length + 1}`, text: content });
    pattern.lastIndex = cursor;
  }
  return sections;
}
