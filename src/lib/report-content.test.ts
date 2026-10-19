import { describe, expect, it } from 'vitest';
import { experimentReportBlocks, resultReportBlocks } from './report-content';
import { createScientificDocument, experimentSections, type ScientificContentBlock } from './scientific-document';

function record() {
  const document = createScientificDocument(experimentSections);
  const section = (key: string) => document.sections.find(item => item.key === key)!;
  section('execution').blocks.push(
    { id: 'g1', type: 'heading', text: '1. 组织 DNA 提取', execution: { role: 'group', title: '组织 DNA 提取', index: 1 } },
    { id: 'd1', type: 'text', text: '本次体系 · 裂解液：▲ 350 µL', execution: { role: 'detail', title: '' } },
    { id: 's1', type: 'text', text: '1. ✓ 加入 350 µL 裂解液。实际 360 µL', execution: { role: 'step', title: '', completed: true, number: 1 } },
    { id: 's2', type: 'text', text: '2. 再洗一次。', execution: { role: 'detail', title: '', fold: '其他体系的步骤 · 不适用 · 1 步' } },
    { id: 'm1', type: 'media', mediaType: 'image', url: '/api/attachments/a1' } as ScientificContentBlock,
  );
  section('deviations').blocks.push({ id: 'v1', type: 'text', text: '第 1 步 · 材料或试剂 · 实际加入 360 µL · Anna' });
  return document;
}

describe('A report merges what each run recorded', () => {
  it('writes the run under its title and Protocol: this run’s steps and values, then its deviations', () => {
    const blocks = experimentReportBlocks({ key: 'exp-a', title: '组织 DNA 提取', runCode: 'EXP-014', methods: ['PRT-100001 · 组织 DNA 提取 v0.1'], record: record() });
    expect(blocks.map(block => [block.type, 'text' in block ? block.text : ''])).toEqual([
      ['heading', 'EXP-014 · 组织 DNA 提取'],
      ['text', '规程：PRT-100001 · 组织 DNA 提取 v0.1'],
      ['heading', '1. 组织 DNA 提取'],
      ['text', '本次体系 · 裂解液：▲ 350 µL'],
      ['text', '1. ✓ 加入 350 µL 裂解液。实际 360 µL'],
      ['text', '偏差与事件'],
      ['text', '第 1 步 · 材料或试剂 · 实际加入 360 µL · Anna'],
    ]);
    // Another system's folded steps and the run's photos stay in the Experiment record; ids stay unique in the report.
    expect(blocks.every(block => !block.execution && block.id.startsWith('exp-a-'))).toBe(true);
  });

  it('says so when a run has no record yet', () => {
    const blocks = experimentReportBlocks({ key: 'exp-b', title: '未开始的实验', methods: [], record: createScientificDocument(experimentSections) });
    expect(blocks.map(block => 'text' in block ? block.text : '')).toEqual(['未开始的实验', '还没有执行记录。']);
  });
});

describe('A report merges what each result measured', () => {
  it('lists template values with their units, the quality status and the summary', () => {
    const blocks = resultReportBlocks({
      key: 'res-a', title: 'RNA 浓度测定', qualityStatus: 'pass',
      template: { key: 'rna', label: 'RNA', fields: [{ key: 'conc', label: 'RNA 浓度', unit: 'ng/µL', dataType: 'number' }, { key: 'ratio', label: 'A260/280', dataType: 'number' }, { key: 'ok', label: '电泳条带清晰', dataType: 'boolean' }] },
      values: { conc: 152.3, ratio: 2.01, ok: true },
      summaryBlocks: [{ id: 'x', type: 'text', text: '三个样本浓度接近。' }],
    });
    expect(blocks[0]).toMatchObject({ type: 'heading', text: 'RNA 浓度测定' });
    expect(blocks[1]).toMatchObject({ type: 'table', rows: [['项目', '数值', '单位'], ['RNA 浓度', '152.3', 'ng/µL'], ['A260/280', '2.01', ''], ['电泳条带清晰', '是', '']] });
    expect(blocks.slice(2).map(block => 'text' in block ? block.text : '')).toEqual(['质量：合格', '三个样本浓度接近。']);
  });

  it('falls back to the single value a result without a template holds, and leaves out empty fields', () => {
    const blocks = resultReportBlocks({ key: 'res-b', title: '葡萄糖', qualityStatus: 'not_assessed', numericValue: 5.2, unit: 'mM', sampleLabel: 'S1', template: {}, values: {}, summaryBlocks: [] });
    expect(blocks[1]).toMatchObject({ type: 'table', rows: [['项目', '数值', '单位'], ['S1', '5.2', 'mM']] });
    expect(blocks[2]).toMatchObject({ text: '质量：未评估' });
    const empty = resultReportBlocks({ key: 'res-c', title: '待测', qualityStatus: 'not_assessed', template: { fields: [{ key: 'conc', label: 'RNA 浓度' }] }, values: {}, summaryBlocks: [] });
    expect(empty.map(block => 'text' in block ? block.text : block.type)).toEqual(['待测', '还没有填写数值。', '质量：未评估']);
  });
});
