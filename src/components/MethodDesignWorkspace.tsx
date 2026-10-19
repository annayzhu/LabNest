'use client';
import { Sparkles } from 'lucide-react';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { addPastedMethod, chooseMethods, fetchMethod, generateDraft, saveManualCard, scaleDraft, searchAgain, summarizeMethod } from '@/app/protocols/design/actions';
import { methodCardSections, type MethodCard } from '@/lib/method-card';
import { scaleChangeLine, type ScaleChange } from '@/lib/method-scaling';
import type { MethodHit, MethodHitSource } from '@/lib/method-sources/types';
import { AiButton, useAiStatus } from './AiAssistant';
import { methodSourceNames } from './MethodDesignStart';
import { Button } from './ui/Button';
import './method-design.css';

type Draft = { protocolId: string; versionId: string; humanCode: string; title: string; displayVersion: string; reviewStage: string };
type Props = { sessionId: string; hits: MethodHit[]; cards: Record<string, MethodCard>; chosen: Array<{ key: string; reason?: string }>; searchErrors: string[]; lastQuery: string; draft: Draft | null };
const order: MethodHitSource[] = ['local', 'protocols_io', 'europe_pmc', 'manual'];
const volumeUnits = ['µL', 'mL', 'L'];

export function MethodDesignWorkspace({ sessionId, hits, cards, chosen, searchErrors, lastQuery, draft }: Props) {
  const ai = useAiStatus();
  const aiName = ai.saved?.availability.providerName;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string[]>(chosen.map(item => item.key));
  const [reason, setReason] = useState(chosen[0]?.reason ?? '');
  const [query, setQuery] = useState(lastQuery);
  const note = (key: string, text: string) => setNotes(current => ({ ...current, [key]: text }));
  const run = (key: string, work: () => Promise<{ error?: string; message?: string }>) => start(async () => {
    setBusy(key);
    try { const result = await work(); note(key, result.error ?? result.message ?? ''); if (!result.error) router.refresh(); }
    finally { setBusy(null); }
  });
  const grouped = order.map(source => ({ source, hits: hits.filter(hit => hit.source === source) })).filter(group => group.hits.length);
  const chosenHits = selected.map(key => hits.find(hit => hit.key === key)).filter((hit): hit is MethodHit => Boolean(hit));
  return <div className="space-y-5">
    <section className="ln-design-form" aria-label="Search again">
      <div className="ln-scale-row">
        <label style={{ flex: '1 1 16rem' }}>Search again with other keywords<input value={query} onChange={event => setQuery(event.target.value)} placeholder="e.g. siRNA transfection qPCR knockdown" /></label>
        <Button type="button" disabled={pending} onClick={() => run('search', () => searchAgain(sessionId, query))}>{busy === 'search' ? 'Searching again…' : 'Run the search'}</Button>
      </div>
      {notes.search ? <p role="status" className="ln-design-note">{notes.search}</p> : null}
      {searchErrors.length ? <p role="status" className="text-sm text-warning">{searchErrors.join('；')}</p> : null}
      {!ai.ready ? <p className="ln-design-note">No model connected: searching, fetching, comparing, generating a draft and scaling the system work as usual; for method cards use “Fill in a method card by hand”.</p> : null}
    </section>

    <PasteMethod sessionId={sessionId} query={query} pending={pending} onDone={text => { note('paste', text); router.refresh(); }} />
    {notes.paste ? <p role="status" className="ln-design-note">{notes.paste}</p> : null}

    {grouped.length ? grouped.map(group => <section key={group.source} className="space-y-2" aria-label={methodSourceNames[group.source]}>
      <h2 className="text-sm font-semibold text-ink">{methodSourceNames[group.source]} · {group.hits.length}</h2>
      <div className="ln-hits">{group.hits.map(hit => {
        const card = cards[hit.key], picked = selected.includes(hit.key);
        return <article key={hit.key} className="ln-hit" data-chosen={picked || undefined}>
          <input type="checkbox" aria-label={`Add “${hit.title}” to the comparison`} checked={picked} onChange={event => setSelected(current => event.target.checked ? [...current, hit.key] : current.filter(key => key !== hit.key))} />
          <div className="min-w-0">
            <div className="ln-hit-head">
              {hit.url ? <Link href={hit.url} target={hit.source === 'local' ? undefined : '_blank'} rel="noreferrer"><strong>{hit.title}</strong></Link> : <strong>{hit.title}</strong>}
              <span className="ln-hit-source">{methodSourceNames[hit.source]}</span>
              <span className="ln-hit-meta">{[hit.authors, hit.year, hit.venue, hit.license ? `License: ${hit.license}` : ''].filter(Boolean).join(' · ')}</span>
            </div>
            {hit.snippet ? <p className="ln-hit-snippet">{hit.snippet}</p> : null}
            <div className="ln-hit-actions">
              {hit.source !== 'manual' ? <Button type="button" size="sm" disabled={pending} onClick={() => run(hit.key, () => fetchMethod(sessionId, hit.key))}>{busy === hit.key ? 'Working…' : hit.attachmentId ? 'Fetch the original again' : 'Fetch the original'}</Button> : null}
              {hit.attachmentId ? <a href={`/api/attachments/${hit.attachmentId}`} target="_blank" rel="noreferrer">View the fetched original</a> : null}
              {hit.attachmentId ? <AiButton type="button" size="sm" disabled={pending} onClick={() => run(hit.key, () => summarizeMethod(sessionId, hit.key))}><Sparkles className="h-4 w-4" aria-hidden />{card && !card.byHand ? 'Summarize again' : `Summarize as a method card${ai.ready && aiName ? ` (${aiName})` : ''}`}</AiButton> : null}
              {hit.attachmentId ? <Button type="button" size="sm" variant="primary" disabled={pending || Boolean(draft)} onClick={() => run(hit.key, () => generateDraft(sessionId, hit.key))}>Generate a draft Protocol</Button> : null}
              <span className={`ln-hit-status${hit.fetchError ? ' is-error' : ''}`}>{hit.fetchError ? `Fetch failed: ${hit.fetchError}` : hit.fetchedAt ? `${hit.source === 'manual' ? 'Pasted' : 'Fetched'} ${hit.textChars} characters · ${hit.fetchedAt.slice(0, 16).replace('T', ' ')}` : 'Not fetched yet'}</span>
            </div>
            {notes[hit.key] ? <p role="status" className="ln-design-note">{notes[hit.key]}</p> : null}
            {card ? <MethodCardView card={card} /> : null}
            {hit.attachmentId ? <ManualCardForm sessionId={sessionId} hitKey={hit.key} card={card?.byHand ? card : undefined} pending={pending} onDone={text => { note(hit.key, text); router.refresh(); }} /> : null}
          </div>
        </article>;
      })}</div>
    </section>) : <p className="text-sm text-muted">No methods found. Try other keywords, or turn on the open databases in Search settings.</p>}

    {chosenHits.length ? <section className="space-y-2" aria-label="Compare candidates">
      <h2 className="text-sm font-semibold text-ink">Compare candidates · {chosenHits.length}</h2>
      <div className="ln-compare"><table>
        <thead><tr><th scope="col" className="is-row">Compared aspect</th>{chosenHits.map(hit => <th key={hit.key} scope="col">{hit.title}<br /><span className="font-normal">{methodSourceNames[hit.source]}{hit.license ? ` · ${hit.license}` : ''}</span></th>)}</tr></thead>
        <tbody>
          <tr><th scope="row" className="is-row">One-line summary</th>{chosenHits.map(hit => <td key={hit.key}>{cards[hit.key]?.summary || 'Not summarized yet'}</td>)}</tr>
          <tr><th scope="row" className="is-row">Time needed</th>{chosenHits.map(hit => <td key={hit.key}>{cards[hit.key]?.duration || '—'}</td>)}</tr>
          {methodCardSections.map(section => <tr key={section.key}><th scope="row" className="is-row">{section.label}</th>{chosenHits.map(hit => <td key={hit.key}>{cards[hit.key]?.[section.key].length ? <ul>{cards[hit.key][section.key].map((item, index) => <li key={index} className="ln-card-line" data-unverified={item.verified ? undefined : ''} title={item.problem}>{item.text}</li>)}</ul> : '—'}</td>)}</tr>)}
          <tr><th scope="row" className="is-row">Not verified</th>{chosenHits.map(hit => <td key={hit.key}>{cards[hit.key] ? `${cards[hit.key].unverified} ${cards[hit.key].unverified === 1 ? 'statement' : 'statements'}` : '—'}</td>)}</tr>
        </tbody>
      </table></div>
      <div className="ln-scale-row">
        <label style={{ flex: '1 1 16rem' }}>Reason for the choice (optional)<input value={reason} onChange={event => setReason(event.target.value)} placeholder="e.g. follows on from our TRIzol method; reagents on hand" /></label>
        <Button type="button" disabled={pending} onClick={() => run('choose', () => chooseMethods(sessionId, selected, reason))}>{busy === 'choose' ? 'Saving the choice…' : 'Save choice'}</Button>
      </div>
      {notes.choose ? <p role="status" className="ln-design-note">{notes.choose}</p> : null}
    </section> : null}

    {draft ? <DraftPanel draft={draft} pending={pending} /> : null}
  </div>;
}

