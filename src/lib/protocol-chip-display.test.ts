import { describe, expect, it } from 'vitest';
import { createEmptyProtocolDocument, protocolDocumentSchema } from './protocol-document';
import { allSystemProtocolDocument, resolveProtocolDocument } from './structured-protocol';

const volume = { id: 'volume', label: '裂解液体系', options: [{ id: 'v350', label: '350 µL', symbol: 'triangle' }, { id: 'v600', label: '600 µL', symbol: 'square' }] };
const tissue = { id: 'tissue', label: '样本', kind: 'condition', options: [{ id: 'fatty', label: '富脂组织' }, { id: 'lean', label: '普通组织' }] };
const document = () => protocolDocumentSchema.parse({ ...createEmptyProtocolDocument(), systems: {
  schemaVersion: 1, dimensions: [volume, tissue], presets: [], restrictions: [], rules: [],
  parameters: [
    { id: 'pk', label: '', unit: 'µL', kind: 'volume', origin: 'chip', materialRef: { name: 'Proteinase K' }, source: { kind: 'lookup', values: [
      { id: 'pk-350', when: { all: [{ dimensionId: 'volume', optionId: 'v350' }] }, value: 50, unit: 'µL' },
      { id: 'pk-600', when: { all: [{ dimensionId: 'volume', optionId: 'v600' }] }, value: 80, unit: 'µL' }] } },
    { id: 'wait', label: '', unit: 'min', origin: 'chip', source: { kind: 'fixed', value: 10, unit: 'min' } },
    { id: 'spin-speed', label: '', unit: '×g', ownerToolId: 'spin', source: { kind: 'fixed', value: 12000, unit: '×g' } },
    { id: 'spin-time', label: '', unit: 'min', ownerToolId: 'spin', source: { kind: 'fixed', value: 1, unit: 'min' } },
    { id: 'spin-temp', label: '', unit: '°C', ownerToolId: 'spin', source: { kind: 'fixed', value: 4, unit: '°C' } },
    { id: 'buffer', label: '', unit: 'µL', origin: 'chip', source: { kind: 'lookup', values: [
      { id: 'b1', when: { all: [{ dimensionId: 'volume', optionId: 'v350' }, { dimensionId: 'tissue', optionId: 'fatty' }] }, value: 120, unit: 'µL' },
      { id: 'b2', when: { all: [{ dimensionId: 'volume', optionId: 'v350' }, { dimensionId: 'tissue', optionId: 'lean' }] }, value: 100, unit: 'µL' },
      { id: 'b3', when: { all: [{ dimensionId: 'volume', optionId: 'v600' }, { dimensionId: 'tissue', optionId: 'fatty' }] }, value: 200, unit: 'µL' },
      { id: 'b4', when: { all: [{ dimensionId: 'volume', optionId: 'v600' }, { dimensionId: 'tissue', optionId: 'lean' }] }, value: 160, unit: 'µL' }] } },
  ],
  tools: [{ id: 'spin', kind: 'centrifuge', fields: [{ key: 'speed', parameterId: 'spin-speed' }, { key: 'time', parameterId: 'spin-time' }, { key: 'temperature', parameterId: 'spin-temp' }] }],
}, sections: [{ key: 'steps', title: 'Steps', blocks: [
  { id: 'a', type: 'rich_text', nodes: [{ type: 'paragraph', content: [{ text: '加入 {{pk}} Proteinase K，静置 {{wait}}。' }] }], execution: { role: 'step', stepId: 'add', format: 'block' } },
  { id: 'b', type: 'rich_text', nodes: [{ type: 'paragraph', content: [{ text: '{{spin}}，弃上清。' }] }], execution: { role: 'step', stepId: 'spin-step', format: 'block' } },
  { id: 'c', type: 'rich_text', nodes: [{ type: 'paragraph', content: [{ text: '补加缓冲液 {{buffer}}，引用 {{gone}}。' }] }], execution: { role: 'step', stepId: 'buffer-step', format: 'block' } },
] }] });

const text = (value: unknown) => JSON.stringify(value);

