import { describe, expect, it } from 'vitest';
import { createEmptyProtocolDocument, projectProtocolDocument, type ProtocolContentBlock, type ProtocolDocument } from './protocol-document';
import { convertLegacyProtocol, isLegacyProtocol } from './protocol-conversion';
import { templateFromRecordLines } from './result-record-line';

const ids = () => { let n = 0; return (prefix: string) => `${prefix}-${++n}`; };
const section = (document: ProtocolDocument, key: string) => document.sections.find(item => item.key === key)!;
const text = (block: ProtocolContentBlock) => block.type === 'rich_text' ? block.nodes.map(node => node.content.map(run => run.text).join('')).join(' / ')
  : block.type === 'checklist' ? block.items.join(' / ') : 'text' in block ? block.text : block.type;

/** An organized old Protocol: 步骤整理 headings with checklists, a note, a formula table and an old result template. */
function organized(): ProtocolDocument {
  const document = createEmptyProtocolDocument();
  section(document, 'material').blocks = [{ id: 'm', type: 'table', caption: 'Materials', rows: [['Name', 'Unit', 'Role', 'Notes'], ['FastPure RNA Column III', '支', '吸附柱', '']] }];
  section(document, 'steps').blocks = [
    { id: 'h1', type: 'heading', text: '1. 试剂与批次准备', execution: { role: 'step', stepId: 'h1', title: '试剂与批次准备' } },
    { id: 'c1', type: 'checklist', items: ['核对 Buffer RL 批号', '准备 1.5 mL 离心管 2 支'], execution: { role: 'detail', stepId: 'h1' } },
    { id: 'h2', type: 'heading', text: '2. 培养细胞裂解', execution: { role: 'step', stepId: 'h2', title: '培养细胞裂解' } },
    { id: 'c2', type: 'checklist', items: ['加入 Buffer RL 500 µL，吹打混匀', '室温静置 5 min'], execution: { role: 'detail', stepId: 'h2' } },
    { id: 'n1', type: 'text', text: '注：以下操作在冰上进行', execution: { role: 'info' } },
    { id: 'h3', type: 'heading', text: '3. 离心', execution: { role: 'step', stepId: 'h3', title: '离心' } },
    { id: 't3', type: 'text', text: '12,000 ×g 离心 1 min，弃滤液。', execution: { role: 'detail', stepId: 'h3' } },
  ];
  section(document, 'consumption_rules').blocks = [{ id: 'f', type: 'table', caption: 'Consumption rules', rows: [['Material', 'Formula', 'Unit'],
    ['Buffer RL', '500 µL', '适用于<5 × 10⁶ cells'], ['无水乙醇', '滤液体积 × 0.5', '约 250 µL'], ['FastPure RNA Column III', '1支', '一次性']] }];
  const template = templateFromRecordLines({ record: '记录：浓度 ng/µL、A260/280' }, undefined, 'RNA_Isolation_Record');
  section(document, 'result_templates').blocks = [{ id: 'r', type: 'table', caption: template.title, rows: [], resultTemplate: template }];
  return document;
}