/** Sites without an API: open their own search in a new tab, then paste the method here. It joins the hits like a fetched text. */
function PasteMethod({ sessionId, query, pending, onDone }: { sessionId: string; query: string; pending: boolean; onDone: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ title: '', url: '', license: '', text: '' });
  const [adding, start] = useTransition();
  const q = encodeURIComponent(query.trim());
  const links = [['JoVE', `https://www.jove.com/search?query=${q}`], ['Bio-protocol', `https://bio-protocol.org/en/search?q=${q}`], ['protocols.io website', `https://www.protocols.io/search?q=${q}`], ['Google Scholar', `https://scholar.google.com/scholar?q=${q}`]] as const;
  return <section className="ln-design-settings" aria-label="Paste the original text">
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1"><strong>Sites without an API (JoVE, Bio-protocol…)</strong><span className="ln-design-note">Search on the site and paste the method text here; method cards, comparison and draft generation then work the same:</span></div>
    <div className="ln-hit-actions">{links.map(([label, href]) => <a key={label} href={href} target="_blank" rel="noreferrer">{`Search ${label} ↗`}</a>)}<button type="button" className="focus-ring text-xs text-moss underline" onClick={() => setOpen(value => !value)}>{open ? 'Collapse' : 'Paste the original text…'}</button></div>
    {open ? <div className="ln-design-form">
      <label>Title<input value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} placeholder="e.g. JoVE 62123 · Lipofectamine siRNA transfection of adherent cells" /></label>
      <div className="ln-source-pair"><label>Link (optional)<input value={draft.url} inputMode="url" onChange={event => setDraft({ ...draft, url: event.target.value })} placeholder="https://www.jove.com/…" /></label><label>License (optional)<input value={draft.license} onChange={event => setDraft({ ...draft, license: event.target.value })} placeholder="e.g. CC BY-NC-ND 3.0, or “subscription content”" /></label></div>
      <label>Method text<textarea rows={8} value={draft.text} onChange={event => setDraft({ ...draft, text: event.target.value })} placeholder="Paste the Protocol part; one step per paragraph works best." /></label>
      <div><Button type="button" size="sm" variant="primary" disabled={pending || adding || !draft.title.trim() || draft.text.trim().length < 40} onClick={() => start(async () => { const result = await addPastedMethod(sessionId, { title: draft.title, url: draft.url || undefined, license: draft.license || undefined, text: draft.text }); onDone(result.error ?? result.message ?? ''); if (!result.error) { setDraft({ title: '', url: '', license: '', text: '' }); setOpen(false); } })}>Add to candidates</Button></div>
      <p className="ln-design-note">Pasted text is kept only as an attachment on this site and is never sent to an outside service; it goes to the model only when you click “Summarize as a method card”.</p>
    </div> : null}
  </section>;
}

