import { getCalculatorDefinition } from './calculators/catalog';
import type { CalculatorResult } from './calculators/calculator-engine';
import { convert, normalizeUnit, units } from './calculators/quantities';
import { chipAmount } from './protocol-chips';
import type { protocolCalculatorIds, ProtocolSystems } from './protocol-systems-schema';

export type ProtocolCalculatorId = typeof protocolCalculatorIds[number];
/**
 * One input of a calculation chip. `value`: the starting value when inserted; `actual`: measured on the day, so filled in
 * the Run; `optional`: may stay empty. `unitKey`: the calculator takes the chip's unit as a choice (e.g. titer unit).
 */
export type CalculationInput = { key: string; label: string; unit: string; value?: number; actual?: boolean; optional?: boolean; unitKey?: string;
  /** Use this result when the Protocol already has it, e.g. plating from the day's cell count. */
  from?: { calculatorId: ProtocolCalculatorId; output: string } };
export type CalculationOutput = { key: string; label: string; unit: string };
export type ProtocolCalculationSpec = {
  /** `label` and `note` are interface text in English; input and result labels are written into the Protocol's chips (shown through protocolLabelText). */
  label: string; engine: string; inputs: CalculationInput[]; outputs: CalculationOutput[]; note: string;
  /** Request values that are not chips: the calculator mode the chip always uses. */
  fixed?: Record<string, unknown>;
  /** Several chips that the calculator reads as one list, e.g. the four quadrant counts. */
  list?: { key: string; from: string[] };
};

const counts = ['count1', 'count2', 'count3', 'count4'];
/** Calculations a Protocol step can carry; each reuses an existing calculator, never its own formula. */
export const protocolCalculations: Record<ProtocolCalculatorId, ProtocolCalculationSpec> = {
  dilution: { label: 'Dilution', engine: 'dilution', fixed: { mode: 'final' }, note: 'Dilute the stock to the target concentration (C1V1 = C2V2).',
    inputs: [{ key: 'stockConcentration', label: '母液浓度', unit: 'mM' }, { key: 'targetConcentration', label: '目标浓度', unit: 'mM' }, { key: 'finalVolume', label: '终体积', unit: 'µL' }],
    outputs: [{ key: 'stockVolumeUl', label: '母液取液体积', unit: 'µL' }, { key: 'diluentVolume', label: '稀释液加入量', unit: 'µL' }] },
  'fold-dilution': { label: 'Fold dilution', engine: 'fold-dilution', fixed: { mode: 'fold' }, note: 'Make the working solution from a 10× (or other) concentrate.',
    inputs: [{ key: 'stockFold', label: '浓缩倍数', unit: '×', value: 10 }, { key: 'targetFold', label: '目标倍数', unit: '×', value: 1 }, { key: 'finalVolume', label: '终体积', unit: 'mL' }],
    outputs: [{ key: 'stockVolumeUl', label: '浓缩液', unit: 'mL' }, { key: 'diluentVolume', label: '补水', unit: 'mL' }] },
  molarity: { label: 'Solution by weight', engine: 'molarity', fixed: { mode: 'mass' }, note: 'Weigh, dissolve and make up to volume; for a hydrate or salt form, enter that form’s molecular weight.',
    inputs: [{ key: 'molecularWeight', label: '分子量', unit: 'g/mol' }, { key: 'concentrationM', label: '目标浓度', unit: 'mM' }, { key: 'volumeL', label: '定容体积', unit: 'mL' }, { key: 'purityPercent', label: '纯度', unit: '%', value: 100, optional: true }],
    outputs: [{ key: 'massG', label: '称取质量', unit: 'g' }] },
  hemocytometer: { label: 'Cell count', engine: 'hemocytometer', fixed: { countRegion: 'standard' }, list: { key: 'counts', from: counts },
    note: 'Hemocytometer large squares: average cells per square × dilution factor × 10⁴ cells/mL; counting 1–4 squares is enough.',
    inputs: [...counts.map((key, index) => ({ key, label: `计数 ${index + 1}`, unit: 'cells', actual: true, optional: index > 0 })), { key: 'dilutionFactor', label: '稀释倍数', unit: '×', value: 2 }, { key: 'viabilityPercent', label: '活率', unit: '%', actual: true }],
    outputs: [{ key: 'viableCellsPerMl', label: '活细胞浓度', unit: 'cells/mL' }, { key: 'concentrationCellsPerMl', label: '细胞浓度', unit: 'cells/mL' }] },
  seeding: { label: 'Cell seeding', engine: 'seeding', note: 'Make the cell suspension for all wells (overage included), mix, then dispense into each well.',
    inputs: [{ key: 'stockCellsPerMl', label: '活细胞浓度', unit: 'cells/mL', actual: true, from: { calculatorId: 'hemocytometer', output: 'viableCellsPerMl' } }, { key: 'wells', label: '孔数', unit: '孔' }, { key: 'cellsPerWell', label: '每孔细胞数', unit: 'cells' }, { key: 'volumePerWellUl', label: '每孔体积', unit: 'µL' }, { key: 'overagePercent', label: '余量', unit: '%', value: 10 }],
    outputs: [{ key: 'stockVolumeMl', label: '细胞悬液', unit: 'mL' }, { key: 'mediumVolumeMl', label: '培养基', unit: 'mL' }] },
  transfection: { label: 'Transfection mix', engine: 'transfection', fixed: { complexMode: 'combined', replicates: 1 }, note: 'Reagents, diluent and mixing order follow the transfection reagent’s instructions.',
    inputs: [{ key: 'wells', label: '孔数', unit: '孔' }, { key: 'dnaUgPerWell', label: '每孔 DNA', unit: 'µg' }, { key: 'dnaConcentrationUgUl', label: 'DNA 母液浓度', unit: 'ng/µL', actual: true }, { key: 'reagentUlPerUg', label: '每 µg DNA 试剂量', unit: 'µL/µg' }, { key: 'complexVolumeUlPerWell', label: '每孔复合物体积', unit: 'µL' }, { key: 'overagePercent', label: '余量', unit: '%', value: 10 }],
    outputs: [{ key: 'dnaVolumeUl', label: 'DNA 原液', unit: 'µL' }, { key: 'reagentUl', label: '转染试剂', unit: 'µL' }, { key: 'diluentUl', label: '稀释液', unit: 'µL' }] },
  moi: { label: 'Infection MOI', engine: 'moi', note: 'The titer must be a functional titer (TU, IU or PFU); VG cannot be used for MOI.',
    inputs: [{ key: 'cells', label: '细胞数', unit: 'cells' }, { key: 'desiredMoi', label: '目标 MOI', unit: 'MOI' }, { key: 'titer', label: '病毒滴度', unit: 'TU/mL', actual: true, unitKey: 'titerUnit' }],
    outputs: [{ key: 'virusVolumeUl', label: '病毒液', unit: 'µL' }] },
};