describe('旧规程转换 into step blocks', () => {
  it('makes each old step one step block, with chips for amounts and container sizes left as words', () => {
    const source = organized();
    const before = structuredClone(source);
    expect(isLegacyProtocol(source)).toBe(true);
    const { document, summary } = convertLegacyProtocol(source, ids());
    expect(source).toEqual(before);
    expect(isLegacyProtocol(document)).toBe(false);
    const blocks = section(document, 'steps').blocks;
    expect(blocks.map(block => [block.execution?.role, block.type, text(block).replace(/\{\{[\w-]+\}\}/g, '〔〕')])).toEqual([
      ['step', 'rich_text', '试剂与批次准备'], ['detail', 'checklist', '核对 Buffer RL 批号 / 准备 1.5 mL 离心管 2 支'],
      ['step', 'rich_text', '培养细胞裂解'], ['detail', 'checklist', '加入 Buffer RL 〔〕，吹打混匀 / 室温静置 〔〕'],
      ['info', 'text', '注：以下操作在冰上进行'],
      ['step', 'rich_text', '离心'], ['detail', 'rich_text', '〔〕 离心 〔〕，弃滤液。'],
    ]);
    expect(blocks.filter(block => block.execution?.role === 'step').every(block => block.execution?.format === 'block' && block.execution.stepId === block.id)).toBe(true);
    expect(summary).toEqual({ steps: 3, notes: 1, chips: ['500 µL', '5 min', '1 min', '12000 ×g'], keptAsText: ['1.5 mL'], systems: [], conditions: [], formulaRows: 2, alreadyListed: ['FastPure RNA Column III'], resultTemplates: 1, recordLines: 0 });
    expect(projectProtocolDocument(document).steps.map(step => step.title)).toEqual(['试剂与批次准备', '培养细胞裂解', '离心']);
  });

  it('moves the formula table into the materials and leaves no formula table behind', () => {
    const { document } = convertLegacyProtocol(organized(), ids());
    expect(section(document, 'consumption_rules').blocks).toEqual([]);
    expect(section(document, 'material').blocks.at(-1)).toMatchObject({ type: 'table', caption: '材料（来自旧公式表）', rows: [['名称', '用量', '说明'], ['Buffer RL', '500 µL', '适用于<5 × 10⁶ cells'], ['无水乙醇', '滤液体积 × 0.5', '约 250 µL']] });
    expect(projectProtocolDocument(document).materials.map(item => [item.name, item.notes ?? ''])).toEqual([['FastPure RNA Column III', ''], ['Buffer RL', '500 µL · 适用于<5 × 10⁶ cells'], ['无水乙醇', '滤液体积 × 0.5 · 约 250 µL']]);
    expect(section(document, 'result_templates').blocks).toHaveLength(1);
  });

  it('reads an unorganized import the way the Steps section is read today: numbered lines open steps', () => {
    const source = createEmptyProtocolDocument();
    section(source, 'steps').blocks = [{ id: 'b', type: 'rich_text', nodes: [
      { type: 'numbered', content: [{ text: '取细胞沉淀' }] }, { type: 'paragraph', content: [{ text: '加入 PBS 1 mL 重悬' }] }, { type: 'paragraph', content: [{ text: '吹打 10 次' }] },
      { type: 'numbered', content: [{ text: '离心 300 ×g 5 min' }] },
    ] }];
    const { document, summary } = convertLegacyProtocol(source, ids());
    expect(section(document, 'steps').blocks.map(block => [block.execution?.role, text(block).replace(/\{\{[\w-]+\}\}/g, '〔〕')])).toEqual([
      ['step', '取细胞沉淀'], ['detail', '加入 PBS 〔〕 重悬 / 吹打 10 次'], ['step', '离心 〔〕 〔〕'],
    ]);
    expect(summary.steps).toBe(2);
    expect(summary.chips).toEqual(['1 mL', '5 min', '300 ×g']);
  });
});

describe('Result templates in the projection', () => {
  it('count a template that records only a picture, and leave out one with nothing written', () => {
    const document = createEmptyProtocolDocument();
    const picture = templateFromRecordLines({ record: '记录：胶图' });
    const nothing = templateFromRecordLines({});
    section(document, 'result_templates').blocks = [
      { id: 'a', type: 'table', caption: picture.title, rows: [['Field key']], resultTemplate: picture },
      { id: 'b', type: 'table', caption: nothing.title, rows: [['Field key']], resultTemplate: nothing },
    ];
    expect(projectProtocolDocument(document).resultTemplates.map(template => template.artifacts?.map(artifact => artifact.label))).toEqual([['胶图']]);
  });
});

