import { describe, expect, it } from 'vitest';
import { previewProtocolCalculation, resolveProtocolSystem, validateProtocolSystems, type ProtocolCalculation, type ProtocolSystems } from './structured-protocol';
import { protocolChipText } from './protocol-chips';

type Parameter = ProtocolSystems['parameters'][number];
type Actual = Record<string, { value: number; unit: string }>;
const fixed = (id: string, label: string, value: number, unit: string): Parameter => ({ id, label, unit, source: { kind: 'fixed', value, unit } });
const actual = (id: string, label: string, unit: string): Parameter => ({ id, label, unit, source: { kind: 'actual' } });
const result = (id: string, label: string, unit: string, calculatorId: string, output: string, inputs: Record<string, string>) =>
  ({ id, label, unit, source: { kind: 'calculator', calculatorId, output, inputs } }) as Parameter;
const systemsOf = (parameters: Parameter[]): ProtocolSystems => ({ schemaVersion: 1, dimensions: [], presets: [], restrictions: [], rules: [], parameters });

/** What the Run preparation does: preview each result with what is known now, then adopt it. */
function confirm(systems: ProtocolSystems, ids: string[], actualInputs: Actual) {
  const receipts: Record<string, ProtocolCalculation> = {};
  for (const id of ids) {
    const current = resolveProtocolSystem(systems, {}, actualInputs, receipts);
    receipts[id] = { ...previewProtocolCalculation(systems.parameters.find(p => p.id === id)!, current.parameters), confirmedAt: '2026-10-15T08:00:00Z' };
  }
  return resolveProtocolSystem(systems, {}, actualInputs, receipts).parameters;
}

