'use client';
import { Plus, X } from 'lucide-react';
import { protocolSourceKinds, type ProtocolSource } from '@/lib/protocol-document';
import { newProtocolSource, sourceKindLabels } from '@/lib/protocol-sources';
import './protocol-knowledge.css';

/**
 * 来源与依据: where this version's content came from. Edited beside the metadata and saved with the document
 * (`contentJson.sources`), so a reviewed version keeps its sources and a revision inherits them.
 */
export function ProtocolSourcesEditor({ sources, onChange, fromExperiments = [] }: { sources: ProtocolSource[]; onChange: (sources: ProtocolSource[]) => void; fromExperiments?: string[] }) {
  const update = (id: string, patch: Partial<ProtocolSource>) => onChange(sources.map(source => source.id === id ? { ...source, ...patch } : source));
  const text = (value: string) => value.trim() ? value : undefined;
  return <fieldset className="protocol-metadata-group"><legend>来源与依据</legend>
    <div className="ln-sources-editor">
      {sources.map(source => <div key={source.id} className="ln-source-row">
        <select value={source.kind} aria-label="来源类型" onChange={event => update(source.id, { kind: event.target.value as ProtocolSource['kind'] })}>{protocolSourceKinds.map(kind => <option key={kind} value={kind}>{sourceKindLabels[kind]}</option>)}</select>
        <div className="ln-source-fields">
          <input value={source.title} placeholder="标题，或作者（年份）" aria-label="来源标题" onChange={event => update(source.id, { title: event.target.value })} />
          <input value={source.citation ?? ''} placeholder="引文、DOI 或期刊卷期" aria-label="引文" onChange={event => update(source.id, { citation: text(event.target.value) })} />
          <div className="ln-source-pair">
            <input value={source.url ?? ''} placeholder="链接" aria-label="链接" inputMode="url" onChange={event => update(source.id, { url: text(event.target.value) })} />
            <input value={source.license ?? ''} placeholder="许可，如 CC BY 4.0" aria-label="许可" onChange={event => update(source.id, { license: text(event.target.value) })} />
          </div>
          <div className="ln-source-pair">
            <input type="date" value={source.accessedAt?.slice(0, 10) ?? ''} aria-label="获取日期" onChange={event => update(source.id, { accessedAt: text(event.target.value) })} />
            <input value={source.note ?? ''} placeholder="备注，如采用了哪一部分" aria-label="备注" onChange={event => update(source.id, { note: text(event.target.value) })} />
          </div>
        </div>
        <button type="button" className="focus-ring ln-source-remove" aria-label={`移除来源 ${source.title || sourceKindLabels[source.kind]}`} onClick={() => onChange(sources.filter(item => item.id !== source.id))}><X aria-hidden className="h-4 w-4" /></button>
      </div>)}
      <button type="button" className="focus-ring ln-source-add" onClick={() => onChange([...sources, newProtocolSource()])}><Plus aria-hidden className="h-3.5 w-3.5" />来源</button>
      {fromExperiments.length ? <p className="text-xs text-muted">整理自实验：{fromExperiments.join('、')}</p> : null}
    </div>
  </fieldset>;
}