/** A result the Run may adopt: exact, or a calculator's stated estimate (MOI's volume is exact; only its infection odds are modelled). */
export const adoptableCalculation = (snapshot: Pick<CalculatorResult, 'status'>) => snapshot.status === 'valid' || snapshot.status === 'estimate';

type Quantity = { value: number; unit: string };
/**
 * The calculator request for a chip's inputs. Units the calculator understands are passed along for it to convert;
 * other values (counts, folds) are converted to the input's own unit first. Missing required inputs are named.
 */
export function calculationRequest(calculatorId: ProtocolCalculatorId, valueOf: (key: string) => Quantity | undefined) {
  const spec = protocolCalculations[calculatorId];
  const fields = getCalculatorDefinition(spec.engine).fields;
  const inputs: Record<string, unknown> = { ...spec.fixed };
  const missing: string[] = [];
  const listed: number[] = [];
  for (const input of spec.inputs) {
    const quantity = valueOf(input.key);
    if (!quantity) { if (!input.optional) missing.push(input.label); continue; }
    if (spec.list?.from.includes(input.key)) { listed.push(convert(quantity.value, quantity.unit, input.unit)); continue; }
    if (input.unitKey) { inputs[input.key] = quantity.value; inputs[input.unitKey] = normalizeUnit(quantity.unit); continue; }
    const field = fields.find(item => item.key === input.key);
    if (field?.unit && units[normalizeUnit(field.unit)]) { inputs[input.key] = quantity.value; inputs[`${input.key}Unit`] = normalizeUnit(quantity.unit); }
    else {
      try { inputs[input.key] = convert(quantity.value, quantity.unit, input.unit); }
      catch { throw new Error(`${input.label}：单位应为 ${input.unit}`); }
    }
  }
  if (missing.length) throw new Error(`请先填写或确认：${missing.join('、')}`);
  if (spec.list) inputs[spec.list.key] = listed.join(',');
  return { calculatorId: spec.engine, inputs };
}

/** Calculator messages name their fields by internal key; say them as the chip's inputs are named. */
export function readableCalculationError(calculatorId: ProtocolCalculatorId, error: unknown) {
  const spec = protocolCalculations[calculatorId];
  let message = error instanceof Error ? error.message : '计算失败';
  for (const input of spec.inputs) message = message.replace(new RegExp(`\\b${input.key}\\b`, 'g'), input.label);
  if (spec.list) message = message.replace(new RegExp(`\\b${spec.list.key}\\b`, 'g'), '计数');
  return message;
}

