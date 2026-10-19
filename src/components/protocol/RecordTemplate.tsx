'use client';
import { useRef, useState, type ReactNode } from 'react';
import { ClipboardList } from 'lucide-react';
import { readBackTemplate, recordLinesOf, templateFromRecordLines, type RecordLines } from '@/lib/result-record-line';
import { normalizeResultTemplate, resultTemplateFieldsToRows } from '@/lib/result-templates';
import type { ResultTemplate } from '@/lib/types';
import './protocol.css';

/** A result template as a reader sees it: its name, the lines as written, and what they record. */
export function RecordTemplateSummary({ template, details }: { template: ResultTemplate; details?: ReactNode }) {
  const lines = recordLinesOf(template);
  return <figure className="ln-record-card">
    <figcaption><ClipboardList aria-hidden /><strong>{template.title ?? template.result_type}</strong></figcaption>
    {lines.record ? <p className="ln-record-line">{lines.record}</p> : null}
    {lines.perSample ? <p className="ln-record-line">{lines.perSample}</p> : null}
    <ReadBack template={template} />
    {details ? <details className="ln-record-details"><summary>字段详情</summary>{details}</details> : null}
  </figure>;
}

/**
 * The result template in the Protocol editor: a name, a "记录：…" line and an optional "每个样本：…" line, with what LabNest
 * understood right under them. Keys are worked out against the template as it stood when the line was focused, so the
 * half-typed words of one edit never take keys of their own. 高级设置 keeps the field-by-field editor.
 */
export function RecordTemplateEditor<B extends { caption?: string; rows: string[][]; resultTemplate?: unknown }>({ block, onChange, advanced }: { block: B; onChange: (block: B) => void; advanced: ReactNode }) {
  const template = normalizeResultTemplate(block.resultTemplate);
  const lines = recordLinesOf(template);
  const base = useRef(template);
  // The stored template is trimmed, so the field being typed in shows its raw text until it loses focus: a space typed
  // at the end, or a cleared name, would otherwise vanish before the next character arrives.
  const [typing, setTyping] = useState<{ field: 'title' | 'record' | 'perSample'; text: string }>();
  const shown = (field: 'title' | 'record' | 'perSample', stored?: string) => typing?.field === field ? typing.text : stored ?? '';
  // Renaming the result never re-reads the lines: an old field-by-field template keeps its types until its line is edited.
  const rename = (title: string) => onChange({ ...block, caption: title, resultTemplate: normalizeResultTemplate({ ...template, title }) } as B);
  const update = (next: RecordLines) => {
    const changed = templateFromRecordLines(next, base.current, template.title);
    onChange({ ...block, caption: changed.title, rows: resultTemplateFieldsToRows(changed), resultTemplate: changed } as B);
  };
  const focus = () => { base.current = template; };
  const blur = () => setTyping(undefined);
  return <div className="ln-record-editor">
    <label className="ln-record-name"><ClipboardList aria-hidden /><span className="sr-only">结果名称</span>
      <input value={shown('title', template.title)} placeholder="结果名称，如 RNA 质检" onBlur={blur} onChange={event => { setTyping({ field: 'title', text: event.target.value }); rename(event.target.value); }} />
    </label>
    <label className="ln-record-input"><span className="sr-only">记录</span>
      <textarea rows={1} value={shown('record', lines.record)} placeholder="记录：浓度 ng/µL、A260/280、胶图" onFocus={focus} onBlur={blur} onChange={event => { setTyping({ field: 'record', text: event.target.value }); update({ ...lines, record: event.target.value }); }} />
    </label>
    <label className="ln-record-input"><span className="sr-only">每个样本</span>
      <textarea rows={1} value={shown('perSample', lines.perSample)} placeholder="每个样本：样本名、Ct 值（每个样本一行时才写）" onFocus={focus} onBlur={blur} onChange={event => { setTyping({ field: 'perSample', text: event.target.value }); update({ ...lines, perSample: event.target.value }); }} />
    </label>
    <ReadBack template={template} />
    <p className="ln-record-hint">带单位的是数值；图、照片是图片；文件、原始数据是文件；“是否…”是是否；写选项用（阳性/阴性）；名称后加 * 表示必填。</p>
    <details className="ln-record-details"><summary>高级设置</summary>{advanced}</details>
  </div>;
}

/** What LabNest understood from the lines, said back in one line each. */
function ReadBack({ template }: { template: ResultTemplate }) {
  const said = readBackTemplate(template);
  if (!said.items.length && !said.perSample.length) return <p className="ln-record-readback is-empty">还没有要记录的项目。</p>;
  return <div className="ln-record-readback">
    {said.items.length ? <p><span>将记录</span>{said.items.join(' ｜ ')}</p> : null}
    {said.perSample.length ? <p><span>每个样本一行</span>{said.perSample.join(' ｜ ')}</p> : null}
  </div>;
}
