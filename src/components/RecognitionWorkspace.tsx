'use client';
import { Download, Sparkles } from 'lucide-react';
import { useRef, useState, useTransition } from 'react';
import { previewRecognitionText, readRecognitionSource, saveRecognizedProtocol, type RecognitionState } from '@/app/protocols/import/recognize/actions';
import { conversionSummaryLine } from '@/lib/protocol-conversion';
import type { RecognitionView } from '@/lib/protocol-recognition.server';
import type { Outline, RecognitionLanguage, ScopeChoice } from '@/lib/protocol-recognition-scope';
import { AiButton, useAiStatus } from './AiAssistant';
import { ProtocolDocumentView } from './ProtocolDocumentView';
import { photoSourceName } from '@/lib/protocol-photo';
import { ProductManualSearch } from './ProductManualSearch';
import { RecognitionDraft, problemLine } from './RecognitionDraft';
import { RecognitionPhotos } from './RecognitionPhotos';
import { LanguageChoice, RecognitionScope } from './RecognitionScope';
import type { ProductSearchSettingsView } from '@/lib/product-manuals.server';
import { Button } from './ui/Button';
import './method-design.css';

const kindLabels = { docx: 'Word', pdf: 'PDF', text: 'Text' } as const;
type Pending = { outline: Outline; choice: ScopeChoice };

/**
 * 整理说明书或非模板规程: read the source as written first (no AI). When that reads badly, the connected model organizes
 * it in two passes: 目录与范围 (confirmed by the author when there are workflows or systems to choose), then the full
 * Word template, every line citing its source lines and checked against them. The draft can be edited, downloaded as the
 * Word template and imported again without AI. Nothing is saved until 存为草稿规程.
 */