/** What is wrong with a result chip's calculation settings, said for the chip named `name`. */
export function calculationIssues(calculatorId: ProtocolCalculatorId, output: string, inputs: Record<string, string>, name: string): string[] {
  const spec = protocolCalculations[calculatorId];
  const issues: string[] = [];
  if (!spec.outputs.some(item => item.key === output)) issues.push(`${name}：计算结果的设置无效 / Unknown calculation result`);
  const unknown = Object.keys(inputs).filter(key => !spec.inputs.some(input => input.key === key));
  if (unknown.length) issues.push(`${name}：有 ${unknown.length} 个计算输入的设置无效 / Unknown calculation input`);
  for (const input of spec.inputs) if (!input.optional && !inputs[input.key]) issues.push(`${name}：缺少计算输入“${input.label}” / Missing calculation input`);
  return issues;
}

/**
 * The chips one inserted calculation needs: its inputs, named and with starting values (measured ones are filled in the Run),
 * and the result chip for its first output. Other outputs are added from the chip's editor.
 */
export function newCalculation(calculatorId: ProtocolCalculatorId, systems: Pick<ProtocolSystems, 'parameters'>, newId: (prefix: string) => string) {
  const spec = protocolCalculations[calculatorId];
  const inputs: Record<string, string> = {};
  const parameters: Parameter[] = [];
  for (const input of spec.inputs) {
    const earlier = input.from && [...systems.parameters].reverse().find(p => resultSource(p)?.calculatorId === input.from!.calculatorId && resultSource(p)?.output === input.from!.output);
    if (earlier) { inputs[input.key] = earlier.id; continue; }
    const id = newId('p');
    inputs[input.key] = id;
    parameters.push({ id, label: input.label, unit: input.unit, origin: 'chip', source: input.actual ? { kind: 'actual' } : { kind: 'fixed', value: input.value ?? null, unit: input.unit } });
  }
  const output = spec.outputs[0];
  const result: Parameter = { id: newId('p'), label: output.label, unit: output.unit, origin: 'chip', source: { kind: 'calculator', calculatorId, output: output.key, inputs } };
  return { parameters: [...parameters, result], resultId: result.id };
}

/** Results of one calculation from the same input chips: their inputs change together, and the Run confirms them as one. */
export function computedTogether(a: Parameter, b: Parameter): a is CalculationResult {
  const x = resultSource(a), y = resultSource(b);
  return Boolean(x && y && x.calculatorId === y.calculatorId && JSON.stringify(Object.entries(x.inputs).sort()) === JSON.stringify(Object.entries(y.inputs).sort()));
}

/** The result chips grouped by `computedTogether`, in Protocol order. */
export function calculationGroups(parameters: Parameter[]) {
  const groups: Array<{ source: CalculatorSource; results: Parameter[] }> = [];
  for (const parameter of parameters) {
    const source = resultSource(parameter);
    if (!source) continue;
    const group = groups.find(item => computedTogether(parameter, item.results[0]));
    if (group) group.results.push(parameter); else groups.push({ source, results: [parameter] });
  }
  return groups;
}

/** The result chip for another output of the same calculation, reusing it when the Protocol already has one. */
export function siblingResult(result: Parameter, output: string, parameters: Parameter[], newId: (prefix: string) => string): { parameter: Parameter; created: boolean } {
  const source = resultSource(result)!;
  const existing = parameters.find(p => resultSource(p)?.output === output && computedTogether(p, result));
  if (existing) return { parameter: existing, created: false };
  const spec = protocolCalculations[source.calculatorId].outputs.find(item => item.key === output)!;
  return { parameter: { id: newId('p'), label: spec.label, unit: spec.unit, origin: 'chip', source: { ...source, output } }, created: true };
}

/** "母液浓度 100 µM；目标浓度 10 µM；终体积 100 µL": what a confirmed calculation used, in the chip's words. */
export function calculationInputSummary(calculatorId: ProtocolCalculatorId, rawInputs: Record<string, unknown>) {
  const spec = protocolCalculations[calculatorId];
  const parts = spec.inputs.filter(input => !spec.list?.from.includes(input.key) && rawInputs[input.key] !== undefined).map(input => {
    const value = Number(rawInputs[input.key]), unit = String(rawInputs[input.unitKey ?? `${input.key}Unit`] ?? input.unit);
    return `${input.label} ${Number.isFinite(value) ? chipAmount(value, unit) : `${rawInputs[input.key]} ${unit}`}`;
  });
  if (spec.list && rawInputs[spec.list.key]) parts.unshift(`计数 ${rawInputs[spec.list.key]}`);
  return parts.join('；');
}

type Parameter = ProtocolSystems['parameters'][number];
type CalculatorSource = Extract<Parameter['source'], { kind: 'calculator' }>;
type CalculationResult = Parameter & { source: CalculatorSource };
function resultSource(parameter: Parameter) {
  return parameter.source.kind === 'calculator' ? parameter.source : undefined;
}
