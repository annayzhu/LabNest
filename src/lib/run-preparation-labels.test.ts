import { describe, expect, it } from 'vitest';
import { createEmptyProtocolDocument } from './protocol-document';
import { structuredRunView } from './structured-run';
import { translateUiText } from './i18n';
import { preparationChecklist } from './run-preparation';

/** A Protocol whose steps each add one material per reaction: [text, material, µL per reaction]. */
function protocol(steps: Array<[string, string, number]>) {
  const document = createEmptyProtocolDocument();
  document.executionConfirmed = true;
  document.systems = { schemaVersion: 1, dimensions: [], presets: [], rules: [], restrictions: [],
    parameters: steps.map(([, material, value], index) => ({ id: `p${index + 1}`, label: '', unit: 'µL', materialRef: { name: material }, source: { kind: 'fixed' as const, value, unit: 'µL' } })) };
  document.sections.find(section => section.key === 'steps')!.blocks = steps.map(([text], index) => (
    { id: `b${index + 1}`, type: 'rich_text' as const, nodes: [{ type: 'paragraph' as const, content: [{ text: `${text} {{p${index + 1}}}。` }] }], execution: { role: 'step' as const, stepId: `s${index + 1}`, format: 'block' as const } }));
  return document;
}

/** RNA extraction (4 wells) then qPCR (24 reactions) in one run: both have a 第 1 步, both use water. */
function rnaThenQpcr(codes = true) {
  const rna = { protocolVersionId: 'v-rna', ...(codes ? { humanCode: 'PRT-100001' } : {}), protocolTitle: '细胞总 RNA 提取', displayVersion: '1.0', contentJson: protocol([['加入异丙醇', '异丙醇', 500], ['加入无酶水溶解', '无酶水', 30]]) };
  const qpcr = { protocolVersionId: 'v-qpcr', ...(codes ? { humanCode: 'PRT-100003' } : {}), protocolTitle: 'SYBR Green qPCR', displayVersion: '1.0', contentJson: protocol([['配制反应液，加入无酶水', '无酶水', 8]]) };
  const steps = [['rna-1', 'v-rna:s1'], ['rna-2', 'v-rna:s2'], ['qpcr-1', 'v-qpcr:s1']].map(([id, ref]) => ({ id, protocolStepRef: ref, groupKey: ref.split(':')[0], completed: false }));
  const adopted = { selections: {}, actualInputs: {}, confirmedAt: '2026-10-17T01:00:00Z' };
  const plan = { schemaVersion: 1, revision: 1, versions: { 'v-rna': adopted, 'v-qpcr': adopted }, actualValues: {}, skips: {}, quantities: { 'v-rna': { 反应数: 4 }, 'v-qpcr': { 反应数: 24 } } };
  return { snapshot: { versions: [rna, qpcr] }, plan, steps };
}

/** What the Chinese interface shows for a checklist string. */
const zh = (text?: string) => text === undefined ? undefined : translateUiText(text, 'zh');

describe('实验准备清单 with several Protocols', () => {
  it('names each step\'s Protocol and writes 1000 µL and more in mL', () => {
    const { snapshot, plan, steps } = rnaThenQpcr();
    const list = preparationChecklist(structuredRunView(snapshot, plan, steps));
    expect(list.warnings).toEqual([]);
    // 4 × 500 µL isopropanol = 2000 µL = 2 mL; water 4 × 30 µL + 24 × 8 µL = 312 µL from two Protocols' steps.
    expect(list.items.filter(item => item.kind === 'material').map(item => [item.label, item.detail])).toEqual([
      ['异丙醇', '2 mL · used in PRT-100001 step 1'], ['无酶水', '312 µL · used in PRT-100001 step 2; PRT-100003 step 1']]);
    expect(list.items.filter(item => item.kind === 'material').map(item => zh(item.detail))).toEqual(['2 mL · PRT-100001 第 1 步', '312 µL · PRT-100001 第 2 步；PRT-100003 第 1 步']);
  });

  it('names a Protocol by its title when the snapshot has no code, and keeps a bare 第 1 步 for a single Protocol', () => {
    const untitled = rnaThenQpcr(false);
    const water = preparationChecklist(structuredRunView(untitled.snapshot, untitled.plan, untitled.steps)).items.find(item => item.label === '无酶水')?.detail;
    expect(water).toBe('312 µL · used in 细胞总 RNA 提取 step 2; SYBR Green qPCR step 1');
    expect(zh(water)).toBe('312 µL · 细胞总 RNA 提取 第 2 步；SYBR Green qPCR 第 1 步');
    const { snapshot, plan, steps } = rnaThenQpcr();
    const single = preparationChecklist(structuredRunView({ versions: [snapshot.versions[1]] }, plan, steps.filter(step => step.groupKey === 'v-qpcr')));
    expect(single.items.map(item => item.detail)).toEqual(['192 µL · used in Step 1']);
    expect(single.items.map(item => zh(item.detail))).toEqual(['192 µL · 第 1 步']);
  });

  it('writes stock that falls short in the same way', () => {
    const { snapshot, plan, steps } = rnaThenQpcr();
    const list = preparationChecklist(structuredRunView(snapshot, plan, steps), { stock: [{ name: '异丙醇', unit: 'µL', currentQuantity: 1500, quantityRecorded: true }] });
    expect(list.warnings).toEqual(['Stock short: 异丙醇 (in stock 1.5 mL, this run needs about 2 mL)']);
    expect(list.warnings.map(zh)).toEqual(['库存不足：异丙醇（库存 1.5 mL，本次约需 2 mL）']);
  });
});
