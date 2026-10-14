import { describe, expect, it } from 'vitest';
import { resolveProtocolSystem, resolveProtocolDocument, previewProtocolCalculation, type ProtocolSystems } from './structured-protocol';
import { createEmptyProtocolDocument, normalizeProtocolDocument } from './protocol-document';
import { protocolDocumentToTiptap, tiptapToProtocolDocument } from './protocol-tiptap';

const systems: ProtocolSystems = {
  schemaVersion: 1,
  dimensions: [{ id: 'volume', label: '裂解体积', options: [{ id: 'small', label: '350 µL' }, { id: 'large', label: '600 µL' }] }],
  presets: [], restrictions: [], rules: [],
  parameters: [{ id: 'proteinase', label: 'Proteinase K', unit: 'µL', source: { kind: 'lookup', values: [
    { id: 'pk-small', when: { all: [{ dimensionId: 'volume', optionId: 'small' }] }, value: 50, unit: 'µL' },
    { id: 'pk-large', when: { all: [{ dimensionId: 'volume', optionId: 'large' }] }, value: 80, unit: 'µL' },
  ] } }],
};

describe('confirmed Protocol system contract', () => {
  it('reuses the dilution calculator and blocks stale or failed calculations until explicitly adopted again', () => {
    const config: ProtocolSystems = { ...structuredClone(systems), parameters: [
      { id: 'stock', label: '母液', unit: 'µM', source: { kind: 'fixed', value: 100, unit: 'µM' } },
      { id: 'target', label: '终浓度', unit: 'µM', source: { kind: 'actual' } },
      { id: 'total', label: '总体积', unit: 'µL', source: { kind: 'fixed', value: 100, unit: 'µL' } },
      { id: 'take', label: '取母液', unit: 'µL', source: { kind: 'calculator', calculatorId: 'dilution', output: 'stockVolumeUl', inputs: { stockConcentration: 'stock', targetConcentration: 'target', finalVolume: 'total' } } },
    ] };
    const actual = { target: { value: 10, unit: 'µM' } };
    const pending = resolveProtocolSystem(config, {}, actual);
    expect(pending.parameters.take.status).toBe('unknown');
    const preview = previewProtocolCalculation(config.parameters[3], pending.parameters);
    expect(preview).toMatchObject({ value: 10, unit: 'µL', snapshot: { calculatorId: 'dilution', status: 'valid' } });
    const receipts = { take: { ...preview, confirmedAt: '2026-10-14T02:00:00Z' } };
    expect(resolveProtocolSystem(config, {}, actual, receipts).parameters.take).toMatchObject({ status: 'resolved', value: 10 });
    const historical = structuredClone(receipts);
    historical.take.snapshot.methodVersion = 'previous-method';
    historical.take.value = 9.99;
    expect(resolveProtocolSystem(config, {}, actual, historical).parameters.take).toMatchObject({ status: 'resolved', value: 9.99, sourceId: 'dilution:previous-method' });
    expect(resolveProtocolSystem(config, {}, { target: { value: 20, unit: 'µM' } }, receipts).parameters.take).toMatchObject({ status: 'unknown', message: expect.stringContaining('重新计算') });
    const invalid = resolveProtocolSystem(config, {}, { target: { value: 200, unit: 'µM' } }, receipts);
    expect(invalid.parameters.take.status).toBe('invalid');
    expect(invalid.parameters.take.value).toBeUndefined();
    expect(receipts.take.value).toBe(10);
  });
  it('preserves authored system definitions through save, reopen and editor round-trip', () => {
    const authored = { ...createEmptyProtocolDocument(), systems };
    const reopened = normalizeProtocolDocument(authored)!;
    expect(reopened).toHaveProperty('systems', systems);
    expect(tiptapToProtocolDocument(protocolDocumentToTiptap(reopened))).toHaveProperty('systems', systems);
  });
  it('rejects dangling conditions instead of turning them into not-applicable content', () => {
    const invalid = structuredClone(systems);
    invalid.parameters[0].source = { kind: 'lookup', values: [{ id: 'orphan', when: { all: [{ dimensionId: 'missing', optionId: 'x' }] }, value: 50, unit: 'µL' }] };
    expect(resolveProtocolSystem(invalid, { volume: 'small' }).issues).toContainEqual(expect.objectContaining({ code: 'invalid-reference', targetId: 'proteinase' }));
  });
  it('filters stable table rows and conditional steps without changing the captured source or common steps', () => {
    const document = { ...createEmptyProtocolDocument(), systems: structuredClone(systems), executionConfirmed: true };
    document.systems.rules.push({ id: 'large-row', target: 'row', targetId: 'row-large', when: { all: [{ dimensionId: 'volume', optionId: 'large' }] }, parameterIds: [], optional: false, actualFields: [] });
    document.sections.find(s => s.key === 'steps')!.blocks = [
      { id: 'head', type: 'heading', text: 'Add Proteinase K', execution: { role: 'step', stepId: 'add', title: 'Add Proteinase K' } },
      { id: 'table', type: 'table', rowIds: ['header', 'row-common', 'row-large'], rows: [['Reagent', 'Amount'], ['Proteinase K', '{{proteinase}}'], ['Large-only reagent', '3 µL']], execution: { role: 'detail', stepId: 'add' } },
    ];
    const before = JSON.stringify(document);
    const result = resolveProtocolDocument(document, { volume: 'small' });
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]).toMatchObject({ source_ref: 'add', applicability: 'applicable', blocked: false });
    expect(result.steps[0].content_blocks).toEqual([expect.objectContaining({ rowIds: ['header', 'row-common'], rows: [['Reagent', 'Amount'], ['Proteinase K', '50 µL']] })]);
    expect(JSON.stringify(document)).toBe(before);
    expect(resolveProtocolDocument(document, {}).steps[0]).toMatchObject({ applicability: 'applicable', blocked: true });
    const roundTrip = tiptapToProtocolDocument(protocolDocumentToTiptap(normalizeProtocolDocument(document)!));
    expect(roundTrip.sections.find(s => s.key === 'steps')!.blocks[1]).toHaveProperty('rowIds', ['header', 'row-common', 'row-large']);
  });
  it('uses authored 50/80 µL lookup values without scaling the 350/600 systems', () => {
    expect(resolveProtocolSystem(systems, { volume: 'small' }).parameters.proteinase).toMatchObject({ status: 'resolved', value: 50, unit: 'µL', sourceId: 'pk-small' });
    expect(resolveProtocolSystem(systems, { volume: 'large' }).parameters.proteinase).toMatchObject({ status: 'resolved', value: 80, unit: 'µL', sourceId: 'pk-large' });
    expect(resolveProtocolSystem(systems, {}).parameters.proteinase.status).toBe('unknown');
  });
  it('distinguishes unknown sample conditions, independent overlaps, exclusive conflicts and illegal combinations', () => {
    const config = structuredClone(systems);
    config.dimensions.push({ id: 'sample', label: '样本', options: [{ id: 'lipid', label: '高脂' }, { id: 'normal', label: '普通' }] });
    const rule = (id: string, when: ProtocolSystems['rules'][number]['when'], exclusiveGroup?: string): ProtocolSystems['rules'][number] => ({ id, target: 'step', targetId: id, when, exclusiveGroup, parameterIds: [], optional: false, actualFields: [] });
    config.rules = [rule('lipid', { all: [{ dimensionId: 'sample', optionId: 'lipid' }] }), rule('large', { all: [{ dimensionId: 'volume', optionId: 'large' }] })];
    expect(resolveProtocolSystem(config, { volume: 'large' }).rules).toEqual({ lipid: 'unknown', large: 'applicable' });
    expect(resolveProtocolSystem(config, { volume: 'large', sample: 'lipid' }).rules).toEqual({ lipid: 'applicable', large: 'applicable' });
    expect(resolveProtocolSystem(config, { volume: 'small', sample: 'normal' }).rules).toEqual({ lipid: 'not-applicable', large: 'not-applicable' });
    config.rules.forEach(r => { r.exclusiveGroup = 'alternative'; });
    expect(resolveProtocolSystem(config, { volume: 'large', sample: 'lipid' }).issues).toContainEqual(expect.objectContaining({ code: 'exclusive-conflict' }));
    config.restrictions.push({ id: 'forbidden', when: { all: [{ dimensionId: 'volume', optionId: 'small' }, { dimensionId: 'sample', optionId: 'lipid' }] }, message: '组合不适用' });
    expect(resolveProtocolSystem(config, { volume: 'small', sample: 'lipid' }).issues).toContainEqual(expect.objectContaining({ code: 'illegal-combination' }));
  });
  it('never picks the first matching lookup or converts rpm to acceleration', () => {
    const config = structuredClone(systems);
    if (config.parameters[0].source.kind !== 'lookup') throw new Error('fixture');
    config.parameters[0].source.values.push({ id: 'overlap', when: {}, value: 91, unit: 'µL' });
    expect(resolveProtocolSystem(config, { volume: 'small' }).parameters.proteinase.status).toBe('conflict');
    config.parameters.push({ id: 'speed', label: '离心', unit: '×g', source: { kind: 'fixed', value: 3000, unit: 'rpm' } });
    expect(resolveProtocolSystem(config, { volume: 'large' }).parameters.speed.status).toBe('invalid');
  });
});

