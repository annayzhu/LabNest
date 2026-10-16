import { describe, expect, it } from 'vitest';
import { createEmptyProtocolDocument } from './protocol-document';
import { structuredRunView } from './structured-run';
import { formatDuration, preparationChecklist, preparationProgress } from './run-preparation';

/** A qPCR Protocol: a mix card (SYBR premixed, cDNA added separately), a pre-cooled centrifuge, a 10 min incubation and a value to record. */
function qpcr() {
  const document = createEmptyProtocolDocument();
  document.executionConfirmed = true;
  document.systems = { schemaVersion: 1, dimensions: [], presets: [], rules: [], restrictions: [],
    tools: [{ id: 'tool-1', kind: 'centrifuge', fields: [{ key: 'speed', parameterId: 'p-speed' }, { key: 'temperature', parameterId: 'p-temp' }] }],
    parameters: [
      { id: 'p-vol', label: '', unit: 'µL', origin: 'chip', materialRef: { name: '2× SYBR Mix' }, source: { kind: 'fixed', value: 10, unit: 'µL' } },
      { id: 'p-cdna', label: '', unit: 'µL', materialRef: { name: 'cDNA' }, source: { kind: 'fixed', value: 2, unit: 'µL' } },
      { id: 'p-time', label: '', unit: 'min', source: { kind: 'fixed', value: 10, unit: 'min' } },
      { id: 'p-speed', label: '', unit: '×g', ownerToolId: 'tool-1', source: { kind: 'fixed', value: 12000, unit: '×g' } },
      { id: 'p-temp', label: '', unit: '°C', ownerToolId: 'tool-1', source: { kind: 'fixed', value: 4, unit: '°C' } },
      { id: 'p-od', label: 'OD600', unit: 'AU', actual: 'required', source: { kind: 'actual' } },
    ] };
  document.sections.find(section => section.key === 'steps')!.blocks = [
    { id: 'b1', type: 'rich_text', nodes: [{ type: 'paragraph', content: [{ text: '配制预混液，离心 {{tool-1}}。' }] }], execution: { role: 'step', stepId: 's1', format: 'block' } },
    { id: 'b1-mix', type: 'mix', title: 'qPCR 预混液', per: '反应', overagePercent: 10, minPipetteUl: 0.5, components: [{ id: 'c1', name: '2× SYBR Mix', amount: '{{p-vol}}', mode: 'premix' }, { id: 'c2', name: 'cDNA', amount: '{{p-cdna}}', mode: 'separate' }], execution: { role: 'detail', stepId: 's1' } },
    { id: 'b2', type: 'rich_text', nodes: [{ type: 'paragraph', content: [{ text: '孵育 {{p-time}}，记录 {{p-od}}。' }] }], execution: { role: 'step', stepId: 's2', format: 'block' } },
  ];
  const snapshot = { versions: [{ protocolVersionId: 'v1', protocolTitle: 'qPCR', displayVersion: '0.3', contentJson: document }] };
  const steps = [{ id: 'run-1', protocolStepRef: 'v1:s1', groupKey: 'v1', completed: false }, { id: 'run-2', protocolStepRef: 'v1:s2', groupKey: 'v1', completed: false }];
  const adopted = { selections: {}, actualInputs: {}, confirmedAt: '2026-10-15T01:00:00Z' };
  return { snapshot, steps, adopted };
}

