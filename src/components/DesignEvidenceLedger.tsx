'use client';
import { ExternalLink, Loader2, Search, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { databaseLabels, entryGaps, entryStatus, ledgerStatements, MAX_FOUND, relationLabels, relations, type EvidenceEntry, type Relation } from '@/lib/copilot/plan-design/evidence';
import { fullTextsLeft } from '@/lib/copilot/plan-design/workflow';
import { AiButton } from './AiAssistant';
import type { StepProps } from './DesignWorkbench';
import { Button } from './ui/Button';

/** A request on the ledger, sent as JSON, or as a form when it carries a PDF; resolves false when it failed. */
export type EvidenceCall = (label: string, body: Record<string, unknown> | FormData) => Promise<boolean>;

/**
 * The evidence ledger (§8.3, Q306, Q307). A paper counts only after three checks: it exists and is not retracted, its
 * quote appears word for word in what was read, and the author confirmed what it bears on and how. Searches are kept
 * with what they asked, so an empty one reads "not found within the recorded search". Shown from ② on.
 */
export function DesignEvidenceLedger({ run, busy, act, readiness, evidence, literature }: StepProps & { evidence: EvidenceCall; literature: boolean }) {
  const ledger = run.state.evidence;
  const entries = ledger?.entries ?? [];
  const counts = { verified: entries.filter(entry => entryStatus(entry) === 'verified').length, retracted: entries.filter(entry => entry.retracted).length };
  const targets = [...ledgerStatements(run.state.hypotheses?.draft, run.state.chain?.draft).map(item => ({ id: item.id, label: item.id === 'main' ? 'Main hypothesis' : item.text })), { id: 'background', label: 'Background' }];
  const fresh = (ledger?.found ?? []).filter(paper => paper.status === 'new');
  const [picked, setPicked] = useState<string[]>();
  const chosen = picked ?? fresh.slice(0, MAX_FOUND).map(paper => paper.key);
  const [reading, setReading] = useState<string>();
  const readPicked = async () => {
    const keys = fresh.filter(paper => chosen.includes(paper.key)).map(paper => paper.key);
    for (const [index, key] of keys.entries()) {
      setReading(`Reading ${index + 1} of ${keys.length}…`);
      if (!await evidence(`read:${key}`, { kind: 'read', key })) break;
    }
    setReading(undefined); setPicked(undefined);
  };
  const read = (ledger?.found ?? []).filter(paper => paper.status !== 'new');

  // Open where papers are gathered (②); folded to its counts in the later steps.
  return <details className="ln-dw-box ln-dw-ledger" open={run.step === 'hypotheses'}>
    <summary>{`Evidence ledger · ${counts.verified} verified · ${entries.length - counts.verified} to check${counts.retracted ? ` · ${counts.retracted} retracted` : ''}`}</summary>
    <p className="ln-dw-note">A paper counts as evidence only after three checks: it exists and is not retracted, its quote appears word for word in what was read, and you confirmed what it bears on. The rest stays listed as to check and is never written into the rationale. Without evidence the design still works; its items say common practice, not checked against the literature.</p>
    {!literature ? <p className="ln-dw-warn">Literature search is off. Turn on Europe PMC under <Link href="/ai#external-search" className="underline">External search on the AI page</Link> to search, look up a PMID or DOI, and check quotes.</p> : null}
    {literature ? <Queries key={(ledger?.queries ?? []).join('|')} queries={ledger?.queries ?? []} busy={busy} ready={readiness.ready} act={act} evidence={evidence} /> : null}
    {ledger?.searches.length ? <details><summary className="ln-dw-note">{`Search record (${ledger.searches.length})`}</summary><ul className="ln-dw-list">{ledger.searches.map((search, index) => <li key={index}>
      <span>{`${search.at.slice(0, 10)} · ${databaseLabels[search.database]} · “${search.query}”`}</span>
      <span className="ln-dw-note">{search.error ? `Failed: ${search.error}` : search.results ? `${search.results} papers` : 'Not found within the recorded search'}</span>
    </li>)}</ul></details> : null}
    {fresh.length ? <fieldset className="ln-dw-records"><legend>{`Search results to read (${fresh.length})`}</legend>
      {fresh.map(paper => <label key={paper.key} className="ln-dw-check">
        <input type="checkbox" checked={chosen.includes(paper.key)} onChange={event => setPicked(event.target.checked ? [...chosen, paper.key] : chosen.filter(key => key !== paper.key))} />
        <span><strong>{paper.title}</strong><small><Parts items={[[paper.year, paper.venue, databaseLabels[paper.database]].filter(Boolean).join(' · '), paper.openAccess ? 'Open access' : 'Abstract only', paper.retracted ? 'Retracted' : '']} /></small></span>
      </label>)}
      <div className="ln-dw-actions">
        <AiButton type="button" disabled={Boolean(busy) || !readiness.ready || !literature || !chosen.length} onClick={() => void readPicked()}>{reading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}{reading ?? `Read ${chosen.length} papers`}</AiButton>
        <span className="ln-dw-note">{`About ${chosen.length} model calls, one per paper; ${Math.max(0, fullTextsLeft(ledger))} more can be read in full text, the rest from their abstracts. The quote each one gives is looked up word for word.`}</span>
      </div>
    </fieldset> : null}
    {read.length ? <p className="ln-dw-note"><Parts items={readCounts(read)} /></p> : null}
    {literature ? <AddPaper targets={targets} busy={busy} evidence={evidence} /> : null}
    {entries.length ? <ol className="ln-dw-entries">{entries.map(entry => <Entry key={`${entry.id}:${entry.quote}`} entry={entry} targets={targets} busy={busy} literature={literature}
      onPatch={patch => act({ kind: 'evidence', entryId: entry.id, patch })} onRemove={() => act({ kind: 'evidence-remove', entryId: entry.id })}
      onQuote={quote => evidence(`quote:${entry.id}`, { kind: 'quote', entryId: entry.id, quote }).then(() => undefined)} />)}</ol> : <p className="ln-dw-note">No papers yet.</p>}
  </details>;
}

function readCounts(papers: { status: string }[]) {
  const count = (status: string) => papers.filter(paper => paper.status === status).length;
  return [count('read') ? `${count('read')} read into the ledger` : '', count('irrelevant') ? `${count('irrelevant')} not relevant` : '', count('failed') ? `${count('failed')} could not be read` : ''];
}

/** Pieces of one line, each its own text so the page translator reads them one by one. */
function Parts({ items }: { items: string[] }) {
  return <>{items.filter(Boolean).map((item, index) => <span key={index}>{index ? ' · ' : ''}<span>{item}</span></span>)}</>;
}

function Queries({ queries, busy, ready, act, evidence }: { queries: string[]; busy?: string; ready: boolean; act: StepProps['act']; evidence: EvidenceCall }) {
  const [draft, setDraft] = useState(queries.length ? queries : ['']);
  const cleaned = draft.map(query => query.trim()).filter(Boolean);
  const dirty = cleaned.join('|') !== queries.join('|');
  return <fieldset className="ln-dw-rows"><legend>Search terms</legend>
    <p className="ln-dw-note">English terms, one search each, at most three. LabNest searches Europe PMC, and PubMed when Europe PMC fails; the AI only proposes terms.</p>
    {draft.map((query, index) => <div key={index} className="ln-dw-row">
      <input aria-label="Search terms" className="is-grow" value={query} onChange={event => setDraft(draft.map((item, at) => at === index ? event.target.value : item))} placeholder="e.g. SRGN knockdown migration esophageal squamous" />
      <button type="button" className="ln-dw-icon" aria-label="Remove these terms" onClick={() => setDraft(draft.length > 1 ? draft.filter((_, at) => at !== index) : [''])}><Trash2 className="h-4 w-4" aria-hidden /></button>
    </div>)}
    <div className="ln-dw-actions">
      {draft.length < 3 ? <button type="button" className="ln-dw-link" onClick={() => setDraft([...draft, ''])}>Add terms</button> : null}
      <AiButton type="button" variant="ai" disabled={Boolean(busy) || !ready} onClick={() => void evidence('terms', { kind: 'terms' })}>{busy === 'terms' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}Draft search terms</AiButton>
      {dirty ? <Button type="button" size="sm" disabled={Boolean(busy)} onClick={() => void act({ kind: 'queries', queries: cleaned })}>Save the terms</Button> : null}
      <Button type="button" size="sm" disabled={Boolean(busy) || dirty || !queries.length} onClick={() => void evidence('search', { kind: 'search' })}>{busy === 'search' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Search className="h-4 w-4" aria-hidden />}Search</Button>
    </div>
  </fieldset>;
}

function AddPaper({ targets, busy, evidence }: { targets: { id: string; label: string }[]; busy?: string; evidence: EvidenceCall }) {
  const blank = { identifier: '', quote: '', target: targets[0]?.id ?? 'background', relation: 'subject' as Relation, system: '' };
  const [form, setForm] = useState(blank);
  const [pdf, setPdf] = useState<File>();
  const submit = async () => {
    const body: Record<string, string> = { kind: 'add', ...form };
    let payload: Record<string, unknown> | FormData = body;
    if (pdf) { const data = new FormData(); for (const [key, value] of Object.entries(body)) data.set(key, value); data.set('pdf', pdf); payload = data; }
    if (await evidence('add', payload)) { setForm(blank); setPdf(undefined); }
  };
  return <details className="ln-dw-add"><summary className="ln-dw-note">Add a paper you know</summary>
    <div className="ln-dw-fields">
      <label><span>PMID, PMCID or DOI</span><input value={form.identifier} onChange={event => setForm({ ...form, identifier: event.target.value })} placeholder="e.g. 31234567 or 10.1038/…" /></label>
      <label><span>What it bears on</span><select value={form.target} onChange={event => setForm({ ...form, target: event.target.value })}>{targets.map(target => <option key={target.id} value={target.id}>{target.label}</option>)}</select></label>
      <label><span>How</span><select value={form.relation} onChange={event => setForm({ ...form, relation: event.target.value as Relation })}>{relations.map(relation => <option key={relation} value={relation}>{relationLabels[relation]}</option>)}</select></label>
      <label><span>System it studied</span><input value={form.system} onChange={event => setForm({ ...form, system: event.target.value })} placeholder="Cell line, species or tissue" /></label>
      <label className="is-wide"><span>Quote, copied word for word from the abstract or the paper</span><textarea rows={2} value={form.quote} onChange={event => setForm({ ...form, quote: event.target.value })} /></label>
      <label><span>The paper as a PDF (optional, for a quote from the full text)</span><input type="file" accept="application/pdf,.pdf" onChange={event => setPdf(event.target.files?.[0])} /></label>
    </div>
    <div className="ln-dw-actions"><Button type="button" size="sm" disabled={Boolean(busy) || form.identifier.trim().length < 4} onClick={() => void submit()}>{busy === 'add' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}Add and check</Button>
      <span className="ln-dw-note">LabNest looks it up in Europe PMC (PubMed if that fails), flags a retraction, and looks for the quote word for word.</span></div>
  </details>;
}

const statusNames = { verified: 'Verified', pending: 'To check', retracted: 'Retracted' } as const;
const readNames = { abstract: 'abstract', fulltext: 'full text', pdf: 'PDF', '': '' } as const;

function Entry({ entry, targets, busy, literature, onPatch, onRemove, onQuote }: {
  entry: EvidenceEntry; targets: { id: string; label: string }[]; busy?: string; literature: boolean;
  onPatch: (patch: Partial<Pick<EvidenceEntry, 'target' | 'relation' | 'system' | 'note' | 'confirmed'>>) => Promise<void>; onRemove: () => Promise<void>; onQuote: (quote: string) => Promise<void>;
}) {
  const [quote, setQuote] = useState(entry.quote);
  const [system, setSystem] = useState(entry.system);
  const status = entryStatus(entry);
  const gaps = entryGaps(entry).filter(gap => gap !== 'Retracted');
  const id = entry.pmid ? `PMID ${entry.pmid}` : entry.pmcid ?? (entry.doi ? `doi:${entry.doi}` : '');
  return <li data-status={status}>
    <div className="ln-dw-entry-head">
      <span className="ln-dw-badge" data-tone={status === 'verified' ? 'ok' : status === 'retracted' ? 'serious' : 'warn'}>{statusNames[status]}</span>
      <strong>{entry.url ? <a href={entry.url} target="_blank" rel="noreferrer" className="ln-dw-paper">{entry.title}<ExternalLink className="h-3 w-3" aria-hidden /></a> : entry.title}</strong>
      <span className="ln-dw-note"><Parts items={[[entry.year, entry.venue, id].filter(Boolean).join(' · '), entry.found === 'author' ? 'Added by you' : entry.read ? `Found by search, read from the ${readNames[entry.read]}` : 'Found by search']} /></span>
    </div>
    {gaps.length && status !== 'verified' ? <p className="ln-dw-rule" data-severity={status === 'retracted' ? 'serious' : 'important'}><Parts items={gaps} /></p> : null}
    {status === 'retracted' ? <p className="ln-dw-rule" data-severity="serious">Retracted: it never counts as evidence. Remove it, or keep it here as a record.</p> : null}
    <div className="ln-dw-fields">
      <label><span>What it bears on</span><select value={entry.target} disabled={Boolean(busy)} onChange={event => void onPatch({ target: event.target.value })}>{targets.map(target => <option key={target.id} value={target.id}>{target.label}</option>)}</select></label>
      <label><span>How</span><select value={entry.relation} disabled={Boolean(busy)} onChange={event => void onPatch({ relation: event.target.value as Relation })}>{relations.map(relation => <option key={relation} value={relation}>{relationLabels[relation]}</option>)}</select></label>
      <label><span>System it studied</span><input value={system} onChange={event => setSystem(event.target.value)} onBlur={() => { if (system.trim() !== entry.system) void onPatch({ system }); }} /></label>
      <label className="is-wide"><span>Quoted passage</span><textarea rows={2} value={quote} onChange={event => setQuote(event.target.value)} /></label>
    </div>
    {entry.note ? <p className="ln-dw-note">{entry.note}</p> : null}
    <div className="ln-dw-actions">
      {quote.trim() !== entry.quote ? <Button type="button" size="sm" disabled={Boolean(busy) || !literature} onClick={() => void onQuote(quote)}>Check the quote again</Button> : null}
      <label className="ln-dw-check"><input type="checkbox" checked={entry.confirmed} disabled={Boolean(busy) || entry.retracted} onChange={event => void onPatch({ confirmed: event.target.checked })} />I checked what it bears on and how</label>
      <button type="button" className="ln-dw-link ln-dw-remove" disabled={Boolean(busy)} onClick={() => void onRemove()}><Trash2 className="h-3.5 w-3.5" aria-hidden />Remove</button>
    </div>
  </li>;
}
