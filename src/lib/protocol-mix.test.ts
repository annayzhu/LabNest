import { describe, expect, it } from 'vitest';
import { mixView, recipeTableToMix, type ProtocolMix } from './protocol-mix';
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
      'RNase 抑制剂合计 0.11 µL，低于移液下限 0.5 µL；可先稀释或增加反应数。',
      '模板每反应 0.2 µL，低于移液下限 0.5 µL；可先稀释或增加反应数。',
    ]);
  });

  it('reads per-system amounts once the system is chosen, and waits for it before', () => {
    const dimensions = [{ id: 'plate', label: '容器', options: [{ id: 'p6', label: '6 孔板' }, { id: 'p12', label: '12 孔板' }] }];
    const reagent: Parameter = { id: 'lipo', label: 'Lipofectamine', unit: 'µL', source: { kind: 'lookup', values: [{ id: 'a', when: { all: [{ dimensionId: 'plate', optionId: 'p6' }] }, value: 7.5, unit: 'µL' }, { id: 'b', when: { all: [{ dimensionId: 'plate', optionId: 'p12' }] }, value: 3, unit: 'µL' }] } };
    const systems = systemsOf([reagent, fixed('opti', 'Opti-MEM', 125)], dimensions);
    const mix: ProtocolMix = { ...qpcr, per: '孔', components: [component('lipo', 'Lipofectamine'), component('opti', 'Opti-MEM')] };
    expect(mixView(mix, systems, resolveProtocolSystem(systems, {}).parameters, 6).lines[0]).toMatchObject({ pending: '待选体系' });
    const chosen = mixView(mix, systems, resolveProtocolSystem(systems, { plate: 'p12' }).parameters, 6);
    expect(chosen.lines.map(line => Number(line.total!.toFixed(3)))).toEqual([19.8, 825]);
    expect(chosen.aliquot).toBe('每孔分装预混液 128 µL。');
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
