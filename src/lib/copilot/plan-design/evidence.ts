import { z } from 'zod';
import { jsonObject } from '../structured';
import type { Chain, ContextCard, Hypotheses } from './spec';

/**
 * The evidence ledger (§8.3, Q306, Q307; K-Dense hypothesis-generation's source ledger and paper-lookup). A paper counts
 * as evidence only after three checks: it exists in a database and is not retracted, the quote it is cited for appears
 * word for word in what was read, and the author confirmed what it bears on and how. Anything short of that is listed
 * as "to check" and never written into the plan's rationale. A search records what was searched, so an empty result
 * reads "not found within the recorded search", never "nothing exists".
 */
export const relations = ['subject', 'counter', 'method', 'background'] as const;
export type Relation = typeof relations[number];
export const relationLabels: Record<Relation, string> = { subject: 'Supports the statement', counter: 'Counter-evidence', method: 'Method basis', background: 'Background' };
export const databases = ['europe_pmc', 'pubmed'] as const;
export type Database = typeof databases[number];
export const databaseLabels: Record<Database, string> = { europe_pmc: 'Europe PMC', pubmed: 'PubMed' };

export type EvidenceEntry = {
  id: string;
  /** search: read from a search result; author: added by PMID, DOI or PDF. */
  found: 'search' | 'author';
  database: Database | '';
  pmid?: string; pmcid?: string; doi?: string;
  title: string; authors?: string; year?: string; venue?: string; url?: string;
  /** ① The identifier resolved in a database; a retracted record never counts. */
  exists: 'yes' | 'no' | 'unchecked';
  retracted: boolean;
  /** ② The quote and where it was looked for. */
  quote: string;
  read: 'abstract' | 'fulltext' | 'pdf' | '';
  quoteFound: boolean;
  /** ③ What it bears on (a statement id: main, a rival, a block, or background) and how, confirmed by the author. */
  target: string;
  relation: Relation;
  system: string;
  note: string;
  confirmed: boolean;
  checkedAt: string;
  attachmentId?: string;
  /** The model that proposed the quote and relation, when one did. */
  model?: string;
};

/** A search result waiting to be read. */
export type FoundPaper = {
  key: string; database: Database; title: string; year?: string; venue?: string; url?: string;
  pmid?: string; pmcid?: string; doi?: string; openAccess: boolean; abstract?: string; retracted: boolean;
  status: 'new' | 'read' | 'irrelevant' | 'failed'; note?: string;
};
export type EvidenceSearch = { at: string; database: Database; query: string; results: number; error?: string };
export type Ledger = { entries: EvidenceEntry[]; searches: EvidenceSearch[]; queries: string[]; found: FoundPaper[] };
export const emptyLedger = (): Ledger => ({ entries: [], searches: [], queries: [], found: [] });

/** Papers read per search, and how many of them in full text (Q306). */
export const MAX_FOUND = 8, MAX_FULL_TEXTS = 3;

export type EntryStatus = 'verified' | 'pending' | 'retracted';
export const entryStatus = (entry: EvidenceEntry): EntryStatus => entry.retracted ? 'retracted' : entry.exists === 'yes' && entry.quoteFound && entry.confirmed ? 'verified' : 'pending';
/** What an entry still lacks, in the order the checks run. */
export function entryGaps(entry: EvidenceEntry) {
  const gaps: string[] = [];
  if (entry.retracted) gaps.push('Retracted');
  if (entry.exists === 'no') gaps.push('Not found in Europe PMC or PubMed');
  if (entry.exists === 'unchecked') gaps.push('Not looked up: give its PMID or DOI');
  if (!entry.quote.trim()) gaps.push('No quote');
  else if (!entry.quoteFound) gaps.push(entry.read ? 'The quote is not in the text word for word' : 'The quote was not checked: the text could not be read');
  if (!entry.confirmed) gaps.push('Relation not confirmed');
  return gaps;
}
/** The key a search result has: its PMC number when open access, else its PubMed number. */
export const paperKey = (entry: Pick<EvidenceEntry, 'pmcid' | 'pmid'>) => entry.pmcid ?? `MED:${entry.pmid}`;
export const verifiedEntries = (ledger?: Ledger) => (ledger?.entries ?? []).filter(entry => entryStatus(entry) === 'verified');

