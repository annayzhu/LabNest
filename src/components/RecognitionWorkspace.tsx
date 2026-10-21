'use client';
import { Sparkles } from 'lucide-react';
import { useRef, useState, useTransition } from 'react';
import { previewRecognitionText, readRecognitionSource, saveRecognizedProtocol, type RecognitionState } from '@/app/protocols/import/recognize/actions';
import { conversionSummaryLine } from '@/lib/protocol-conversion';
import type { RecognitionView } from '@/lib/protocol-recognition.server';
import { AiButton, useAiStatus } from './AiAssistant';
import { ProtocolDocumentView } from './ProtocolDocumentView';
import { photoSourceName } from '@/lib/protocol-photo';
import { ProductManualSearch } from './ProductManualSearch';
import { RecognitionPhotos } from './RecognitionPhotos';
import type { ProductSearchSettingsView } from '@/lib/product-manuals.server';
import { Button } from './ui/Button';
import './method-design.css';

const kindLabels = { docx: 'Word', pdf: 'PDF', text: 'Text' } as const;

/** checkRecognition words a line's problems in Chinese, for the repair prompt; on the page they read in English. */
const problemLine = (problem: string): string => {
  const condition = problem.match(/^条件“([^”]*)”([\s\S]+)$/);
  if (condition) return `Condition “${condition[1]}”: ${problemLine(condition[2])}`;
  return problem.replace(/^原文中找不到出处（最接近的一处只对上 (\d+)%）$/, 'No source in the original (the closest place matches only $1%)')
    .replace(/^数值不在原文：([\s\S]+)$/, (_, numbers: string) => `Numbers not in the original: ${numbers.split('、').join(', ')}`)
    .replace(/^记录项原文中找不到：([\s\S]+)$/, 'Record item not found in the original: $1');
};

/**
 * 整理说明书或非模板规程: read the source as written first (no AI); when that reads badly, the connected model lays it
 * out and every line is checked against the original. Nothing is saved until 存为草稿规程.
 */
export function RecognitionWorkspace({ manualSettings }: { manualSettings: ProductSearchSettingsView }) {
  const ai = useAiStatus();
  const [view, setView] = useState<RecognitionView>();
  const [title, setTitle] = useState('');
  const [pasted, setPasted] = useState('');
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const [thinking, setThinking] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const show = (result: RecognitionState) => {
    setError(result.error);
    if (!result.view) return;
    setView(result.view); setDraft(result.view.habitText); setEditing(false);
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
  const recognize = async () => {
    if (!view) return;
    setThinking(true); setError(undefined);
    try {
      const response = await fetch('/api/protocols/recognize', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sourceId: view.sourceId }) });
      const payload = await response.json() as { error?: string; view?: RecognitionView };
      show(response.ok ? { view: payload.view } : { error: payload.error ?? 'AI organizing didn’t finish' });
    } catch { setError('AI organizing didn’t finish; try again'); } finally { setThinking(false); }
  };
  const busy = pending || thinking;
  return <div className="space-y-5">
    <ProductManualSearch settings={manualSettings} onTake={show} disabled={busy} />
    <section className="ln-design-form rounded-[var(--ln-radius-panel)] border border-hairline bg-surface p-4" aria-label="Choose the source">
      <label>Protocol name (optional; you can change it after reading)<input value={title} onChange={event => setTitle(event.target.value)} placeholder="e.g. Total RNA extraction from cells (Vazyme RC112)" /></label>
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
        <h2 className="text-sm font-semibold text-ink">{view.mode === 'ai' ? <span className="ln-ai-tag">AI</span> : null}{`${view.mode === 'ai' ? ` organized (${view.model ?? ai.saved?.availability.providerName ?? 'the model'}${view.attempts === 2 ? ', redone once after the check' : ''})` : view.mode === 'rules' ? 'Read as written (no AI)' : 'Read from the edited text'}: ${conversionSummaryLine(view.summary)}`}</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-graphite">
          {view.summary.systems.map(system => <li key={system}>{system}</li>)}
          {view.summary.conditions.length ? <li>{`Steps for some samples only: ${view.summary.conditions.join('; ')}`}</li> : null}
          {view.summary.keptAsText.length ? <li>{`Kept as text (sizes): ${view.summary.keptAsText.join(', ')}`}</li> : null}
          <li>{view.summary.resultTemplates ? `${view.summary.resultTemplates} ${view.summary.resultTemplates === 1 ? 'result template' : 'result templates'}` : 'No result templates (you can write “记录：…” in the editor)'}</li>
          {!view.summary.steps ? <li className="text-warning">No steps were read: the original may have no numbered steps. Organize it with AI, or edit the text and read it again.</li> : null}
        </ul>
        {view.check ? <div className="space-y-1 text-sm" aria-label="Line-by-line check">
          {view.check.unverified ? <>
            <p className="font-medium text-warning">{`${view.check.unverified} ${view.check.unverified === 1 ? 'line has' : 'lines have'} no source in the original and will be marked unverified when saved:`}</p>
            <ul className="space-y-1 pl-5">{view.check.lines.filter(line => !line.verified).map(line => <li key={line.line} className="list-disc"><span className="text-ink">{line.line}</span><span className="block text-xs text-warning">{line.problems.map(problemLine).join('; ')}</span></li>)}</ul>
          </> : <p className="text-success">{`${view.check.lines.length === 1 ? 'The line has' : `Each of the ${view.check.lines.length} lines has`} a source in the original, and every number comes from it.`}</p>}
          {view.check.missing.length ? <><p className="font-medium text-warning">These sentences of the original carry amounts but don’t appear (perhaps notes left out on purpose; check them):</p><ul className="space-y-1 pl-5">{view.check.missing.map(sentence => <li key={sentence} className="list-disc text-graphite">{sentence}</li>)}</ul></> : null}
          {view.truncated ? <p className="text-warning">The original is long: only its first 30,000 characters went to the model.</p> : null}
        </div> : null}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="primary" disabled={busy} onClick={() => start(async () => { const result = await saveRecognizedProtocol({ sourceId: view.sourceId, mode: view.mode, habitText: view.habitText, title, model: view.model }); if (result?.error) setError(result.error); })}>Save as a draft Protocol</Button>
          <AiButton aria-busy={thinking} disabled={busy} onClick={recognize}><Sparkles className="h-4 w-4" aria-hidden />{thinking ? 'Organizing with AI… (may take a minute or two)' : view.mode === 'ai' ? 'Organize again with AI' : 'Organize with AI'}</AiButton>
          <Button type="button" disabled={busy} onClick={() => setEditing(value => !value)}>{editing ? 'Hide the text' : 'Edit the text'}</Button>
        </div>
        {editing ? <div className="ln-design-form">
          <label>Text to organize (edit it the way “步骤：1. …”, “体系：…”, “仅…：” and “记录：…” are written)<textarea rows={16} value={draft} onChange={event => setDraft(event.target.value)} /></label>
          <div><Button type="button" disabled={busy} onClick={() => start(async () => show(await previewRecognitionText(view.sourceId, draft, view.model)))}>Read again from the edited text</Button></div>
        </div> : null}
      </section>
      <ProtocolDocumentView document={view.document} title={title || view.title || view.fileName} version="预览 · 将存为 v0.1 草稿" />
    </> : null}
  </div>;
}
