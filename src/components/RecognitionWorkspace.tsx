'use client';
import { Sparkles } from 'lucide-react';
import { useRef, useState, useTransition } from 'react';
import { previewRecognitionText, readRecognitionSource, saveRecognizedProtocol, type RecognitionState } from '@/app/protocols/import/recognize/actions';
import { conversionSummaryText } from '@/lib/protocol-conversion';
import type { RecognitionView } from '@/lib/protocol-recognition.server';
import { AiButton, useAiStatus } from './AiAssistant';
import { ProtocolDocumentView } from './ProtocolDocumentView';
import { Button } from './ui/Button';
import './method-design.css';

const kindLabels = { docx: 'Word', pdf: 'PDF', text: '文字' } as const;

/**
 * 整理说明书或非模板规程: read the source as written first (no AI); when that reads badly, the connected model lays it
 * out and every line is checked against the original. Nothing is saved until 存为草稿规程.
 */
export function RecognitionWorkspace() {
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
  const recognize = async () => {
    if (!view) return;
    setThinking(true); setError(undefined);
    try {
      const response = await fetch('/api/protocols/recognize', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sourceId: view.sourceId }) });
      const payload = await response.json() as { error?: string; view?: RecognitionView };
      show(response.ok ? { view: payload.view } : { error: payload.error ?? 'AI 整理没有完成' });
    } catch { setError('AI 整理没有完成，请重试'); } finally { setThinking(false); }
  };
  const busy = pending || thinking;
  return <div className="space-y-5">
    <section className="ln-design-form rounded-[var(--ln-radius-panel)] border border-hairline bg-surface p-4" aria-label="选择来源">
      <label>规程名称（可留空，读取后可改）<input value={title} onChange={event => setTitle(event.target.value)} placeholder="例如：细胞总 RNA 提取（Vazyme RC112）" /></label>
      <label>说明书或规程文件（PDF、Word、TXT、Markdown）<input ref={file} type="file" accept=".pdf,.docx,.txt,.md" /></label>
      <label>或粘贴文字<textarea rows={6} value={pasted} onChange={event => setPasted(event.target.value)} placeholder="把说明书的操作部分或规程全文粘贴进来" /></label>
      <div className="flex flex-wrap items-center gap-3"><Button type="button" variant="primary" disabled={busy} onClick={read}>{pending && !view ? '读取中…' : '读取'}</Button>
        <span className="ln-design-note">先按写法读取，不用 AI；读得不好再点“用 AI 整理”，只有那时文字才会发给模型。</span></div>
    </section>
    {error ? <p role="alert" className="text-sm text-error">{error}</p> : null}
    {view ? <>
      <section className="space-y-3 rounded-[var(--ln-radius-panel)] border border-hairline bg-surface p-4" aria-label="读取结果">
        <p className="ln-design-note">{view.fileName} · {kindLabels[view.kind]}{view.pages ? ` · ${view.pages} 页` : ''} · {view.chars} 字</p>
        {view.warnings.map(warning => <p key={warning} className="text-sm text-warning">{warning}</p>)}
        <h2 className="text-sm font-semibold text-ink">{view.mode === 'ai' ? <><span className="ln-ai-tag">AI</span> 整理（{view.model ?? ai.saved?.availability.providerName ?? '模型'}{view.attempts === 2 ? '，核对后重做了一次' : ''}）</> : view.mode === 'rules' ? '按写法读取（未用 AI）' : '按修改后的文字读取'}：{conversionSummaryText(view.summary)}</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-graphite">
          {view.summary.systems.map(system => <li key={system}>{system}</li>)}
          {view.summary.conditions.length ? <li>只对部分样本的步骤：{view.summary.conditions.join('；')}</li> : null}
          {view.summary.keptAsText.length ? <li>按规格保持为文字：{view.summary.keptAsText.join('、')}</li> : null}
          <li>{view.summary.resultTemplates ? `${view.summary.resultTemplates} 个结果模板` : '没有结果模板（可在编辑器里写“记录：…”）'}</li>
          {!view.summary.steps ? <li className="text-warning">没有读出步骤：原文可能没有编号步骤，可以用 AI 整理，或修改文字后重新读取。</li> : null}
        </ul>
        {view.check ? <div className="space-y-1 text-sm" aria-label="逐行核对">
          {view.check.unverified ? <>
            <p className="font-medium text-warning">{view.check.unverified} 行在原文中找不到出处，保存后会标为未核实：</p>
            <ul className="space-y-1 pl-5">{view.check.lines.filter(line => !line.verified).map(line => <li key={line.line} className="list-disc"><span className="text-ink">{line.line}</span><span className="block text-xs text-warning">{line.problems.join('；')}</span></li>)}</ul>
          </> : <p className="text-success">{view.check.lines.length} 行都在原文中找到出处，数值都来自原文。</p>}
          {view.check.missing.length ? <><p className="font-medium text-warning">原文中这些含用量的句子没有出现（可能是有意删去的说明，请核对）：</p><ul className="space-y-1 pl-5">{view.check.missing.map(sentence => <li key={sentence} className="list-disc text-graphite">{sentence}</li>)}</ul></> : null}
          {view.truncated ? <p className="text-warning">原文较长，只有前 30,000 字交给了模型。</p> : null}
        </div> : null}
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="primary" disabled={busy} onClick={() => start(async () => { const result = await saveRecognizedProtocol({ sourceId: view.sourceId, mode: view.mode, habitText: view.habitText, title, model: view.model }); if (result?.error) setError(result.error); })}>存为草稿规程</Button>
          <AiButton aria-busy={thinking} disabled={busy} onClick={recognize}><Sparkles className="h-4 w-4" aria-hidden />{thinking ? 'AI 整理中…（可能要一两分钟）' : view.mode === 'ai' ? '让 AI 重新整理' : '用 AI 整理'}</AiButton>
          <Button type="button" disabled={busy} onClick={() => setEditing(value => !value)}>{editing ? '收起文字' : '修改文字'}</Button>
        </div>
        {editing ? <div className="ln-design-form">
          <label>整理用的文字（按“步骤：1. …”“体系：…”“仅…：”“记录：…”的写法修改）<textarea rows={16} value={draft} onChange={event => setDraft(event.target.value)} /></label>
          <div><Button type="button" disabled={busy} onClick={() => start(async () => show(await previewRecognitionText(view.sourceId, draft, view.model)))}>按修改后的文字重新读取</Button></div>
        </div> : null}
      </section>
      <ProtocolDocumentView document={view.document} title={title || view.title || view.fileName} version="预览 · 将存为 v0.1 草稿" />
    </> : null}
  </div>;
}