function MethodCardView({ card }: { card: MethodCard }) {
  return <div className="ln-card" aria-label="Method card">
    {card.summary ? <p className="ln-card-summary">{card.summary}{card.duration ? ` · takes ${card.duration}` : ''}</p> : null}
    <dl className="ln-card-section">{methodCardSections.filter(section => card[section.key].length).map(section => <div key={section.key} className="contents"><dt>{section.label}</dt><dd><ul>{card[section.key].map((item, index) => <li key={index} className="ln-card-line" data-unverified={item.verified ? undefined : ''}>{item.text}{item.problem ? <span className="ln-card-problem">（未核实：{item.problem}）</span> : null}{item.quote ? <span className="ln-card-quote">“{item.quote}”</span> : null}</li>)}</ul></dd></div>)}</dl>
    <p className="ln-card-foot">{card.byHand ? 'Filled in by hand' : <><span className="ln-ai-tag">AI</span> {`Summarized by ${card.provider ?? 'the model'}${card.model ? ` · ${card.model}` : ''}; ${card.unverified ? `${card.unverified} ${card.unverified === 1 ? 'statement has' : 'statements have'} no support in the original` : 'every statement is supported by the original'}`}</>} · {card.madeAt.slice(0, 16).replace('T', ' ')}</p>
  </div>;
}