export function RecognitionWorkspace({ manualSettings, manualQuery }: { manualSettings: ProductSearchSettingsView; manualQuery?: string }) {
  const ai = useAiStatus();
  const [view, setView] = useState<RecognitionView>();
  const [title, setTitle] = useState('');
  const [goal, setGoal] = useState('');
  const [language, setLanguage] = useState<RecognitionLanguage>('zh');
  const [pasted, setPasted] = useState('');
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [scope, setScope] = useState<Pending>();
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const [thinking, setThinking] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const show = (result: RecognitionState) => {
    setError(result.error);
    if (!result.view) return;
    setView(result.view); setDraft(result.view.habitText); setEditing(false); setScope(undefined);
    if (!title && result.view.title) setTitle(result.view.title);
  };
  const read = () => start(async () => {
    const data = new FormData();
    const chosen = file.current?.files?.[0];
    if (chosen) data.set('file', chosen);
    data.set('text', pasted);
    show(await readRecognitionSource(data));
  });
  // Text read from pictures goes the way pasted text does, kept under a name that says the pictures were not kept.
  const readPhotos = (text: string, count: number) => start(async () => {
    const data = new FormData();
    data.set('text', text);
    data.set('name', photoSourceName(count));
    show(await readRecognitionSource(data));
  });
  /** Without a choice the first pass runs and may come back for the author to confirm; with one, the draft is written. */
  const organize = async (confirmed?: Pending) => {
    if (!view) return;
    setThinking(true); setError(undefined);
    try {
      const response = await fetch('/api/protocols/recognize', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sourceId: view.sourceId, title, goal, language: confirmed?.choice.language ?? language, ...(confirmed ?? {}) }) });
      const payload = await response.json() as { error?: string; view?: RecognitionView } & Partial<Pending>;
      if (!response.ok) setError(payload.error ?? 'AI organizing didn’t finish');
      else if (payload.view) show({ view: payload.view });
      else if (payload.outline && payload.choice) setScope({ outline: payload.outline, choice: payload.choice });
    } catch { setError('AI organizing didn’t finish; try again'); } finally { setThinking(false); }
  };
  const download = async () => {
    if (!view) return;
    setError(undefined);
    try {
      const response = await fetch('/api/protocols/recognize/docx', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ habitText: view.habitText, title: title || view.title }) });
      if (!response.ok) throw new Error();
      const name = decodeURIComponent(response.headers.get('content-disposition')?.match(/filename\*=UTF-8''([^;]+)/)?.[1] ?? 'Protocol.docx');
      const link = document.createElement('a');
      link.href = URL.createObjectURL(await response.blob()); link.download = name; link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    } catch { setError('The Word file could not be made; try again'); }
  };
  const busy = pending || thinking;
  const organized = view && view.mode !== 'rules' ? { model: view.model, promptVersion: view.promptVersion, scope: view.scope, outline: view.outline } : {};
  const anchored = Boolean(view?.promptVersion && view.sourcePages);
  return <div className="space-y-5">
    <ProductManualSearch settings={manualSettings} onTake={show} disabled={busy} initialQuery={manualQuery} />
    <section className="ln-design-form rounded-[var(--ln-radius-panel)] border border-hairline bg-surface p-4" aria-label="Choose the source">
      <label>Protocol name (optional; you can change it after reading)<input value={title} onChange={event => setTitle(event.target.value)} placeholder="e.g. Total RNA extraction from cells (Vazyme RC112)" /></label>
      <label>Goal (optional; sent to the model with the name)<input value={goal} onChange={event => setGoal(event.target.value)} placeholder="e.g. Extract plasmid DNA from 100 mL of culture for transfection" /></label>
      <label>Instructions or Protocol file (PDF, Word, TXT, Markdown)<input ref={file} type="file" accept=".pdf,.docx,.txt,.md" /></label>
      <label>Or paste the text<textarea rows={6} value={pasted} onChange={event => setPasted(event.target.value)} placeholder="Paste the procedure part of the instructions, or the whole Protocol" /></label>
      <RecognitionPhotos onText={readPhotos} disabled={busy} />
      <div className="flex flex-wrap items-center gap-3"><Button type="button" variant="primary" disabled={busy} onClick={read}>{pending && !view ? 'Reading the source…' : 'Read source'}</Button>
        <span className="ln-design-note">It is first read as written, without AI; if that reads badly, click “Organize with AI”: only then is the text sent to the model.</span></div>
    </section>
    {error ? <p role="alert" className="text-sm text-error">{error}</p> : null}
    {view ? <>
      <section className="space-y-3 rounded-[var(--ln-radius-panel)] border border-hairline bg-surface p-4" aria-label="Reading result">
        <p className="ln-design-note">{view.fileName}{` · ${kindLabels[view.kind]}${view.pages ? ` · ${view.pages} ${view.pages === 1 ? 'page' : 'pages'}` : ''} · ${view.chars} characters`}</p>
        {view.warnings.map(warning => <p key={warning} className="text-sm text-warning">{warning}</p>)}
        <h2 className="text-sm font-semibold text-ink">{view.mode === 'ai' ? <span className="ln-ai-tag">AI</span> : null}{`${view.mode === 'ai' ? ` organized (${view.model ?? ai.saved?.availability.providerName ?? 'the model'})` : view.mode === 'rules' ? 'Read as written (no AI)' : 'Read from the edited text'}: ${conversionSummaryLine(view.summary)}`}</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-graphite">
          {view.summary.systems.map(system => <li key={system}>{system}</li>)}
          {view.summary.conditions.length ? <li>{`Steps for some samples only: ${view.summary.conditions.join('; ')}`}</li> : null}
          {view.summary.keptAsText.length ? <li>{`Kept as text (sizes): ${view.summary.keptAsText.join(', ')}`}</li> : null}
          <li>{view.summary.resultTemplates ? `${view.summary.resultTemplates} ${view.summary.resultTemplates === 1 ? 'result template' : 'result templates'}` : 'No result templates (you can write “记录：…” in the editor)'}</li>
          {!view.summary.steps ? <li className="text-warning">No steps were read: the original may have no numbered steps. Organize it with AI, or edit the text and read it again.</li> : null}
        </ul>
        {view.check && anchored ? <div className="space-y-1 text-sm" aria-label="Line-by-line check">
          {view.check.unverified
            ? <p className="font-medium text-warning">{`${view.check.unverified} of ${view.check.lines.length} lines could not be found in the lines they cite; they are marked in the draft and will be saved as unverified.`}</p>
            : <p className="text-success">{`Each of the ${view.check.lines.length} lines was found in the lines it cites: its amounts, names and system order.`}</p>}
          {view.scope ? <p className="ln-design-note">{`Pages read: ${view.scope.pages.length} of ${view.sourcePages?.length ?? view.pages ?? 1}${view.sentChars ? ` · ${view.sentChars} characters sent` : ''}${view.mode === 'ai' && view.attempts ? ` · ${view.attempts} ${view.attempts === 1 ? 'model request' : 'model requests'} in the second pass` : ''}`}</p> : null}
        </div> : null}
        {view.check && !anchored ? <div className="space-y-1 text-sm" aria-label="Line-by-line check">
          {view.check.unverified ? <>
            <p className="font-medium text-warning">{`${view.check.unverified} ${view.check.unverified === 1 ? 'line has' : 'lines have'} no source in the original and will be marked unverified when saved:`}</p>
            <ul className="space-y-1 pl-5">{view.check.lines.filter(line => !line.verified).map(line => <li key={line.line} className="list-disc"><span className="text-ink">{line.line}</span><span className="block text-xs text-warning">{line.problems.map(problemLine).join('; ')}</span></li>)}</ul>
          </> : <p className="text-success">{`${view.check.lines.length === 1 ? 'The line has' : `Each of the ${view.check.lines.length} lines has`} a source in the original, and every number comes from it.`}</p>}
          {view.check.missing.length ? <><p className="font-medium text-warning">These sentences of the original carry amounts but don’t appear (perhaps notes left out on purpose; check them):</p><ul className="space-y-1 pl-5">{view.check.missing.map(sentence => <li key={sentence} className="list-disc text-graphite">{sentence}</li>)}</ul></> : null}
        </div> : null}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="primary" disabled={busy} onClick={() => start(async () => { const result = await saveRecognizedProtocol({ sourceId: view.sourceId, mode: view.mode, habitText: view.habitText, title, model: organized.model, promptVersion: organized.promptVersion, scope: organized.scope }); if (result?.error) setError(result.error); })}>Save as a draft Protocol</Button>
          {view.mode !== 'rules' ? <Button type="button" disabled={busy} onClick={() => { void download(); }}><Download className="h-4 w-4" aria-hidden />Download as Word template</Button> : null}
          {!scope ? <AiButton aria-busy={thinking} disabled={busy} onClick={() => { void organize(); }}><Sparkles className="h-4 w-4" aria-hidden />{thinking ? 'Organizing with AI… (may take a few minutes)' : view.mode === 'rules' ? 'Organize with AI' : 'Organize again with AI'}</AiButton> : null}
          {view.outline && view.scope && !scope ? <Button type="button" disabled={busy} onClick={() => setScope({ outline: view.outline!, choice: { workflow: view.scope!.workflow, systems: view.scope!.systems, language: view.scope!.language, dropped: view.scope!.dropped } })}>Change the scope</Button> : null}
          <Button type="button" disabled={busy} onClick={() => setEditing(value => !value)}>{editing ? 'Hide the text' : 'Edit the text'}</Button>
        </div>
        {!scope ? <LanguageChoice value={language} onChange={setLanguage} disabled={busy} /> : null}
        {scope ? <RecognitionScope outline={scope.outline} choice={scope.choice} busy={thinking} onConfirm={choice => { void organize({ outline: scope.outline, choice }); }} onCancel={() => setScope(undefined)} /> : null}
        {editing ? <div className="ln-design-form">
          <label>Text to organize (edit it the way “步骤：1. …”, “体系：…”, “仅…：” and “记录：…” are written; keep the positions 〔p3:12〕 at the end of lines)<textarea rows={16} value={draft} onChange={event => setDraft(event.target.value)} /></label>
          <div><Button type="button" disabled={busy} onClick={() => start(async () => show(await previewRecognitionText(view.sourceId, draft, organized)))}>Read again from the edited text</Button></div>
        </div> : null}
      </section>
      {anchored ? <section className="rounded-[var(--ln-radius-panel)] border border-hairline bg-surface p-4" aria-label="Draft and original">
        <RecognitionDraft text={view.habitText} check={view.check} pages={view.sourcePages ?? []} readPages={view.scope?.pages} />
      </section> : null}
      <ProtocolDocumentView document={view.document} title={title || view.title || view.fileName} version="预览 · 将存为 v0.1 草稿" />
    </> : null}
  </div>;
}
