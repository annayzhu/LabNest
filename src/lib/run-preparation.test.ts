import { describe, expect, it } from 'vitest';
import { createEmptyProtocolDocument } from './protocol-document';
import { structuredRunView } from './structured-run';
import { translateUiText } from './i18n';
import { preparationChecklist, preparationProgress } from './run-preparation';
import { preparationWorkbook } from './run-preparation-workbook';

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

/** What the Chinese interface shows for a checklist string. */
const zh = (text?: string) => text === undefined ? undefined : translateUiText(text, 'zh');

describe('实验准备清单', () => {
  it('lists materials, the mix card and the pre-cooled centrifuge from the confirmed plan and 本次数量; timers and run-time values stay in their steps', () => {
    const { snapshot, steps, adopted } = qpcr();
    const view = structuredRunView(snapshot, { schemaVersion: 1, revision: 1, versions: { v1: adopted }, actualValues: {}, skips: {}, quantities: { v1: { 反应数: 24 } } }, steps);
    const list = preparationChecklist(view, { recorded: [{ source: 'Chip:cdna#volume|第 1 步' }] });
    expect(list.warnings).toEqual([]);
    const byKind = (kind: string) => list.items.filter(item => item.kind === kind);
    // 24 reactions × 10 µL × 110% premixed; cDNA 24 × 2 µL added separately, already written as used.
    expect(byKind('material').map(item => [item.label, item.detail, item.badge])).toEqual([
      ['2× SYBR Mix', '264 µL · used in Step 1 · qPCR 预混液', undefined], ['cDNA', '48 µL · used in Step 1 · qPCR 预混液', 'Recorded']]);
    expect(byKind('material').map(item => [zh(item.detail), zh(item.badge)])).toEqual([['264 µL · 第 1 步 · qPCR 预混液', undefined], ['48 µL · 第 1 步 · qPCR 预混液', '已记录']]);
    expect(byKind('mix')[0]).toMatchObject({ key: 'mix:run-1:b1-mix', label: 'qPCR 预混液 · Step 1', detail: '24 reactions · Not confirmed', stepId: 'run-1' });
    expect([zh(byKind('mix')[0].label), zh(byKind('mix')[0].detail)]).toEqual(['qPCR 预混液 · 第 1 步', '24 反应数 · 待确认']);
    expect(byKind('equipment')[0]).toMatchObject({ key: 'equipment:v1:tool-1', label: 'Centrifuge', detail: 'Pre-cool to 4 °C · 12,000 ×g · Step 1' });
    expect([zh(byKind('equipment')[0].label), zh(byKind('equipment')[0].detail)]).toEqual(['离心', '预冷至 4 °C · 12,000 ×g · 第 1 步']);
    expect(list.items.map(item => item.kind)).toEqual(['material', 'material', 'mix', 'equipment']);
    expect(list.needsInput).toBe(false);
  });

  it('warns about a missing 本次数量 and short stock instead of guessing amounts', () => {
    const { snapshot, steps, adopted } = qpcr();
    const bare = structuredRunView(snapshot, { schemaVersion: 1, revision: 1, versions: { v1: adopted }, actualValues: {}, skips: {} }, steps);
    const list = preparationChecklist(bare);
    expect(list.warnings).toEqual(['Run quantity not filled in: number of reactions · qPCR']);
    expect(list.needsInput).toBe(true);
    expect(list.warnings.map(zh)).toEqual(['尚未填写反应数：qPCR']);
    const material = list.items.find(item => item.kind === 'material')!, mix = list.items.find(item => item.kind === 'mix')!;
    expect(material).toMatchObject({ label: '2× SYBR Mix', warning: 'Not filled in: number of reactions' });
    expect(mix).toMatchObject({ detail: 'Not filled in: number of reactions · Not confirmed', warning: 'Not filled in: number of reactions' });
    expect([zh(material.warning), zh(material.detail), zh(mix.detail)]).toEqual(['未填写反应数', '未填写反应数 · 第 1 步 · qPCR 预混液', '未填写反应数 · 待确认']);
    const counted = structuredRunView(snapshot, { schemaVersion: 1, revision: 1, versions: { v1: adopted }, actualValues: {}, skips: {}, quantities: { v1: { 反应数: 24 } } }, steps);
    // 264 µL needed, 0.1 mL on the shelf; cDNA is compared in µL and suffices.
    const short = preparationChecklist(counted, { stock: [{ name: '2× SYBR Mix', unit: 'mL', currentQuantity: 0.1, quantityRecorded: true }, { name: 'cDNA', unit: 'µL', currentQuantity: 100, quantityRecorded: true }] });
    expect(short.warnings).toEqual(['Stock short: 2× SYBR Mix (in stock 0.1 mL, this run needs about 264 µL)']);
    expect(short.warnings.map(zh)).toEqual(['库存不足：2× SYBR Mix（库存 0.1 mL，本次约需 264 µL）']);
    expect(short.items[0].warning).toBe('Stock 0.1 mL, short of this run’s use');
    expect(zh(short.items[0].warning)).toBe('库存 0.1 mL，不足本次用量');
    expect(short.items[1].warning).toBeUndefined();
  });

  it('keeps ticks by key while the list is re-derived, and never counts untracked keys', () => {
    const { snapshot, steps, adopted } = qpcr();
    const view = structuredRunView(snapshot, { schemaVersion: 1, revision: 1, versions: { v1: adopted }, actualValues: {}, skips: {}, quantities: { v1: { 反应数: 24 } } }, steps);
    const { items } = preparationChecklist(view, { plates: [{ id: 'att-1', name: '96 孔板布局.json' }] });
    expect(items.map(item => item.kind)).toEqual(['material', 'material', 'mix', 'plate', 'equipment']);
    // A tick on an item no longer listed (an earlier run's timer row) is kept but not counted.
    const progress = preparationProgress(items, { 'timer:run-2': { done: true, doneAt: '2026-10-15T02:00:00Z' }, 'mix:run-1:b1-mix': { done: true }, 'plate:att-1': { done: true }, 'plate:gone': { done: true } });
    expect(progress).toMatchObject({ done: 2, total: 5 });
    expect(progress.pending.map(item => item.key)).toEqual(['material:2× sybr mix#volume', 'material:cdna#volume', 'equipment:v1:tool-1']);
  });

  it('warns before the bench when the Protocol is a search-generated draft with unverified card lines', () => {
    const { snapshot, steps, adopted } = qpcr();
    snapshot.versions[0].contentJson.provenance = { fromExperimentIds: [], design: { sessionId: 'sess-1', hitKey: 'europe_pmc:PMC1', unverified: 2, generatedAt: '2026-10-15T00:00:00Z' } };
    const view = structuredRunView(snapshot, { schemaVersion: 1, revision: 1, versions: { v1: adopted }, actualValues: {}, skips: {}, quantities: { v1: { 反应数: 24 } } }, steps);
    expect(preparationChecklist(view).warnings).toEqual(['qPCR was generated by method design; its method card has 2 unverified items. Check the original first']);
    expect(preparationChecklist(view).warnings.map(zh)).toEqual(['qPCR 由方案设计生成，方法卡有 2 条未核实，请先核对原文']);
  });

  it('gives two groups one row for what they share and names the group on what is their own', () => {
    const { snapshot } = qpcr();
    snapshot.versions[0].contentJson.provenance = { fromExperimentIds: [], recognition: { sourceAttachmentId: 'att-src', unverified: 2, recognizedAt: '2026-10-15T00:00:00Z' } };
    const groups = [{ id: 'ga', label: 'PAX2' }, { id: 'gb', label: 'pMD.G' }];
    const steps = groups.flatMap(group => [{ id: `${group.id}-1`, protocolStepRef: 'v1:s1', groupKey: 'v1', completed: false }, { id: `${group.id}-2`, protocolStepRef: 'v1:s2', groupKey: 'v1', completed: false }]);
    const adopted = { selections: {}, actualInputs: {}, confirmedAt: '2026-10-15T01:00:00Z' };
    const view = structuredRunView(snapshot, { schemaVersion: 1, revision: 1, groups, stepGroups: Object.fromEntries(steps.map(step => [step.id, step.id.split('-')[0]])), versions: { 'v1@ga': adopted, 'v1@gb': adopted }, actualValues: {}, skips: {}, quantities: { 'v1@ga': { 反应数: 1 }, 'v1@gb': { 反应数: 2 } } }, steps);
    const list = preparationChecklist(view);
    // The AI-provenance warning is about the Protocol, so it is said once.
    expect(list.warnings).toEqual(['qPCR was generated by AI from instructions; 2 lines have no source in the original. Check the original first']);
    expect(list.items.filter(item => item.kind === 'equipment')).toEqual([{ key: 'equipment:v1:tool-1', kind: 'equipment', label: 'Centrifuge', detail: 'Pre-cool to 4 °C · 12,000 ×g · PAX2 · pMD.G · Step 1' }]);
    expect(zh(list.items.find(item => item.kind === 'equipment')?.detail)).toBe('预冷至 4 °C · 12,000 ×g · PAX2 · pMD.G · 第 1 步');
    expect(list.items.filter(item => item.kind === 'mix').map(item => zh(item.label))).toEqual(['PAX2 · qPCR 预混液 · 第 1 步', 'pMD.G · qPCR 预混液 · 第 1 步']);
    expect(list.items.filter(item => item.kind === 'mix').map(item => [item.label, item.detail])).toEqual([['PAX2 · qPCR 预混液 · Step 1', '1 reaction · Not confirmed'], ['pMD.G · qPCR 预混液 · Step 1', '2 reactions · Not confirmed']]);
    // Materials add up over both groups: (1 + 2) × 10 µL × 110%.
    expect(list.items.find(item => item.kind === 'material')?.detail).toMatch(/^33 µL/);
  });
});

