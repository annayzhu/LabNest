import Link from 'next/link';
import type { ProtocolUsageRow } from '@/lib/protocol-usage.server';
import { experimentStatusOptions } from '@/lib/status-options';
import './protocol-knowledge.css';

const statusLabels: Record<string, string> = Object.fromEntries(experimentStatusOptions.map(option => [option.value, option.label]));

/** Usage history (使用记录): which Experiments ran this Protocol, under which system, with how many recorded values, deviations and results. */
export function ProtocolUsageHistory({ rows }: { rows: ProtocolUsageRow[] }) {
  if (!rows.length) return <p className="text-sm text-muted">No experiment has used this Protocol yet.</p>;
  return <div className="ln-usage-wrap"><table className="ln-usage-table">
    <thead><tr><th scope="col">Experiment</th><th scope="col">Date</th><th scope="col">Version</th><th scope="col">Systems · run quantities</th><th scope="col" className="is-num">Steps</th><th scope="col" className="is-num">Actual values</th><th scope="col" className="is-num">Deviations</th><th scope="col" className="is-num">Results</th><th scope="col">Status</th></tr></thead>
    <tbody>{rows.map(row => <tr key={row.experimentId}>
      <td><Link href={`/experiments/${row.experimentId}`}>{row.runCode}</Link><br /><span className="text-muted">{row.title}</span></td>
      <td>{row.date}</td>
      <td>{row.versions.join('、') || '—'}</td>
      <td>{[...row.systems, ...row.quantities].join('；') || '—'}</td>
      <td className="is-num">{row.stepsDone}/{row.stepsTotal}</td>
      <td className="is-num">{row.actualValues}</td>
      <td className="is-num">{row.deviations}</td>
      <td className="is-num">{row.results}</td>
      <td>{statusLabels[row.status] ?? row.status}</td>
    </tr>)}</tbody>
  </table></div>;
}