describe('A Protocol written by habit, as a Word file reads in', () => {
  it('declares the system, splits "350/600 µL" by it, limits a "仅…：" step and turns "记录：" into a template', () => {
    const source = createEmptyProtocolDocument();
    section(source, 'steps').blocks = [
      { id: 'd', type: 'text', text: '体系：350 µL / 600 µL' },
      { id: 's1', type: 'heading', text: '1. 加入 Buffer RL 350/600 µL，涡旋混匀 15 s。' },
      { id: 's2', type: 'heading', text: '2. 仅富脂样本：加入氯仿 200 µL，剧烈振荡。' },
      { id: 's3', type: 'heading', text: '3. 12,000 ×g 离心 2 min，取上清。' },
    ];
    section(source, 'result_templates').blocks = [
      { id: 'r0', type: 'text', text: 'RNA 质检' },
      { id: 'r1', type: 'text', text: '记录：浓度 ng/µL、A260/280、胶图' },
      { id: 'r2', type: 'text', text: '每个样本：样本名、Ct 值' },
    ];
    const { document, summary } = convertLegacyProtocol(source, ids());
    const systems = document.systems!;
    expect(systems.dimensions.map(dimension => [dimension.label, dimension.kind ?? 'system', dimension.options.map(option => option.label).join(' / ')])).toEqual([
      ['体系', 'system', '350 µL / 600 µL'], ['富脂样本', 'condition', '是 / 否'],
    ]);
    const blocks = section(document, 'steps').blocks;
    expect(blocks.map(block => text(block).replace(/\{\{[\w-]+\}\}/g, '〔〕'))).toEqual(['加入 Buffer RL 〔〕，涡旋混匀 〔〕。', '加入氯仿 〔〕，剧烈振荡。', '〔〕 离心 〔〕，取上清。']);
    const split = systems.parameters.find(parameter => parameter.source.kind === 'lookup')!;
    expect(split.source).toMatchObject({ kind: 'lookup', values: [{ value: 350, unit: 'µL', when: { all: [{ dimensionId: systems.dimensions[0].id, optionId: systems.dimensions[0].options[0].id }] } }, { value: 600 }] });
    expect(systems.rules).toEqual([expect.objectContaining({ target: 'step', targetId: blocks[1].id, when: { all: [{ dimensionId: systems.dimensions[1].id, optionId: systems.dimensions[1].options[0].id }] } })]);
    expect(summary).toMatchObject({ steps: 3, systems: ['体系：350 µL / 600 µL'], conditions: ['第 2 步 · 仅富脂样本'], recordLines: 1, resultTemplates: 1, chips: ['15 s', '350/600 µL', '200 µL', '2 min', '12000 ×g'] });
    const template = section(document, 'result_templates').blocks[0];
    expect(template.type === 'table' && template.resultTemplate).toMatchObject({ title: 'RNA 质检', authored: { record: '记录：浓度 ng/µL、A260/280、胶图', perSample: '每个样本：样本名、Ct 值' } });
  });
  it('keeps a note and a row without a formula from 消耗规则, and opens an empty step with its title', () => {
    const document = organized();
    section(document, 'consumption_rules').blocks.push(
      { id: 'note', type: 'text', text: '乙醇现配现用' },
      { id: 'f2', type: 'table', rows: [['材料', '公式', '单位'], ['RNase-free 水', '', 'µL']] },
    );
    section(document, 'steps').blocks.push({ id: 'empty', type: 'rich_text', nodes: [], execution: { role: 'step', stepId: 'empty', title: '收尾' } });
    const { document: converted } = convertLegacyProtocol(document, ids());
    const material = section(converted, 'material').blocks;
    const moved = material.find(block => block.type === 'table' && block.caption === '材料（来自旧公式表）');
    expect(moved?.type === 'table' && moved.rows).toContainEqual(['RNase-free 水', '', 'µL']);
    expect(material.map(text)).toContain('乙醇现配现用');
    expect(section(converted, 'consumption_rules').blocks).toEqual([]);
    expect(section(converted, 'steps').blocks.filter(block => block.execution?.role === 'step').map(text)).toContain('收尾');
  });
});
