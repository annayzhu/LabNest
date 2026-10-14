'use client';

import { calculationReceiptMatches, protocolCalculationFingerprint, previewProtocolCalculation, type ProtocolCalculation, type ProtocolSystems, type ProtocolSystemResolution } from '@/lib/structured-protocol';
import { Button } from './ui/Button';

/** Lives in the preparation form; the server independently recomputes every adopted result. */
export function ProtocolCalculationPreview({ parameter, resolution, receipt, disabled }: {
  parameter: ProtocolSystems['parameters'][number]; resolution: ProtocolSystemResolution;
  receipt?: ProtocolCalculation; disabled: boolean;
}) {
  let preview: ReturnType<typeof previewProtocolCalculation> | undefined;
  let current = false;
  let error = '';
  try {
    current = Boolean(receipt?.confirmedAt && receipt.snapshot.status === 'valid' && Number.isFinite(receipt.value) && calculationReceiptMatches(receipt.fingerprint, protocolCalculationFingerprint(parameter, resolution.parameters)));
    // A method upgrade must not replace an adopted historical result or its warnings.
    preview = current ? receipt : previewProtocolCalculation(parameter, resolution.parameters);
  }
  catch (cause) { error = cause instanceof Error ? cause.message : '计算失败'; }
  return <section className="protocol-system-item" aria-label={`${parameter.label}计算器`}>
    <h4 className="font-semibold">{parameter.label} · 稀释计算器</h4>
    {preview ? <>
      <dl className="protocol-system-fields">{Object.entries(parameter.source.kind === 'calculator' ? parameter.source.inputs : {}).map(([key, id]) => <div key={key}><dt>{{ stockConcentration: '母液浓度', targetConcentration: '目标浓度', finalVolume: '最终体积' }[key]}</dt><dd>{resolution.parameters[id]?.value} {resolution.parameters[id]?.unit}</dd></div>)}</dl>
      <p>{current ? '本次已采用' : '计算预览，尚未采用'}：{current ? receipt!.value : preview.value} {preview.unit}</p>
      {preview.snapshot.warnings.length ? <ul className="text-warning">{preview.snapshot.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul> : null}
      {preview.snapshot.notes.length ? <ul>{preview.snapshot.notes.map(note => <li key={note}>{note}</li>)}</ul> : null}
      <small>方法 {current ? receipt!.snapshot.methodVersion : preview.snapshot.methodVersion}{current ? <> · 确认于 <time dateTime={receipt!.confirmedAt} suppressHydrationWarning>{new Date(receipt!.confirmedAt).toLocaleString()}</time></> : null}</small>
    </> : <p role="status" className="text-error">{error}</p>}
    {receipt && !current ? <p className="text-warning">需重新计算。此前采用 {receipt.value} {receipt.unit} 的记录保留，不能用于当前待执行操作。</p> : null}
    <Button type="submit" name="confirmCalculations" value={parameter.id} size="sm" disabled={disabled || !preview || current}>计算并确认采用</Button>
  </section>;
}
