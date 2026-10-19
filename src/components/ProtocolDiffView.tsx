import type { ProtocolDiff } from '@/lib/protocol-diff';
import './protocol-knowledge.css';

const changeLabels = { added: 'Added', removed: 'Removed', changed: 'Changed' } as const;

function DiffTable({ title, entries, before, after }: { title: string; entries: ProtocolDiff['parameters']; before: string; after: string }) {
  if (!entries.length) return null;
  return <section className="space-y-2">
    <h3 className="text-sm font-semibold text-ink">{title}</h3>
    <div className="ln-diff-wrap"><table className="ln-diff-table">
      <thead><tr><th scope="col">Part</th><th scope="col">Change type</th><th scope="col">{before}</th><th scope="col">{after}</th></tr></thead>
      <tbody>{entries.map(entry => <tr key={entry.id} data-change={entry.change}>
        <td className="is-label">{entry.label}</td><td>{changeLabels[entry.change]}</td>
        <td className="is-before">{entry.before ?? ''}</td><td className="is-after">{entry.after ?? ''}</td>
      </tr>)}</tbody>
    </table></div>
  </section>;
}

/** Version comparison (版本对比): what changed between two versions, block by block, parameter by parameter, source by source. */
export function ProtocolDiffView({ diff, before, after }: { diff: ProtocolDiff; before: string; after: string }) {
  const total = diff.counts.added + diff.counts.removed + diff.counts.changed;
  return <div className="space-y-5">
    <p className="ln-diff-counts" role="status">{total ? <><span><strong>{diff.counts.changed}</strong> changed</span><span><strong>{diff.counts.added}</strong> added</span><span><strong>{diff.counts.removed}</strong> removed</span></> : 'The two versions are identical.'}</p>
    {diff.sections.map(section => <DiffTable key={section.key} title={section.title} entries={section.entries} before={before} after={after} />)}
    <DiffTable title="Parameters" entries={diff.parameters} before={before} after={after} />
    <DiffTable title="Sources and evidence" entries={diff.sources} before={before} after={after} />
  </div>;
}