function ManualCardForm({ sessionId, hitKey, card, pending, onDone }: { sessionId: string; hitKey: string; card?: MethodCard; pending: boolean; onDone: (text: string) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>(() => ({ summary: card?.summary ?? '', ...Object.fromEntries(methodCardSections.map(section => [section.key, (card?.[section.key] ?? []).map(item => item.text).join('\n')])) }));
  const [saving, start] = useTransition();
  if (!open) return <button type="button" className="focus-ring text-xs text-moss underline" onClick={() => setOpen(true)}>{card?.byHand ? 'Edit the hand-written method card' : 'Fill in a method card by hand'}</button>;
  return <div className="ln-card ln-card-manual" aria-label="Hand-written method card">
    <label className="grid gap-1 text-xs text-muted">One-sentence summary<input className="ln-prep-note-input" style={{ margin: 0 }} value={draft.summary} onChange={event => setDraft({ ...draft, summary: event.target.value })} /></label>
    {methodCardSections.map(section => <label key={section.key} className="grid gap-1 text-xs text-muted">{`${section.label} (one per line)`}<textarea className="ln-prep-note-input" style={{ margin: 0, height: 'auto' }} rows={2} value={draft[section.key]} onChange={event => setDraft({ ...draft, [section.key]: event.target.value })} /></label>)}
    <div className="flex gap-2"><Button type="button" size="sm" disabled={pending || saving} onClick={() => start(async () => { const result = await saveManualCard(sessionId, hitKey, draft as { summary: string }); onDone(result.error ?? result.message ?? ''); if (!result.error) setOpen(false); })}>Save method card</Button><Button type="button" size="sm" onClick={() => setOpen(false)}>Cancel</Button></div>
  </div>;
}

/** The draft exists: open it, adapt its system, or start an Experiment from it (which runs the preparation check first). */
function DraftPanel({ draft, pending }: { draft: Draft; pending: boolean }) {
  const ai = useAiStatus();
  const [working, start] = useTransition();
  const [form, setForm] = useState({ fromValue: '20', fromUnit: 'µL', toValue: '10', toUnit: 'µL', label: '反应体系', explain: true });
  const [result, setResult] = useState<{ error?: string; message?: string; changes?: ScaleChange[]; explanation?: string } | null>(null);
  const explain = form.explain && ai.ready;
  return <section className="ln-scale" aria-label="Draft Protocol">
    <h2 className="text-sm font-semibold text-ink">{`Draft Protocol · ${draft.humanCode} · ${draft.title} v${draft.displayVersion} (${draft.reviewStage})`}</h2>
    <div className="ln-hit-actions">
      <Link href={`/protocols/${draft.protocolId}/versions/${draft.versionId}/edit`}>Tidy up in the editor</Link>
      <Link href={`/protocols/${draft.protocolId}?version=${draft.versionId}`}>Preview</Link>
      <Link href={`/experiments/new?protocolVersionId=${draft.versionId}`}>Start an Experiment (with the pre-run check)</Link>
    </div>
    <p className="ln-design-note">Scaling the system: volumes, masses and amounts of substance scale in proportion; times, temperatures, concentrations and equipment settings stay; cell numbers and enzyme units are listed for you to confirm; lookup values (values by system) are not changed. The result is written into the draft as an optional system dimension, chosen at run time.</p>
    <div className="ln-scale-row">
      <label>Original system<input inputMode="decimal" value={form.fromValue} onChange={event => setForm({ ...form, fromValue: event.target.value })} /></label>
      <label>Unit<select value={form.fromUnit} onChange={event => setForm({ ...form, fromUnit: event.target.value })}>{volumeUnits.map(unit => <option key={unit}>{unit}</option>)}</select></label>
      <label>New system<input inputMode="decimal" value={form.toValue} onChange={event => setForm({ ...form, toValue: event.target.value })} /></label>
      <label>Unit<select value={form.toUnit} onChange={event => setForm({ ...form, toUnit: event.target.value })}>{volumeUnits.map(unit => <option key={unit}>{unit}</option>)}</select></label>
      <label>Dimension name<input value={form.label} onChange={event => setForm({ ...form, label: event.target.value })} /></label>
      <label className="is-check" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><input type="checkbox" checked={explain} disabled={!ai.ready} onChange={event => setForm({ ...form, explain: event.target.checked })} />Ask the model to explain (numbers unchanged){!ai.ready ? <button type="button" className="focus-ring text-xs text-muted underline" onClick={ai.openPanel}>Needs AI turned on</button> : null}</label>
      <Button type="button" variant="primary" disabled={pending || working || draft.reviewStage !== 'draft'} onClick={() => start(async () => { setResult(await scaleDraft({ versionId: draft.versionId, fromValue: Number(form.fromValue), fromUnit: form.fromUnit, toValue: Number(form.toValue), toUnit: form.toUnit, label: form.label, explain: explain })); })}>{working ? 'Scaling…' : 'Scale and write into the draft'}</Button>
    </div>
    {result?.error ? <p role="alert" className="text-sm text-error">{result.error}</p> : null}
    {result?.message ? <p role="status" className="text-sm text-success">{result.message}</p> : null}
    {result?.changes?.length ? <ul className="ln-scale-changes">{result.changes.map(change => <li key={change.parameterId} data-rule={change.rule}>{scaleChangeLine(change)}</li>)}</ul> : null}
    {result?.explanation ? <p className="ln-scale-explanation">{result.explanation}</p> : null}
  </section>;
}
