'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { newClientMutationId } from '@/lib/client-mutation-id';
import { consumptionAmount, consumptionSource, matchStock, type ConsumptionLine } from '@/lib/run-consumption';
import { Button } from './ui/Button';
import './protocol/protocol.css';

export type ConsumptionStock = { id: string; name: string; managementMode: string; lotNumber: string | null };
export type ConsumptionChoice = { line: ConsumptionLine; actual: number; stockId: string };

/** Write the chosen usage rows, then deduct those tied to stock. Runs only after the run was completed. */
export async function recordRunConsumption(experimentId: string, choices: ConsumptionChoice[]) {
  const post = async (body: unknown) => {
    const response = await fetch(`/api/experiments/${experimentId}/materials`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok || result?.error) throw new Error(result?.error ?? '保存失败');
    return result;
  };
  const ids: string[] = [];
  for (const choice of choices) {
    const id = newClientMutationId();
    await post({ action: 'save', id, name: choice.line.name, expected: choice.line.expected === undefined ? null : Number(choice.line.expected.toPrecision(6)), actual: choice.actual, unit: choice.line.unit, source: `${consumptionSource(choice.line)}|${choice.line.sources.join('；')}`, inventoryItemId: choice.stockId || null });
    if (choice.stockId) ids.push(id);
  }
  if (!ids.length) return;
  const outcomes = await post({ action: 'confirm', ids }) as Array<{ status: string; error?: string }>;
  const failed = outcomes.filter(outcome => outcome.error);
  if (failed.length) throw new Error(`部分扣减未完成：${failed.map(outcome => outcome.error).join('；')}。使用记录已保留，可在“本次使用的试剂与耗材”中重试。`);
}

/**
 * At completion: "按本次用量扣减库存？" Each line can be changed to the actual amount or left out; only checked lines with a stock item
 * are deducted. Nothing is written here: the run is completed first and the choices are recorded only once that succeeds.
 */
export function CompletionConsumptionDialog({ lines, stock, onCancel, onSkip, onDeduct }: { lines: ConsumptionLine[]; stock: ConsumptionStock[]; onCancel: () => void; onSkip: () => void; onDeduct: (choices: ConsumptionChoice[]) => void }) {
  const [draft, setDraft] = useState(() => lines.map(line => ({ line, include: line.expected !== undefined, actual: line.expected === undefined ? '' : String(Number(line.expected.toPrecision(6))), stockId: matchStock(line.name, stock)?.id ?? '' })));
  const patch = (index: number, change: Partial<typeof draft[number]>) => setDraft(current => current.map((row, i) => i === index ? { ...row, ...change } : row));
  const chosen = draft.filter(item => item.include);
  const invalid = chosen.some(item => !(Number(item.actual) >= 0) || !item.actual.trim());
  const deduct = () => onDeduct(chosen.map(item => ({ line: item.line, actual: Number(item.actual), stockId: item.stockId })));
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const element = dialog.current; if (element && !element.open) element.showModal(); return () => element?.close(); }, []);
  // A native modal: Escape cancels, focus stays inside, the page behind is inert.
  return createPortal(<dialog ref={dialog} aria-labelledby="consumption-title" className="ln-material-dialog ln-consumption-dialog bg-surface text-ink" onCancel={event => { event.preventDefault(); onCancel(); }}>
      <h2 id="consumption-title" className="text-lg font-semibold text-ink">按本次用量扣减库存？</h2>
      <p className="mt-1 text-sm text-muted">实际用量可逐项修改；只有勾选且选了库存的项目会扣减。实验完成后才写入；不扣减也可以直接完成，之后仍能在“本次使用的试剂与耗材”中登记。</p>
      <table className="ln-consumption-table mt-3 w-full text-sm">
        <thead><tr><th scope="col"><span className="sr-only">扣减</span></th><th scope="col">材料</th><th scope="col">预计</th><th scope="col">实际</th><th scope="col">库存</th></tr></thead>
        <tbody>{draft.map((item, index) => <tr key={item.line.key}>
          <td><input type="checkbox" aria-label={`扣减 ${item.line.name}`} checked={item.include} onChange={event => patch(index, { include: event.target.checked })} /></td>
          <th scope="row">{item.line.name}<small>{item.line.sources.join('；')}</small></th>
          <td className="font-mono">{consumptionAmount(item.line)}</td>
          <td><span className="ln-consumption-actual"><input inputMode="decimal" aria-label={`${item.line.name} 实际用量`} disabled={!item.include} value={item.actual} onChange={event => patch(index, { actual: event.target.value })} />{item.line.unit}</span></td>
          <td><select aria-label={`${item.line.name} 库存`} disabled={!item.include} value={item.stockId} onChange={event => patch(index, { stockId: event.target.value })}><option value="">只记录，不扣库存</option>{stock.map(entry => <option key={entry.id} value={entry.id}>{entry.name} · {entry.lotNumber ?? '批号未记录'}{entry.managementMode !== 'precise' ? '（非精确管理）' : ''}</option>)}</select></td>
        </tr>)}</tbody>
      </table>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button type="button" onClick={onCancel}>返回</Button>
        <Button type="button" onClick={onSkip}>不扣减，直接完成</Button>
        <Button type="button" variant="primary" disabled={!chosen.length || invalid} onClick={deduct}>{`完成并记录用量（${chosen.length} 项）`}</Button>
      </div>
  </dialog>, document.body);
}
