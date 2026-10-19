'use client';

import { adoptableCalculation, protocolCalculations, type calculationGroups } from '@/lib/protocol-calculations';
import { chipAmount } from '@/lib/protocol-chips';
import { protocolLabelText } from '@/lib/protocol-label-text';
import { calculationReceiptMatches, protocolCalculationFingerprint, previewProtocolCalculation, type ProtocolCalculation, type ProtocolSystemResolution } from '@/lib/structured-protocol';
import { Button } from './ui/Button';

type Group = ReturnType<typeof calculationGroups>[number];

/** One calculation in the preparation form: its inputs, each result, and one confirmation. The server recomputes every adopted result. */
export function ProtocolCalculationPreview({ group, resolution, receipts, disabled }: { group: Group; resolution: ProtocolSystemResolution; receipts: Record<string, ProtocolCalculation>; disabled: boolean }) {
  const spec = protocolCalculations[group.source.calculatorId];
  const rows = group.results.map(parameter => {
    const receipt = receipts[parameter.id];
    try {
      const current = Boolean(receipt?.confirmedAt && adoptableCalculation(receipt.snapshot) && Number.isFinite(receipt.value) && calculationReceiptMatches(receipt.fingerprint, protocolCalculationFingerprint(parameter, resolution.parameters)));
      // A method upgrade must not replace an adopted historical result or its warnings.
      return { parameter, receipt, current, preview: current ? receipt : previewProtocolCalculation(parameter, resolution.parameters) };
    } catch (cause) { return { parameter, receipt, current: false, error: cause instanceof Error ? cause.message : '计算失败' }; }
  });
  const shown = rows.find(row => row.preview)?.preview;
  const errors = [...new Set(rows.flatMap(row => row.error ? [row.error] : []))];
  const pending = rows.filter(row => row.preview && !row.current);
  const confirmed = rows.every(row => row.current) ? rows[0]?.receipt : undefined;
  return <section className="protocol-system-item" aria-label={`${spec.label} calculation`}>
    <h4 className="font-semibold">{spec.label}</h4>
    <dl className="protocol-system-fields">{spec.inputs.map(input => { const value = resolution.parameters[group.source.inputs[input.key] ?? '']; return <div key={input.key}><dt>{protocolLabelText(input.label)}</dt><dd>{value?.status === 'resolved' ? chipAmount(value.value!, value.unit) : input.optional ? '—' : '待填写'}</dd></div>; })}</dl>
    {shown ? <ul>{rows.map(row => <li key={row.parameter.id}>{protocolLabelText(row.parameter.label)}：{row.preview ? `${row.current ? '本次已采用' : '计算预览，尚未采用'} ${chipAmount(row.preview.value, row.preview.unit, true)}` : '—'}
      {row.receipt && !row.current ? <span className="text-warning"> · 需重新计算；此前采用的 {chipAmount(row.receipt.value, row.receipt.unit, true)} 保留在记录中，不用于当前操作</span> : null}</li>)}</ul> : null}
    {errors.length ? <p role="status" className="text-error">{errors.join('；')}</p> : null}
    {shown?.snapshot.warnings.length ? <ul className="text-warning">{shown.snapshot.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul> : null}
    {shown?.snapshot.notes.length ? <ul>{shown.snapshot.notes.map(note => <li key={note}>{note}</li>)}</ul> : null}
    {shown ? <small>方法 {shown.snapshot.methodVersion}{confirmed ? <> · 确认于 <time dateTime={confirmed.confirmedAt} suppressHydrationWarning>{new Date(confirmed.confirmedAt).toLocaleString()}</time></> : null}</small> : null}
    <Button type="submit" name="confirmCalculations" value={pending.map(row => row.parameter.id).join(' ')} size="sm" disabled={disabled || !pending.length}>计算并确认采用</Button>
  </section>;
}