/** Quotes are compared ignoring case, spacing, typographic quotes and dashes; a quote under 20 characters proves nothing. */
const fold = (value: string) => value.normalize('NFKC').toLowerCase().replace(/­/g, '').replace(/[‐-―−]/g, '-').replace(/[“-‟]/g, '"').replace(/[‘-‛]/g, "'").replace(/\s+/g, ' ').trim();
export const trimQuote = (quote: string) => quote.trim().replace(/^["'“”‘’「」『』…\s]+|["'“”‘’「」『』…\s]+$/g, '').replace(/\.\.\.$|…$/, '').trim();
export function quoteIn(quote: string, text: string) {
  const needle = fold(trimQuote(quote));
  return needle.length >= 20 && fold(text).includes(needle);
}

/** A DOI, a PMCID or a PMID as typed or pasted (with or without its prefix or link). */
export function parseIdentifier(raw: string): { kind: 'pmid' | 'pmcid' | 'doi'; value: string } | undefined {
  const value = raw.trim();
  const doi = value.match(/10\.\d{4,9}\/[^\s"<>]+/);
  if (doi) return { kind: 'doi', value: doi[0].replace(/[.,;)]+$/, '') };
  const pmcid = value.match(/\bPMC\d{4,9}\b/i);
  if (pmcid) return { kind: 'pmcid', value: pmcid[0].toUpperCase() };
  const pmid = value.match(/^(?:PMID:?\s*|https?:\/\/pubmed\.ncbi\.nlm\.nih\.gov\/)?(\d{4,9})\/?$/i);
  return pmid ? { kind: 'pmid', value: pmid[1] } : undefined;
}

/** The statements a paper can bear on, with the ids the ledger records: the main hypothesis, each rival, each block. */
export function ledgerStatements(hypotheses?: Hypotheses, chain?: Chain) {
  const statements: { id: string; text: string }[] = [];
  if (hypotheses) {
    statements.push({ id: 'main', text: hypotheses.main.statement });
    for (const rival of hypotheses.rivals) statements.push({ id: rival.id, text: rival.statement });
  }
  for (const block of chain?.blocks ?? []) statements.push({ id: block.id, text: `${block.title}（方法与做法）` });
  return statements;
}

const common = '只输出一个 JSON 对象，不要其他文字。';

/** Search terms for the evidence boundary (Q311: LabNest searches; the model only proposes the terms). */
export function termsPrompt(card: ContextCard, hypotheses: Hypotheses) {
  return {
    system: [
      '你为研究方案的证据账本拟定文献检索词，只给检索词，不回答问题，不列文献。',
      '每条检索词用英文，3–8 个词，用基因名、蛋白名、细胞系、疾病和方法等专有名词，不用 AND/OR。最多 3 条：第一条针对主假设，其余针对最需要证据的对立解释或关键方法。',
      `输出：{"queries":[{"text":"SRGN knockdown migration esophageal squamous","for":"main"}]}，for 写 main、对立解释的 id（r1…）或 method。${common}`,
    ].join('\n'),
    user: JSON.stringify({ question: card.question, subject: card.subject, modelSystem: card.modelSystem, main: hypotheses.main.statement, rivals: hypotheses.rivals.filter(rival => rival.exclude).map(rival => ({ id: rival.id, text: rival.statement })) }, null, 1),
  };
}

const termsSchema = z.object({ queries: z.array(z.object({ text: z.string().trim().min(3).max(160), for: z.string().trim().max(12).default('main') })).min(1).max(5) });
export function parseTerms(raw: string) {
  const queries = termsSchema.parse(jsonObject(raw)).queries.map(item => item.text.replace(/\s+/g, ' ')).filter(query => /[A-Za-z]/.test(query));
  if (!queries.length) throw new Error('Give English search terms');
  return [...new Set(queries)].slice(0, 3);
}

/** Reading one paper: what it bears on, how, and one sentence copied from it, which the program then looks for. */
export function readPrompt(statements: { id: string; text: string }[], paper: { title: string; year?: string; venue?: string }, text: string) {
  return {
    system: [
      '你在为研究方案的证据账本读一篇论文。判断它与下面哪一条说法有关、是什么关系，并从论文原文中逐字复制一句话作为引文。',
      '引文必须是原文里连续的一句或半句，不改写、不翻译、不拼接、不加省略号；程序会在原文里逐字查找，找不到就不算数。',
      'relation：subject 支持这条说法（研究对象的证据）；counter 与这条说法相反（反证）；method 是做法、参数或对照的依据；background 只是背景。target 写说法的 id；只和课题背景有关时写 background。',
      '与所有说法都无关、或只是题目相近时，relevant 写 false，其他字段留空。system 写论文研究的体系（细胞系、物种或组织），原文没写就留空。note 用中文一句话说明这条证据说明了什么、不能说明什么。',
      `输出：{"relevant":true,"target":"main","relation":"subject","quote":"","system":"","note":""}。${common}`,
    ].join('\n'),
    user: `说法（id：内容）：\n${statements.map(item => `${item.id}：${item.text}`).join('\n')}\n\n论文：${paper.title}${paper.year ? `（${paper.year}${paper.venue ? `，${paper.venue}` : ''}）` : ''}\n原文：\n${text}`,
  };
}

const readingSchema = z.object({
  relevant: z.boolean(),
  target: z.string().trim().max(24).default('background'),
  relation: z.enum(relations).default('background'),
  quote: z.string().trim().max(1200).default(''),
  system: z.string().trim().max(300).default(''),
  note: z.string().trim().max(600).default(''),
});
export type Reading = z.infer<typeof readingSchema> & { quoteFound: boolean };

/**
 * The model's reading, its quote looked up in the text it was given. A quote that is not there is refused once, so the
 * model is asked again with the reason; on the second miss the reading is kept with the quote marked not found.
 */
export function readingReader(text: string, statementIds: string[]) {
  let attempts = 0;
  return (raw: string): Reading => {
    attempts += 1;
    const reading = readingSchema.parse(jsonObject(raw));
    if (!reading.relevant) return { ...reading, target: 'background', quote: '', quoteFound: false };
    const quote = trimQuote(reading.quote);
    const found = quoteIn(quote, text);
    if (!found && attempts === 1) throw new Error('The quote is not in the text word for word: copy one sentence exactly as it is written');
    return { ...reading, quote, target: statementIds.includes(reading.target) ? reading.target : 'background', quoteFound: found };
  };
}