describe('操作工作簿', () => {
  it('writes the checklist with what is ticked, every mix card line with its totals, and what still needs care', () => {
    const { snapshot, steps, adopted } = qpcr();
    const view = structuredRunView(snapshot, { schemaVersion: 1, revision: 1, versions: { v1: adopted }, actualValues: {}, skips: {}, quantities: { v1: { 反应数: 24 } } }, steps);
    const list = preparationChecklist(view);
    const tick = list.items.find(item => item.kind === 'material')!;
    const sheets = preparationWorkbook(view, list, { [tick.key]: { done: true, note: '冰上放置' } });
    expect(sheets.map(sheet => sheet.name)).toEqual(['准备清单', '配液卡', '注意事项']);
    const [checklist, mixes, notes] = sheets;
    expect(checklist.rows[0]).toEqual(['类别', '项目', '说明', '提醒', '已备', '备注']);
    expect(checklist.rows.find(row => row[1] === tick.label)).toEqual(['材料与用量', tick.label, tick.detail, '', '是', '冰上放置']);
    // 24 reactions: SYBR premixed with the card's 10% overage, cDNA added separately without it.
    expect(mixes.rows).toContainEqual(['组分', '加法', '每反应', '总量']);
    expect(mixes.rows).toContainEqual(['2× SYBR Mix', '预混', '10 µL', '264 µL']);
    expect(mixes.rows).toContainEqual(['cDNA', '单独加', '2 µL', '48 µL']);
    expect(notes.rows[0]).toEqual(['类型', '内容']);
    expect(notes.rows.slice(1).every(row => row[0] === '开始前要处理')).toBe(true);
  });
});
