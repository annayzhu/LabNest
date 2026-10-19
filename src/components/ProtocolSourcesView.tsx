import type { ProtocolSource } from '@/lib/protocol-document';
import { formatProtocolSource, sourceHref, sourceKindLabels } from '@/lib/protocol-sources';
import './protocol-knowledge.css';

/** The version's sources as a reader sees them: numbered, with the kind, the citation and a link to follow. */
export function ProtocolSourcesView({ sources }: { sources: ProtocolSource[] }) {
  if (!sources.length) return null;
  return <section id="section-sources" className="document-section">
    <header className="mb-5"><h2 className="document-section-title font-serif font-medium text-ink">来源与依据</h2></header>
    <ol className="ln-sources-list">{sources.map(source => { const href = sourceHref(source); return <li key={source.id}><span className="ln-source-kind">{sourceKindLabels[source.kind]}</span>{formatProtocolSource(source)}{href ? <> · <a href={href} target="_blank" rel="noreferrer">打开</a></> : null}</li>; })}</ol>
  </section>;
}