describe('Parameter chips in reading and execution', () => {
  it('shows every system value with its symbol when reading all systems, and never a raw reference', () => {
    const all = text(allSystemProtocolDocument(document()));
    expect(all).toContain('加入 ▲50 / ■80 µL Proteinase K，静置 10 min。');
    expect(all).toContain('离心 12,000 ×g · 1 min · 4 °C，弃上清。');
    expect(all).toContain('▲富脂组织 120 / ▲普通组织 100 / ■富脂组织 200 / ■普通组织 160 µL');
    expect(all).toContain('〔参数已删除〕');
    expect(all).not.toContain('{{');
  });

  it('shows only the adopted value once a system is chosen, including two-dimensional values', () => {
    const resolved = resolveProtocolDocument(document(), { volume: 'v600', tissue: 'lean' });
    expect(resolved.steps.map(step => step.title)).toEqual(['加入 80 µL Proteinase K，静置 10 min', '离心 12,000 ×g · 1 min · 4 °C，弃上清', '补加缓冲液 160 µL，引用 〔参数已删除〕']);
    expect(text(resolved.steps[0].content_blocks)).toContain('加入 80 µL Proteinase K');
    expect(text(resolved.steps[0].content_blocks)).not.toContain('50');
    // Reading output never shows references; `source_blocks` keep them only for the interface to draw chips.
    expect(text({ steps: resolved.steps.map(step => [step.title, step.description, step.content_blocks]), document: resolved.document, commonBlocks: resolved.commonBlocks })).not.toContain('{{');
    expect(text(resolved.steps[0].source_blocks)).toContain('{{pk}}');
  });

  it('marks a value as pending until its system is chosen, naming it by what it is', () => {
    const pending = resolveProtocolDocument(document(), {});
    expect(text(pending.steps[0].content_blocks)).toContain('加入 〔Proteinase K：待选体系〕');
    expect(pending.steps[0].blocked).toBe(true);
    expect(pending.steps[1].blocked).toBe(false);
  });
});

describe('Recipe table columns that belong to one system', () => {
  const plate = { id: 'plate', label: '板型', options: [{ id: 'p6', label: '6 孔板' }, { id: 'p12', label: '12 孔板' }] };
  const recipe = () => protocolDocumentSchema.parse({ ...createEmptyProtocolDocument(), systems: { schemaVersion: 1, dimensions: [plate], presets: [], restrictions: [], rules: [], parameters: [] },
    sections: [{ key: 'steps', title: 'Steps', blocks: [{ id: 'mix', type: 'table', rows: [['组分', '6 孔板', '12 孔板'], ['DNA', '2 µg', '4 µg']], columnWidths: [120, 80, 90],
      columnConditions: [null, { dimensionId: 'plate', optionId: 'p6' }, { dimensionId: 'plate', optionId: 'p12' }], execution: { role: 'step', stepId: 'mix-step', format: 'block' } }] }] });
  const table = (blocks: unknown) => (blocks as Array<{ rows: string[][]; columnWidths?: number[] }>)[0];

  it('keeps only the chosen system column, and every column while the choice is pending', () => {
    expect(table(resolveProtocolDocument(recipe(), { plate: 'p12' }).steps[0].content_blocks)).toMatchObject({ rows: [['组分', '12 孔板'], ['DNA', '4 µg']], columnWidths: [120, 90] });
    expect(table(resolveProtocolDocument(recipe(), {}).steps[0].content_blocks).rows[0]).toEqual(['组分', '6 孔板', '12 孔板']);
  });

  it('marks each system column header with its symbol when reading all systems', () => {
    expect(table(allSystemProtocolDocument(recipe()).sections.find(s => s.key === 'steps')!.blocks).rows[0]).toEqual(['组分', '▲ 6 孔板', '■ 12 孔板']);
  });
});