describe('实验准备清单', () => {
  it('lists materials, the mix card, the pre-cooled centrifuge and the timer from the confirmed plan and 本次数量', () => {
    const { snapshot, steps, adopted } = qpcr();
    const view = structuredRunView(snapshot, { schemaVersion: 1, revision: 1, versions: { v1: adopted }, actualValues: {}, skips: {}, quantities: { v1: { 反应数: 24 } } }, steps);
    const list = preparationChecklist(view, { recorded: [{ source: 'Chip:cdna#volume|第 1 步' }] });
    expect(list.warnings).toEqual([]);
    const byKind = (kind: string) => list.items.filter(item => item.kind === kind);
    // 24 reactions × 10 µL × 110% premixed; cDNA 24 × 2 µL added separately, already written as used.
    expect(byKind('material').map(item => [item.label, item.detail, item.badge])).toEqual([
      ['2× SYBR Mix', '264 µL · 第 1 步 · qPCR 预混液', undefined], ['cDNA', '48 µL · 第 1 步 · qPCR 预混液', '已记录']]);
    expect(byKind('mix')[0]).toMatchObject({ key: 'mix:run-1:b1-mix', label: 'qPCR 预混液 · 第 1 步', detail: '24 反应数 · 待确认', stepId: 'run-1' });
    expect(byKind('equipment')[0]).toMatchObject({ key: 'equipment:v1:tool-1', label: '离心', detail: '预冷至 4 °C · 12,000 ×g · 第 1 步' });
    expect(byKind('timer')[0]).toMatchObject({ key: 'timer:run-2', label: '第 2 步', detail: '10 min', stepId: 'run-2' });
    expect(list.reminders).toEqual(['执行时填写：第 2 步 · OD600']);
  });

  it('warns about a missing 本次数量 and short stock instead of guessing amounts', () => {
    const { snapshot, steps, adopted } = qpcr();
    const bare = structuredRunView(snapshot, { schemaVersion: 1, revision: 1, versions: { v1: adopted }, actualValues: {}, skips: {} }, steps);
    const list = preparationChecklist(bare);
    expect(list.warnings).toEqual(['尚未填写反应数：qPCR']);
    expect(list.items.find(item => item.kind === 'material')).toMatchObject({ label: '2× SYBR Mix', warning: '未填写反应数' });
    expect(list.items.find(item => item.kind === 'mix')).toMatchObject({ detail: '未填写反应数 · 待确认', warning: '未填写反应数' });
    const counted = structuredRunView(snapshot, { schemaVersion: 1, revision: 1, versions: { v1: adopted }, actualValues: {}, skips: {}, quantities: { v1: { 反应数: 24 } } }, steps);
    // 264 µL needed, 0.1 mL on the shelf; cDNA is compared in µL and suffices.
    const short = preparationChecklist(counted, { stock: [{ name: '2× SYBR Mix', unit: 'mL', currentQuantity: 0.1, quantityRecorded: true }, { name: 'cDNA', unit: 'µL', currentQuantity: 100, quantityRecorded: true }] });
    expect(short.warnings).toEqual(['库存不足：2× SYBR Mix（库存 0.1 mL，本次约需 264 µL）']);
    expect(short.items[0].warning).toBe('库存 0.1 mL，不足本次用量');
    expect(short.items[1].warning).toBeUndefined();
  });

  it('keeps ticks by key while the list is re-derived, and never counts untracked keys', () => {
    const { snapshot, steps, adopted } = qpcr();
    const view = structuredRunView(snapshot, { schemaVersion: 1, revision: 1, versions: { v1: adopted }, actualValues: {}, skips: {}, quantities: { v1: { 反应数: 24 } } }, steps);
    const { items } = preparationChecklist(view, { plates: [{ id: 'att-1', name: '96 孔板布局.json' }] });
    expect(items.map(item => item.kind)).toEqual(['material', 'material', 'mix', 'plate', 'equipment', 'timer']);
    const progress = preparationProgress(items, { 'timer:run-2': { done: true, doneAt: '2026-10-15T02:00:00Z' }, 'plate:att-1': { done: true }, 'plate:gone': { done: true } });
    expect(progress).toMatchObject({ done: 2, total: 6 });
    expect(progress.pending.map(item => item.key)).toEqual(['material:2× sybr mix#volume', 'material:cdna#volume', 'mix:run-1:b1-mix', 'equipment:v1:tool-1']);
  });

  it('warns before the bench when the Protocol is a search-generated draft with unverified card lines', () => {
    const { snapshot, steps, adopted } = qpcr();
    snapshot.versions[0].contentJson.provenance = { fromExperimentIds: [], design: { sessionId: 'sess-1', hitKey: 'europe_pmc:PMC1', unverified: 2, generatedAt: '2026-10-15T00:00:00Z' } };
    const view = structuredRunView(snapshot, { schemaVersion: 1, revision: 1, versions: { v1: adopted }, actualValues: {}, skips: {}, quantities: { v1: { 反应数: 24 } } }, steps);
    expect(preparationChecklist(view).warnings).toEqual(['qPCR 由方案设计生成，方法卡有 2 条未核实，请先核对原文']);
  });

  it('formats durations the way a bench reads them', () => {
    expect([600, 5400, 45, 3600].map(formatDuration)).toEqual(['10 min', '1 h 30 min', '45 s', '1 h']);
  });
});
