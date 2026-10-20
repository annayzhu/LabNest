import { describe, expect, it } from 'vitest';
import { mixPerText, mixView, recipeTableToMix, runQuantityLabelText, runQuantityText, type ProtocolMix } from './protocol-mix';
import { createEmptyProtocolDocument, protocolDocumentSchema } from './protocol-document';
import { protocolDocumentToTiptap, tiptapToProtocolDocument } from './protocol-tiptap';
import { resolveProtocolSystem, type ProtocolSystems } from './structured-protocol';

type Parameter = ProtocolSystems['parameters'][number];
const fixed = (id: string, label: string, value: number, unit = 'µL'): Parameter => ({ id, label, unit, source: { kind: 'fixed', value, unit } });
const systemsOf = (parameters: Parameter[], dimensions: ProtocolSystems['dimensions'] = []): ProtocolSystems => ({ schemaVersion: 1, dimensions, presets: [], restrictions: [], rules: [], parameters });
const component = (id: string, name: string, mode: 'premix' | 'separate' = 'premix') => ({ id: `c-${id}`, name, amount: `{{${id}}}`, mode });
const qpcr: ProtocolMix = { id: 'mix', type: 'mix', title: 'qPCR 预混液', per: '反应', overagePercent: 10, minPipetteUl: 0.5,
  components: [component('sybr', '2× SYBR Mix'), component('f', 'Primer F'), component('r', 'Primer R'), component('water', '水'), component('cdna', 'cDNA', 'separate')] };
const qpcrSystems = systemsOf([fixed('sybr', '', 10), fixed('f', '', 0.4), fixed('r', '', 0.4), fixed('water', '', 7.2), fixed('cdna', '', 2)]);

describe('A mix card scaled to this run', () => {
  it('multiplies each premixed part by the reactions and the overage, separate additions by the reactions only, and writes the aliquot', () => {
    const view = mixView(qpcr, qpcrSystems, resolveProtocolSystem(qpcrSystems, {}).parameters, 24);
    // 24 reactions × 1.1: 264 µL SYBR, 10.56 µL of each primer, 190.08 µL water; cDNA 2 µL × 24 = 48 µL.
    expect(view.lines.map(line => [line.name, Number(line.total!.toFixed(4))])).toEqual([['2× SYBR Mix', 264], ['Primer F', 10.56], ['Primer R', 10.56], ['水', 190.08], ['cDNA', 48]]);
    expect(view.premixPerReaction).toEqual({ value: 18, unit: 'µL' });
    expect(view.aliquot).toBe('每反应分装预混液 18 µL，再加 cDNA 2 µL。');
    expect(view.aliquotText).toBe('Aliquot 18 µL of premix per reaction, then add cDNA 2 µL.');
    expect(view).toMatchObject({ ready: true, warnings: [] });
  });

  it('is not ready without the run quantity, and its fingerprint changes when the quantity does', () => {
    const resolution = resolveProtocolSystem(qpcrSystems, {}).parameters;
    expect(mixView(qpcr, qpcrSystems, resolution).ready).toBe(false);
    expect(mixView(qpcr, qpcrSystems, resolution, 24).fingerprint).not.toBe(mixView(qpcr, qpcrSystems, resolution, 25).fingerprint);
  });

  it('warns when a premixed total or a separate addition is below the pipetting minimum', () => {
    const systems = systemsOf([fixed('enzyme', 'RNase 抑制剂', 0.01), fixed('template', '模板', 0.2)]);
    const mix: ProtocolMix = { ...qpcr, components: [component('enzyme', 'RNase 抑制剂'), component('template', '模板', 'separate')] };
    // 0.01 µL × 10 × 1.1 = 0.11 µL in the premix; 0.2 µL added to each reaction.
    expect(mixView(mix, systems, resolveProtocolSystem(systems, {}).parameters, 10).warnings).toEqual([
      'RNase 抑制剂 total 0.11 µL is below the pipetting minimum of 0.5 µL; dilute it first or increase the number of reactions.',
      '模板 per reaction 0.2 µL is below the pipetting minimum of 0.5 µL; dilute it first or increase the number of reactions.',
    ]);
  });

  it('reads per-system amounts once the system is chosen, and waits for it before', () => {
    const dimensions = [{ id: 'plate', label: '容器', options: [{ id: 'p6', label: '6 孔板' }, { id: 'p12', label: '12 孔板' }] }];
    const reagent: Parameter = { id: 'lipo', label: 'Lipofectamine', unit: 'µL', source: { kind: 'lookup', values: [{ id: 'a', when: { all: [{ dimensionId: 'plate', optionId: 'p6' }] }, value: 7.5, unit: 'µL' }, { id: 'b', when: { all: [{ dimensionId: 'plate', optionId: 'p12' }] }, value: 3, unit: 'µL' }] } };
    const systems = systemsOf([reagent, fixed('opti', 'Opti-MEM', 125)], dimensions);
    const mix: ProtocolMix = { ...qpcr, per: '孔', components: [component('lipo', 'Lipofectamine'), component('opti', 'Opti-MEM')] };
    expect(mixView(mix, systems, resolveProtocolSystem(systems, {}).parameters, 6).lines[0]).toMatchObject({ pending: 'System to choose' });
    const chosen = mixView(mix, systems, resolveProtocolSystem(systems, { plate: 'p12' }).parameters, 6);
    expect(chosen.lines.map(line => Number(line.total!.toFixed(3)))).toEqual([19.8, 825]);
    expect(chosen.aliquot).toBe('每孔分装预混液 128 µL。');
    expect(chosen.aliquotText).toBe('Aliquot 128 µL of premix per well.');
  });

  it('names the stored per words and run quantity keys in English for display only, and passes typed ones through', () => {
    expect([mixPerText('反应'), mixPerText('孔', 6), mixPerText('样本', 1), mixPerText('板', 2)]).toEqual(['reaction', 'wells', 'sample', '板']);
    expect([runQuantityLabelText('反应数'), runQuantityLabelText('管数', true), runQuantityLabelText('板数')]).toEqual(['number of reactions', 'Number of tubes', '板数']);
    expect([runQuantityText(24, '反应数'), runQuantityText(1, '孔数'), runQuantityText(3, '板数')]).toEqual(['24 reactions', '1 well', '3 板数']);
    const separate: ProtocolMix = { ...qpcr, components: [component('cdna', 'cDNA', 'separate'), component('f', 'Primer F', 'separate')] };
    expect(mixView(separate, qpcrSystems, resolveProtocolSystem(qpcrSystems, {}).parameters, 4)).toMatchObject({ aliquot: '每反应加 cDNA 2 µL、Primer F 0.4 µL。', aliquotText: 'Add cDNA 2 µL, Primer F 0.4 µL per reaction.' });
  });
});

