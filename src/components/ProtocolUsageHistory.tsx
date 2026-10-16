import Link from 'next/link';
import type { ProtocolUsageRow } from '@/lib/protocol-usage.server';
import { experimentStatusOptions } from '@/lib/status-options';
import './protocol-knowledge.css';

const statusLabels: Record<string, string> = Object.fromEntries(experimentStatusOptions.map(option => [option.value, option.label]));

/** 使用记录: which Experiments ran this Protocol, under which system, with how many recorded values, deviations and results. */
export function ProtocolUsageHistory({ rows }: { rows: ProtocolUsageRow[] }) {
  if (!rows.length) return <p className="text-sm text-muted">还没有实验用过这份规程。</p>;
  return <div className="ln-usage-wrap"><table className="ln-usage-table">
    <thead><tr><th scope="col">实验</th><th scope="col">日期</th><th scope="col">版本</th><th scope="col">体系 · 本次数量</th><th scope="col" className="is-num">步骤</th><th scope="col" className="is-num">实际值</th><th scope="col" className="is-num">偏差</th><th scope="col" className="is-num">结果</th><th scope="col">状态</th></tr></thead>
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
