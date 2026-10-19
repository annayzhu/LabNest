'use client';
import { useRef, useState, type ReactNode } from 'react';
import { ClipboardList } from 'lucide-react';
import { readBackTemplate, recordLinesOf, templateFromRecordLines, type RecordLines } from '@/lib/result-record-line';
import { normalizeResultTemplate, resultTemplateFieldsToRows } from '@/lib/result-templates';
import type { ResultTemplate } from '@/lib/types';
import { useI18n } from '@/components/I18nProvider';
import './protocol.css';

/** A result template as a reader sees it: its name, the lines as written, and what they record. */
export function RecordTemplateSummary({ template, details }: { template: ResultTemplate; details?: ReactNode }) {
  const { t } = useI18n();
  const lines = recordLinesOf(template);
  return <figure className="ln-record-card">
    <figcaption><ClipboardList aria-hidden /><strong>{template.title ?? template.result_type}</strong></figcaption>
    {lines.record ? <p className="ln-record-line">{lines.record}</p> : null}
    {lines.perSample ? <p className="ln-record-line">{lines.perSample}</p> : null}
    <ReadBack template={template} />
    {details ? <details className="ln-record-details"><summary>{t('Field details')}</summary>{details}</details> : null}
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
  // A node view inside the editor: the interface translation skips it, so its words go through t(). The placeholders keep
  // the Chinese 记录： / 每个样本： a pasted Protocol is read by.
  const { t } = useI18n();
  return <div className="ln-record-editor">
    <label className="ln-record-name"><ClipboardList aria-hidden /><span className="sr-only">{t('Result name')}</span>
      <input value={shown('title', template.title)} placeholder={t('Result name, e.g. RNA QC')} onBlur={blur} onChange={event => { setTyping({ field: 'title', text: event.target.value }); rename(event.target.value); }} />
    </label>
    <label className="ln-record-input"><span className="sr-only">{t('Items to record')}</span>
      <textarea rows={1} value={shown('record', lines.record)} placeholder={t('记录：concentration ng/µL, A260/280, gel image')} onFocus={focus} onBlur={blur} onChange={event => { setTyping({ field: 'record', text: event.target.value }); update({ ...lines, record: event.target.value }); }} />
    </label>
    <label className="ln-record-input"><span className="sr-only">{t('per sample')}</span>
      <textarea rows={1} value={shown('perSample', lines.perSample)} placeholder={t('每个样本：sample name, Ct value (only when there is one row per sample)')} onFocus={focus} onBlur={blur} onChange={event => { setTyping({ field: 'perSample', text: event.target.value }); update({ ...lines, perSample: event.target.value }); }} />
    </label>
    <ReadBack template={template} />
    <p className="ln-record-hint">{t('An item with a unit is a number; one ending in 图, 照片, image or photo is an image; one ending in 文件, 原始数据, file or raw data is a file; one starting with “是否” or ending in ? is yes/no; write options in brackets, e.g. (positive/negative); a * after the name makes it required.')}</p>
    <details className="ln-record-details"><summary>{t('Advanced')}</summary>{advanced}</details>
  </div>;
}

/** What LabNest understood from the lines, said back in one line each. */
function ReadBack({ template }: { template: ResultTemplate }) {
  // Also shown inside the editor, where only t() translates.
  const { t } = useI18n();
  const said = readBackTemplate(template);
  if (!said.items.length && !said.perSample.length) return <p className="ln-record-readback is-empty">{t('Nothing to record yet.')}</p>;
  return <div className="ln-record-readback">
    {said.items.length ? <p><span>{t('Will record')}</span>{t(said.items.join(' ｜ '))}</p> : null}
    {said.perSample.length ? <p><span>{t('One row per sample')}</span>{t(said.perSample.join(' ｜ '))}</p> : null}
  </div>;
}