describe('Turning a recipe table into a mix card', () => {
  it('names components from the first column, keeps chips, parses "10 µL", and makes system columns one value per option', () => {
    let next = 0;
    const newId = (prefix: string) => `${prefix}-${++next}`;
    const plain = recipeTableToMix({ id: 't', type: 'table', caption: '逆转录体系', rows: [['组分', '每反应'], ['5× Buffer', '4 µL'], ['dNTP', '{{dntp}}'], ['', '']] }, newId);
    expect(plain.block).toMatchObject({ type: 'mix', title: '逆转录体系', per: '反应', overagePercent: 10 });
    expect(plain.block.components.map(item => [item.name, item.amount])).toEqual([['5× Buffer', `{{${plain.parameters[0].id}}}`], ['dNTP', '{{dntp}}']]);
    expect(plain.parameters[0]).toMatchObject({ label: '5× Buffer', unit: 'µL', source: { kind: 'fixed', value: 4, unit: 'µL' } });

    const bySystem = recipeTableToMix({ id: 't2', type: 'table', rows: [['组分', '6 孔板', '12 孔板'], ['Opti-MEM', '250 µL', '125 µL']],
      columnConditions: [null, { dimensionId: 'plate', optionId: 'p6' }, { dimensionId: 'plate', optionId: 'p12' }] }, newId);
    expect(bySystem.parameters[0].source).toMatchObject({ kind: 'lookup', values: [{ when: { all: [{ dimensionId: 'plate', optionId: 'p6' }] }, value: 250 }, { when: { all: [{ dimensionId: 'plate', optionId: 'p12' }] }, value: 125 }] });
  });
});
describe('Calculator review regressions', () => {
  it('keeps a single conditional reference conditional instead of making it global', () => {
    let id = 0;
    const systems = systemsOf([fixed('volume', 'Medium', 125)], [{ id: 'plate', label: 'Plate', options: [{ id: 'small', label: 'Small' }, { id: 'large', label: 'Large' }] }]);
    const converted = recipeTableToMix({ id: 'table', type: 'table', rows: [['Reagent', 'Small'], ['Medium', '{{volume}}']], columnConditions: [null, { dimensionId: 'plate', optionId: 'small' }] }, prefix => `${prefix}-${++id}`, systems);
    const saved = { ...systems, parameters: [...systems.parameters, ...converted.parameters] };
    expect(mixView(converted.block, saved, resolveProtocolSystem(saved, { plate: 'small' }).parameters, 6).lines[0].total).toBeCloseTo(825);
    expect(mixView(converted.block, saved, resolveProtocolSystem(saved, { plate: 'large' }).parameters, 6).ready).toBe(false);
  });

  it('preserves both referenced system amounts through table conversion and document serialization', () => {
    let id = 0;
    const dimensions = [{ id: 'plate', label: 'Plate', options: [{ id: 'p6', label: '6 wells' }, { id: 'p12', label: '12 wells' }] }];
    const systems = systemsOf([fixed('large', 'Opti-MEM', 250), fixed('small', 'Opti-MEM', 125)], dimensions);
    const converted = recipeTableToMix({ id: 'table', type: 'table', rows: [['Reagent', '6 wells', '12 wells'], ['Opti-MEM', '{{large}}', '{{small}}']], columnConditions: [null, { dimensionId: 'plate', optionId: 'p6' }, { dimensionId: 'plate', optionId: 'p12' }] }, prefix => `${prefix}-${++id}`, systems);
    const document = createEmptyProtocolDocument();
    document.systems = { ...systems, parameters: [...systems.parameters, ...converted.parameters] };
    document.sections.find(section => section.key === 'material')!.blocks = [converted.block];
    const reopened = protocolDocumentSchema.parse(tiptapToProtocolDocument(protocolDocumentToTiptap(document), [], false, document.systems));
    const saved = reopened.systems!;
    expect(reopened.sections.find(section => section.key === 'material')!.blocks).toContainEqual(converted.block);
    for (const [option, expected] of [['p6', 1650], ['p12', 825]] as const) {
      const view = mixView(converted.block, saved, resolveProtocolSystem(saved, { plate: option }).parameters, 6);
      expect(view.ready).toBe(true);
      expect(view.lines[0].total).toBeCloseTo(expected);
    }
    expect(mixView(converted.block, saved, resolveProtocolSystem(saved, {}).parameters, 6).ready).toBe(false);
  });

  it('rejects negative, nonfinite and missing resolved amounts before generating totals or instructions', () => {
    const mix = { ...qpcr, components: [component('bad', 'Invalid volume')] };
    const systems = systemsOf([fixed('bad', '', 1)]);
    for (const value of [-5, NaN, Infinity, undefined]) {
      const view = mixView(mix, systems, { bad: { status: 'resolved', value, unit: 'µL' } }, 24);
      expect(view.ready).toBe(false);
      expect(view.lines[0].total).toBeUndefined();
      expect(view.premixPerReaction).toBeUndefined();
      expect(view.aliquot).toBe('');
    }
    const resolution = resolveProtocolSystem(qpcrSystems, {}).parameters;
    for (const quantity of [0, -1, Infinity, NaN]) expect(mixView(qpcr, qpcrSystems, resolution, quantity).ready).toBe(false);
    expect(mixView({ ...qpcr, components: [] }, qpcrSystems, resolution, 24).ready).toBe(false);
    expect(mixView({ ...qpcr, overagePercent: -200 }, qpcrSystems, resolution, 24).ready).toBe(false);
    expect(mixView(mix, systems, { bad: { status: 'resolved', value: 1e308, unit: 'µL' } }, 24).ready).toBe(false);
    expect(mixView(mix, systems, { bad: { status: 'resolved', value: 0, unit: 'µL' } }, 24).ready).toBe(true);
  });
});