it('blocks a missing parameter referenced only in a step title and keeps an empty quantity unknown', () => {
  const document = { ...createEmptyProtocolDocument(), systems: structuredClone(systems), executionConfirmed: true };
  document.systems.parameters = [{ id: 'dose', label: '剂量', unit: 'mL', source: { kind: 'fixed', value: null, unit: 'µL' } }];
  document.sections.find(s => s.key === 'steps')!.blocks = [{ id: 'h', type: 'heading', text: '加入 {{dose}}', execution: { role: 'step', stepId: 'add', title: '加入 {{dose}}' } }];
  expect(resolveProtocolDocument(document, {}).steps[0].blocked).toBe(true);
  document.systems.parameters[0].source = { kind: 'fixed', value: 50, unit: 'µL' };
  expect(resolveProtocolDocument(document, {}).steps[0]).toMatchObject({ blocked: false, title: '加入 0.05 mL' });
  expect(document.systems.parameters[0].source).toMatchObject({ value: 50, unit: 'µL' });
});

it('retains conditional row captions in rich cells and all-system alternatives without changing source', async () => {
  const { allSystemProtocolDocument } = await import('./structured-protocol');
  const document = { ...createEmptyProtocolDocument(), systems: structuredClone(systems) };
  document.systems.rules = [{ id: 'row-rule', target: 'row', targetId: 'large', when: { all: [{ dimensionId: 'volume', optionId: 'large' }] }, parameterIds: [], actualFields: [], optional: false }];
  document.sections[0].blocks = [{ id: 'table', type: 'table', rows: [['试剂', '量'], ['试剂A', '{{proteinase}}']], rowIds: ['header', 'large'], cellRichContent: [[null, null], [[{ type: 'paragraph', content: [{ type: 'text', text: '试剂A', marks: [{ type: 'bold' }] }] }], null]] }];
  const source = JSON.stringify(document), table = allSystemProtocolDocument(document).sections[0].blocks[0];
  expect(table.type).toBe('table');
  if (table.type !== 'table') throw new Error('fixture');
  expect(JSON.stringify(table.cellRichContent?.[1][0])).toContain('600 µL');
  expect(table.rows[1][1]).toContain('50 µL'); expect(table.rows[1][1]).toContain('80 µL');
  expect(JSON.stringify(document)).toBe(source);
});