describe('Calculation chips reuse the existing calculators', () => {
  it('works out a transfection mix from the DNA concentration measured on the day', () => {
    const inputs = { wells: 'wells', dnaUgPerWell: 'dna', dnaConcentrationUgUl: 'conc', reagentUlPerUg: 'ratio', complexVolumeUlPerWell: 'complex', overagePercent: 'over' };
    const systems = systemsOf([
      fixed('wells', '孔数', 6, '孔'), fixed('dna', '每孔 DNA', 2, 'µg'), actual('conc', 'DNA 母液浓度', 'ng/µL'),
      fixed('ratio', '每 µg DNA 试剂量', 1.5, 'µL/µg'), fixed('complex', '每孔复合物体积', 125, 'µL'), fixed('over', '余量', 10, '%'),
      result('dna-volume', 'DNA 原液', 'µL', 'transfection', 'dnaVolumeUl', inputs),
      result('reagent', '转染试剂', 'µL', 'transfection', 'reagentUl', inputs),
      result('diluent', '稀释液', 'µL', 'transfection', 'diluentUl', inputs),
    ]);
    expect(validateProtocolSystems(systems)).toEqual([]);
    expect(protocolChipText('dna-volume', systems)).toBe('〔DNA 原液：计算后确认 · µL〕');
    const adopted = confirm(systems, ['dna-volume', 'reagent', 'diluent'], { conc: { value: 500, unit: 'ng/µL' } });
    // 6 wells × 1.1: 13.2 µg DNA at 0.5 µg/µL; 19.8 µL reagent; 825 µL complex in total.
    expect(adopted['dna-volume'].value).toBeCloseTo(26.4, 6);
    expect(adopted.reagent.value).toBeCloseTo(19.8, 6);
    expect(adopted.diluent.value).toBeCloseTo(778.8, 6);
  });

  it('plates from a cell count taken on the day: the count feeds the seeding volumes', () => {
    const count = { count1: 'c1', count2: 'c2', count3: 'c3', count4: 'c4', dilutionFactor: 'trypan', viabilityPercent: 'viability' };
    const seeding = { stockCellsPerMl: 'viable', wells: 'wells', cellsPerWell: 'per-well', volumePerWellUl: 'volume', overagePercent: 'over' };
    const systems = systemsOf([
      actual('c1', '计数 1', 'cells'), actual('c2', '计数 2', 'cells'), actual('c3', '计数 3', 'cells'), actual('c4', '计数 4', 'cells'),
      fixed('trypan', '稀释倍数', 2, '×'), actual('viability', '活率', '%'),
      result('viable', '活细胞浓度', 'cells/mL', 'hemocytometer', 'viableCellsPerMl', count),
      fixed('wells', '孔数', 24, '孔'), fixed('per-well', '每孔细胞数', 50000, 'cells'), fixed('volume', '每孔体积', 0.5, 'mL'), fixed('over', '余量', 10, '%'),
      result('suspension', '细胞悬液', 'mL', 'seeding', 'stockVolumeMl', seeding),
      result('medium', '培养基', 'mL', 'seeding', 'mediumVolumeMl', seeding),
    ]);
    expect(validateProtocolSystems(systems)).toEqual([]);
    expect(protocolChipText('suspension', systems)).toBe('〔细胞悬液：计算后确认 · mL〕');
    const day = { c1: { value: 13, unit: 'cells' }, c2: { value: 11, unit: 'cells' }, c3: { value: 14, unit: 'cells' }, c4: { value: 17, unit: 'cells' }, viability: { value: 90, unit: '%' } };
    const adopted = confirm(systems, ['viable', 'suspension', 'medium'], day);
    // Average 13.75 × 2 × 10⁴ = 275,000 cells/mL, 90% viable; 24 wells × 50,000 cells × 1.1 in 13.2 mL.
    expect(adopted.viable.value).toBeCloseTo(247500, 6);
    expect(adopted.suspension.value).toBeCloseTo(5.333333, 5);
    expect(adopted.medium.value).toBeCloseTo(7.866667, 5);
  });

  it('weighs a solid for a molar concentration and makes 1× from a 10× stock', () => {
    const weigh = { molecularWeight: 'mw', concentrationM: 'conc', volumeL: 'volume' };
    const fold = { stockFold: 'stock-fold', targetFold: 'target-fold', finalVolume: 'final' };
    const systems = systemsOf([
      fixed('mw', '分子量', 121.14, 'g/mol'), fixed('conc', '目标浓度', 50, 'mM'), fixed('volume', '定容体积', 500, 'mL'),
      result('mass', 'Tris', 'g', 'molarity', 'massG', weigh),
      fixed('stock-fold', '浓缩倍数', 10, '×'), fixed('target-fold', '目标倍数', 1, '×'), fixed('final', '终体积', 500, 'mL'),
      result('stock', '10× 缓冲液', 'mL', 'fold-dilution', 'stockVolumeUl', fold),
      result('water', '补水', 'mL', 'fold-dilution', 'diluentVolume', fold),
    ]);
    expect(validateProtocolSystems(systems)).toEqual([]);
    const adopted = confirm(systems, ['mass', 'stock', 'water'], {});
    expect(adopted.mass.value).toBeCloseTo(3.0285, 6);
    expect(adopted.stock.value).toBeCloseTo(50, 6);
    expect(adopted.water.value).toBeCloseTo(450, 6);
  });

  it('works out the virus volume for an MOI from the titer of this batch', () => {
    const inputs = { cells: 'cells', desiredMoi: 'moi', titer: 'titer' };
    const systems = systemsOf([
      fixed('cells', '细胞数', 100000, 'cells'), fixed('moi', '目标 MOI', 10, 'MOI'), actual('titer', '病毒滴度', 'TU/mL'),
      result('virus', '病毒液', 'µL', 'moi', 'virusVolumeUl', inputs),
    ]);
    expect(validateProtocolSystems(systems)).toEqual([]);
    expect(confirm(systems, ['virus'], { titer: { value: 1e8, unit: 'TU/mL' } }).virus.value).toBeCloseTo(10, 6);
  });

  it('explains problems in the words of the protocol, never with internal keys', () => {
    const inputs = { stockCellsPerMl: 'stock', wells: 'wells', cellsPerWell: 'per-well', volumePerWellUl: 'volume', overagePercent: 'over' };
    const parameters = [fixed('stock', '活细胞浓度', 1e6, 'cells/mL'), fixed('wells', '孔数', 24, '孔'), fixed('per-well', '每孔细胞数', 50000.5, 'cells'), fixed('volume', '每孔体积', 500, 'µL'), fixed('over', '余量', 10, '%')];
    const systems = systemsOf([...parameters, result('suspension', '细胞悬液', 'mL', 'seeding', 'stockVolumeMl', inputs)]);
    expect(() => previewProtocolCalculation(systems.parameters.at(-1)!, resolveProtocolSystem(systems, {}).parameters)).toThrow(/每孔细胞数/);
    expect(() => previewProtocolCalculation(systems.parameters.at(-1)!, resolveProtocolSystem(systems, {}).parameters)).not.toThrow(/cellsPerWell/);
    const broken = systemsOf([...parameters, result('suspension', '细胞悬液', 'mL', 'seeding', 'leftoverMl', { wells: 'wells' })]);
    const messages = validateProtocolSystems(broken).map(issue => issue.message).join('；');
    expect(messages).toContain('细胞悬液');
    expect(messages).not.toMatch(/leftoverMl|stockCellsPerMl|suspension/);
  });
});