it('retains nested lookup conditions and mixed units; refuses ambiguous or runtime-dependent columns without changing the table', () => {
  let id = 0;
  const newId = (prefix: string) => `${prefix}-${++id}`;
  const plate = { id: 'plate', label: 'Plate', options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] };
  const sample = { id: 'sample', label: 'Sample', options: [{ id: 'x', label: 'X' }, { id: 'y', label: 'Y' }] };
  const systems = systemsOf([fixed('a', '', 0.25, 'mL'), { id: 'b', label: '', unit: 'µL', source: { kind: 'lookup', values: [{ id: 'x', when: { all: [{ dimensionId: 'sample', optionId: 'x' }] }, value: 125, unit: 'µL' }, { id: 'y', when: { all: [{ dimensionId: 'sample', optionId: 'y' }] }, value: 75, unit: 'µL' }] } }], [plate, sample]);
  const table = { id: 'table', type: 'table' as const, rows: [['Reagent', 'A', 'B'], ['Medium', '{{a}}', '{{b}}']], columnConditions: [null, { dimensionId: 'plate', optionId: 'a' }, { dimensionId: 'plate', optionId: 'b' }] };
  const original = structuredClone(table);
  const { block, parameters } = recipeTableToMix(table, newId, systems);
  const saved = { ...systems, parameters: [...systems.parameters, ...parameters] };
  expect(mixView(block, saved, resolveProtocolSystem(saved, { plate: 'b', sample: 'x' }).parameters, 6).lines[0].total).toBeCloseTo(0.825);
  expect(mixView(block, saved, resolveProtocolSystem(saved, { plate: 'b' }).parameters, 6).ready).toBe(false);
  expect(() => recipeTableToMix({ ...table, columnConditions: undefined }, newId, systems)).toThrow(/Assign a system/);
  systems.parameters[1].source = { kind: 'actual' };
  expect(() => recipeTableToMix(table, newId, systems)).toThrow(/runtime/);
  expect(table).toEqual(original);
});