describe('Marking a step "仅…" in one click', () => {
  it('reads several options of one system as any of them, needs every marked dimension, and unmarking restores the common step', async () => {
    const { toggleScope } = await import('./protocol-scope');
    const base = document();
    let next = 0;
    const mark = (systems: NonNullable<typeof base.systems>, dimensionId: string, optionId: string) => toggleScope(systems, { kind: 'step', id: 'add' }, dimensionId, optionId, () => `rule-${++next}`);
    const applicability = (systems: NonNullable<typeof base.systems>, selections: Record<string, string>) => resolveProtocolDocument({ ...base, systems }, selections).steps[0].applicability;
    let systems = mark(base.systems!, 'volume', 'v350');
    expect([applicability(systems, { volume: 'v350' }), applicability(systems, { volume: 'v600' }), applicability(systems, {})]).toEqual(['applicable', 'not-applicable', 'unknown']);
    systems = mark(systems, 'volume', 'v600');
    expect(applicability(systems, { volume: 'v600' })).toBe('applicable');
    systems = mark(systems, 'tissue', 'fatty');
    expect([applicability(systems, { volume: 'v600', tissue: 'fatty' }), applicability(systems, { volume: 'v600', tissue: 'lean' })]).toEqual(['applicable', 'not-applicable']);
    systems = mark(mark(mark(systems, 'volume', 'v350'), 'volume', 'v600'), 'tissue', 'fatty');
    expect(systems.rules).toEqual([]);
  });
});

describe('A recipe column keeps its system through save and reopen', () => {
  it('stores the system mark on the header cell while editing and as column conditions when saved', async () => {
    const { protocolDocumentToTiptap, tiptapToProtocolDocument } = await import('./protocol-tiptap');
    const plate = { id: 'plate', label: '板型', options: [{ id: 'p6', label: '6 孔板' }, { id: 'p12', label: '12 孔板' }] };
    const source = protocolDocumentSchema.parse({ ...createEmptyProtocolDocument(), systems: { schemaVersion: 1, dimensions: [plate], presets: [], restrictions: [], rules: [], parameters: [] },
      sections: [{ key: 'material', title: 'Material', blocks: [{ id: 'mix', type: 'table', rows: [['组分', '6 孔板', '12 孔板'], ['DNA', '2 µg', '4 µg']], columnConditions: [null, { dimensionId: 'plate', optionId: 'p6' }, { dimensionId: 'plate', optionId: 'p12' }] }] }] });
    const json = protocolDocumentToTiptap(source);
    const header = json.content!.find(node => node.attrs?.sectionKey === 'material')!.content![0].content![0].content!;
    expect(header.map(cell => cell.attrs?.protocolColumn ?? null)).toEqual([null, 'plate:p6', 'plate:p12']);
    const saved = tiptapToProtocolDocument(json).sections.find(section => section.key === 'material')!.blocks[0];
    expect(saved.type === 'table' && saved.columnConditions).toEqual([null, { dimensionId: 'plate', optionId: 'p6' }, { dimensionId: 'plate', optionId: 'p12' }]);
  });
});

describe('Deleting a system option', () => {
  it('drops its values, conditions and saved combinations so nothing is left waiting on it', async () => {
    const { withoutOption } = await import('./protocol-systems-edit');
    const source = document();
    source.systems!.rules.push({ id: 'only-600', target: 'step', targetId: 'add', when: { all: [{ dimensionId: 'volume', optionId: 'v600' }] }, parameterIds: [], optional: false, actualFields: [] });
    source.systems!.presets.push({ id: 'big', label: '大体积', selections: { volume: 'v600', tissue: 'lean' } });
    const edited = { ...source, systems: withoutOption(source.systems!, 'volume', 'v600') };
    expect(edited.systems.dimensions[0].options.map(option => option.id)).toEqual(['v350']);
    expect(edited.systems.presets).toEqual([{ id: 'big', label: '大体积', selections: { tissue: 'lean' } }]);
    const result = resolveProtocolDocument(edited, { volume: 'v350', tissue: 'lean' });
    expect(result.issues.filter(issue => issue.code === 'invalid-reference')).toEqual([]);
    const add = result.steps.find(step => step.source_ref === 'add')!;
    expect(add.applicability).toBe('applicable');
    expect(text(add.content_blocks)).toContain('50 µL');
    expect(text(result.steps.find(step => step.source_ref === 'buffer-step')!.content_blocks)).toContain('100 µL');
  });
});