describe('Inserting a calculation into a step', () => {
  it('starts plating from the cell count already in the Protocol, and groups results computed together', async () => {
    const { newCalculation, siblingResult, calculationGroups } = await import('./protocol-calculations');
    let next = 0;
    const newId = (prefix: string) => `${prefix}-${++next}`;
    const counted = newCalculation('hemocytometer', { parameters: [] }, newId);
    const countResult = counted.parameters.find(p => p.id === counted.resultId)!;
    expect(countResult).toMatchObject({ label: '活细胞浓度', unit: 'cells/mL', source: { output: 'viableCellsPerMl' } });
    expect(counted.parameters.filter(p => p.source.kind === 'actual').map(p => p.label)).toEqual(['计数 1', '计数 2', '计数 3', '计数 4', '活率']);

    const plating = newCalculation('seeding', { parameters: counted.parameters }, newId);
    const suspension = plating.parameters.find(p => p.id === plating.resultId)!;
    expect(suspension.source).toMatchObject({ kind: 'calculator', calculatorId: 'seeding', output: 'stockVolumeMl', inputs: { stockCellsPerMl: countResult.id } });
    const medium = siblingResult(suspension, 'mediumVolumeMl', [...counted.parameters, ...plating.parameters], newId);
    expect(medium).toMatchObject({ created: true, parameter: { label: '培养基', unit: 'mL' } });
    const all = [...counted.parameters, ...plating.parameters, medium.parameter];
    expect(siblingResult(suspension, 'mediumVolumeMl', all, newId)).toMatchObject({ created: false, parameter: { id: medium.parameter.id } });
    expect(calculationGroups(all).map(group => group.results.map(p => p.label))).toEqual([['活细胞浓度'], ['细胞悬液', '培养基']]);
  });
});

describe('A confirmed result stays adopted', () => {
  it('when an input differs only by floating-point rounding, but not when the input really changed', async () => {
    const { calculationReceiptMatches } = await import('./structured-protocol');
    const receipt = (volume: number) => JSON.stringify({ tool: 'seeding', output: 'stockVolumeMl', unit: 'mL', bindings: { volumePerWellUl: 'volume' }, inputs: { volumePerWellUl: volume, volumePerWellUlUnit: 'µL', wells: 24 } });
    expect(calculationReceiptMatches(receipt(500.00000000000006), receipt(500))).toBe(true);
    expect(calculationReceiptMatches(receipt(500), receipt(500.5))).toBe(false);
  });
});
