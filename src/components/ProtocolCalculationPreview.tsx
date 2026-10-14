'use client';

import { previewProtocolCalculation, type ProtocolCalculation, type ProtocolSystems, type ProtocolSystemResolution } from '@/lib/structured-protocol';
import { Button } from './ui/Button';

/** Lives in the preparation form; the server independently recomputes every adopted result. */
export function ProtocolCalculationPreview({ parameter, resolution, receipt, disabled }: {
  parameter: ProtocolSystems['parameters'][number]; resolution: ProtocolSystemResolution;
  receipt?: ProtocolCalculation; disabled: boolean;
}) {
  let preview: ReturnType<typeof previewProtocolCalculation> | undefined;
  let error = '';
  try { preview = previewProtocolCalculation(parameter, resolution.parameters); }
  catch (cause) { error = cause instanceof Error ? cause.message : '计算失败'; }
  const current = Boolean(preview && receipt?.fingerprint === preview.fingerprint);
  return <section className="protocol-system-item" aria-label={`${parameter.label}计算器`}>
    <h4 className="font-semibold">{parameter.label} · 稀释计算器</h4>
    {preview ? <>
      <dl className="protocol-system-fields">{Object.entries(parameter.source.kind === 'calculator' ? parameter.source.inputs : {}).map(([key, id]) => <div key={key}><dt>{{ stockConcentration: '母液浓度', targetConcentration: '目标浓度', finalVolume: '最终体积' }[key]}</dt><dd>{resolution.parameters[id]?.value} {resolution.parameters[id]?.unit}</dd></div>)}</dl>
      <p>{current ? '本次已采用' : '计算预览，尚未采用'}：{preview.value} {preview.unit}</p>
      {preview.snapshot.warnings.length ? <ul className="text-warning">{preview.snapshot.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul> : null}
      <small>方法 {preview.snapshot.methodVersion}{current ? ` · 确认于 ${new Date(receipt!.confirmedAt).toLocaleString()}` : ''}</small>
    </> : <p role="status" className="text-error">{error}</p>}
    {receipt && !current ? <p className="text-warning">需重新计算。此前采用 {receipt.value} {receipt.unit} 的记录保留，不能用于当前待执行操作。</p> : null}
    <Button type="submit" name="confirmCalculations" value={parameter.id} size="sm" disabled={disabled || !preview || current}>计算并确认采用</Button>
  </section>;
}
