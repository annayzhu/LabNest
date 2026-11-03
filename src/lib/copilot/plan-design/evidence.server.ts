import { readFile } from 'node:fs/promises';
import { resolveAttachmentPath } from '../../attachments';
import { prisma } from '../../db';
import { europePmcBase, fetchLimited, pubmedSearchBase, readMethodSearchSettings } from '../../method-sources/index.server';
import { readSourceFile } from '../../protocol-source-text.server';
import { lookupPaper, paperText, searchPapers, searchPubMed, type Paper, type PaperId } from '../literature';
import { MAX_FOUND, type Database, type EvidenceSearch, type FoundPaper } from './evidence';

/**
 * The ledger's outside requests (Q306): Europe PMC, and PubMed when Europe PMC fails. They run only while external
 * search with Europe PMC is switched on in the AI settings, and every request is logged with what was asked.
 */
export async function literatureAccess() {
  const settings = await readMethodSearchSettings();
  return settings.enabled && settings.sources.includes('europe_pmc');
}

async function assertAccess() {
  if (!await literatureAccess()) throw new Error('Literature search is off: turn on Europe PMC under External search on the AI page');
}

const logRequest = (runId: string, metadata: Record<string, string | number | null>) => prisma.activityLog.create({ data: { action: 'design_literature', targetType: 'research_plan_design_run', targetId: runId, metadataJson: metadata } });

/**
 * Each query on Europe PMC; once Europe PMC fails, the rest on PubMed. What was searched and what came back is kept
 * either way. When both fail for every query, the search stops with an error instead of reporting an empty result.
 */
export async function searchEvidence(runId: string, queries: string[], now: Date, known: Set<string>) {
  await assertAccess();
  const searches: EvidenceSearch[] = [];
  const papers: FoundPaper[] = [];
  let europeDown = false;
  for (const query of queries) {
    const at = now.toISOString();
    let found: Paper[] | undefined, database: Database = 'europe_pmc';
    if (!europeDown) {
      try { found = await searchPapers(query, fetchLimited, europePmcBase); }
      catch (error) { europeDown = true; searches.push({ at, database, query, results: 0, error: message(error) }); }
    }
    if (!found) {
      database = 'pubmed';
      try { found = await searchPubMed(query, fetchLimited, undefined, pubmedSearchBase); }
      catch (error) { searches.push({ at, database, query, results: 0, error: message(error) }); }
    }
    if (found) {
      searches.push({ at, database, query, results: found.length });
      for (const paper of found) if (!known.has(paper.key) && !papers.some(item => item.key === paper.key)) papers.push(foundPaper(paper, database));
    }
    await logRequest(runId, { kind: 'search', database, query, results: found?.length ?? null });
  }
  if (searches.every(search => search.error)) throw Object.assign(new Error('Europe PMC and PubMed both failed; the search stopped. Nothing was added.'), { searches });
  return { searches, papers: papers.slice(0, MAX_FOUND) };
}

/** One paper by PMID, PMCID or DOI. `paper` is undefined when neither database has it. */
export async function lookupEvidence(runId: string, id: PaperId) {
  await assertAccess();
  const result = await lookupPaper(id, fetchLimited, europePmcBase, pubmedSearchBase);
  await logRequest(runId, { kind: 'lookup', database: result.database, identifier: `${id.kind}:${id.value}`, found: result.paper ? 1 : 0 });
  return result;
}

/** What is read of a paper: the Methods and Results of an open-access full text, or the abstract; at most 16,000 characters. */
export async function evidenceText(runId: string, paper: Pick<FoundPaper, 'key' | 'title' | 'abstract' | 'openAccess'>, fullText: boolean) {
  await assertAccess();
  const read = await paperText({ key: paper.key, title: paper.title, abstract: paper.abstract, openAccess: paper.openAccess }, fetchLimited, europePmcBase, fullText);
  if (read.basis === 'fulltext') await logRequest(runId, { kind: 'fulltext', database: 'europe_pmc', identifier: paper.key, found: 1 });
  return { text: read.text.slice(0, 16_000), read: read.basis };
}

/** The text of a PDF the author attached to an entry, for the quote check. */
export async function pdfText(attachmentId: string) {
  const attachment = await prisma.attachment.findUniqueOrThrow({ where: { id: attachmentId } });
  const source = await readSourceFile(attachment.originalFilename, new Uint8Array(await readFile(resolveAttachmentPath(attachment.storagePath))));
  return source.text;
}

function foundPaper(paper: Paper, database: Database): FoundPaper {
  return { key: paper.key, database, title: paper.title, year: paper.year, venue: paper.venue, url: paper.url, pmid: paper.pmid, pmcid: paper.pmcid, doi: paper.doi, openAccess: paper.openAccess, abstract: paper.abstract?.slice(0, 6000), retracted: Boolean(paper.retracted), status: 'new' };
}

const message = (error: unknown) => (error instanceof Error ? error.message : 'Request failed').slice(0, 300);
