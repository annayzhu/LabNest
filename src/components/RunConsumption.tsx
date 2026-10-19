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
    if (!response.ok || result?.error) throw new Error(result?.error ?? 'Save failed');
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
  if (failed.length) throw new Error(`Some deductions did not go through · ${failed.map(outcome => outcome.error).join('; ')}. The use records are kept; retry under “Reagents and consumables used in this run”.`);
}

/**
 * At completion: "Deduct this run’s use from stock?" Each line can be changed to the actual amount or left out; only checked lines with a stock item
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
      <h2 id="consumption-title" className="text-lg font-semibold text-ink">Deduct this run’s use from stock?</h2>
      <p className="mt-1 text-sm text-muted">Change any actual amount; only ticked lines with a stock item are deducted. Nothing is written until the experiment is completed; you can also complete without deducting and record use later under “Reagents and consumables used in this run”.</p>
      <table className="ln-consumption-table mt-3 w-full text-sm">
        <thead><tr><th scope="col"><span className="sr-only">Deduct</span></th><th scope="col">Material</th><th scope="col">Expected use</th><th scope="col">Actual use</th><th scope="col">Stock</th></tr></thead>
        <tbody>{draft.map((item, index) => <tr key={item.line.key}>
          <td><input type="checkbox" aria-label={`Deduct ${item.line.name}`} checked={item.include} onChange={event => patch(index, { include: event.target.checked })} /></td>
          <th scope="row">{item.line.name}<small>{item.line.sources.join('；')}</small></th>
          <td className="font-mono">{consumptionAmount(item.line)}</td>
          <td><span className="ln-consumption-actual"><input inputMode="decimal" aria-label={`Actual amount of ${item.line.name}`} disabled={!item.include} value={item.actual} onChange={event => patch(index, { actual: event.target.value })} />{item.line.unit}</span></td>
          <td><select aria-label={`Stock item for ${item.line.name}`} disabled={!item.include} value={item.stockId} onChange={event => patch(index, { stockId: event.target.value })}><option value="">Record only, don’t deduct</option>{stock.map(entry => <option key={entry.id} value={entry.id}>{`${entry.name} · ${entry.lotNumber ?? 'Lot not recorded'}${entry.managementMode !== 'precise' ? ' (not precisely tracked)' : ''}`}</option>)}</select></td>
        </tr>)}</tbody>
      </table>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button type="button" onClick={onCancel}>Back</Button>
        <Button type="button" onClick={onSkip}>Complete without deducting</Button>
        <Button type="button" variant="primary" disabled={!chosen.length || invalid} onClick={deduct}>{`Complete and record use (${chosen.length})`}</Button>
      </div>
  </dialog>, document.body);
}
