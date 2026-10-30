import { convert, normalizeUnit, units } from './calculators/quantities';
import { isEmptyTable } from './protocol-document';
import { protocolSystemsSchema, type ProtocolCondition, type ProtocolSystems } from './protocol-systems-schema';
import type { ProtocolContentBlock, ProtocolDocument } from './protocol-document';
import { executionBlockText, projectProtocolExecution } from './protocol-execution';
import { calculate, type CalculatorResult } from './calculators/calculator-engine';
import { adoptableCalculation, calculationRequest, calculationIssues, protocolCalculations, readableCalculationError } from './protocol-calculations';
import { chipParameterIds, filledAtRun, mapChipReferences, optionMarks, parameterDisplayName, parameterLongName, protocolChipText } from './protocol-chips';
export type { ProtocolSystems, ProtocolCondition } from './protocol-systems-schema';

export type Applicability = 'applicable' | 'not-applicable' | 'unknown';
export type ProtocolSelection = Record<string, string>;
export type ProtocolCalculation = { fingerprint: string; value: number; unit: string; snapshot: CalculatorResult; confirmedAt: string };
export type ResolvedProtocolParameter = {
  status: 'resolved' | 'unknown' | 'conflict' | 'invalid';
  value?: number; unit: string; sourceId?: string; message?: string;
};
export type ProtocolSystemResolution = {
  parameters: Record<string, ResolvedProtocolParameter>;
  rules: Record<string, Applicability>;
  issues: Array<{ code: string; targetId: string; message: string }>;
};
/** A value a step records at the bench: one its rules ask for, or (`source: 'chip'`) one of the step's chips. */
export type StepActualField = ProtocolSystems['rules'][number]['actualFields'][number] & { source?: 'chip' };

export function validateProtocolSystems(systems: ProtocolSystems): ProtocolSystemResolution['issues'] {
  const issues: ProtocolSystemResolution['issues'] = [];
  const add = (code: string, targetId: string, message: string) => issues.push({ code, targetId, message });
  const unique = (ids: string[]) => ids.forEach((id, index) => { if (ids.indexOf(id) !== index) add('duplicate-id', id, '体系、参数或条件的内部标识重复，请删除重复项 / Duplicate identifier'); });
  unique(systems.dimensions.map(d => d.id)); unique(systems.parameters.map(p => p.id)); unique(systems.rules.map(r => r.id));
  systems.dimensions.forEach(d => unique(d.options.map(o => o.id)));
  const condition = (when: ProtocolCondition, targetId: string) => {
    for (const predicate of [...(when.all ?? []), ...(when.any ?? []), ...(when.not ?? [])]) {
      if (!systems.dimensions.find(d => d.id === predicate.dimensionId)?.options.some(o => o.id === predicate.optionId)) add('invalid-reference', targetId, '条件引用了已删除的体系或选项 / Condition refers to a removed option');
    }
  };
  for (const parameter of systems.parameters) {
    if (parameter.source.kind === 'lookup') { unique(parameter.source.values.map(v => v.id)); parameter.source.values.forEach(v => condition(v.when, parameter.id)); }
    if (parameter.source.kind === 'calculator') {
      for (const id of Object.values(parameter.source.inputs)) if (!systems.parameters.some(p => p.id === id)) add('invalid-reference', parameter.id, `${parameterDisplayName(parameter)}：计算输入已删除 / Calculation input removed`);
      calculationIssues(parameter.source.calculatorId, parameter.source.output, parameter.source.inputs, parameterDisplayName(parameter)).forEach(message => add('invalid-reference', parameter.id, message));
    }
  }
  for (const tool of systems.tools ?? []) for (const field of tool.fields) {
    if (!systems.parameters.some(p => p.id === field.parameterId)) add('invalid-reference', tool.id, '设备参数块的字段已删除 / Tool field removed');
  }
  const visiting = new Set<string>(), visited = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id)) { add('dependency-cycle', id, '计算参数存在循环依赖 / Cyclic parameter dependency'); return; }
    if (visited.has(id)) return;
    visiting.add(id);
    const parameter = systems.parameters.find(p => p.id === id);
    if (parameter?.source.kind === 'calculator') Object.values(parameter.source.inputs).forEach(visit);
    visiting.delete(id); visited.add(id);
  };
  systems.parameters.forEach(p => visit(p.id));
  for (const rule of systems.rules) {
    condition(rule.when, rule.id);
    for (const id of [...rule.parameterIds, ...(rule.timerParameterId ? [rule.timerParameterId] : [])]) if (!systems.parameters.some(p => p.id === id)) add('invalid-reference', rule.id, '条件绑定的参数已删除 / Condition refers to a removed parameter');
    if (rule.timerParameterId && units[normalizeUnit(systems.parameters.find(p => p.id === rule.timerParameterId)?.unit ?? '')]?.dimension !== 'time') add('incompatible-unit', rule.id, '计时参数必须使用时间单位 / Timer requires a time unit');
  }
  for (const targetId of new Set(systems.rules.filter(r => r.timerParameterId).map(r => r.targetId))) {
    if (new Set(systems.rules.filter(r => r.target === 'step' && r.targetId === targetId).map(r => r.timerParameterId).filter(Boolean)).size > 1) add('invalid-reference', targetId, '同一步骤不能绑定多个计时参数');
  }
  systems.restrictions.forEach(r => condition(r.when, r.id));
  for (const preset of systems.presets) condition({ all: Object.entries(preset.selections).map(([dimensionId, optionId]) => ({ dimensionId, optionId })) }, preset.id);
  return issues;
}

function conjunction(states: Applicability[]): Applicability {
  return states.includes('not-applicable') ? 'not-applicable' : states.includes('unknown') ? 'unknown' : 'applicable';
}
export function evaluateProtocolCondition(when: ProtocolCondition, selections: ProtocolSelection): Applicability {
  const compare = (p: { dimensionId: string; optionId: string }): Applicability => !selections[p.dimensionId] ? 'unknown' : selections[p.dimensionId] === p.optionId ? 'applicable' : 'not-applicable';
  const parts = (when.all ?? []).map(compare);
  if (when.any?.length) {
    const any = when.any.map(compare);
    parts.push(any.includes('applicable') ? 'applicable' : any.includes('unknown') ? 'unknown' : 'not-applicable');
  }
  parts.push(...(when.not ?? []).map(p => { const value = compare(p); return value === 'unknown' ? value : value === 'applicable' ? 'not-applicable' : 'applicable'; }));
  return conjunction(parts);
}

/** Deterministic public boundary shared by previews, execution and output. Never selects a default. */
export function resolveProtocolSystem(input: ProtocolSystems, selections: ProtocolSelection, actualValues: Record<string, { value: number; unit: string }> = {}, calculations: Record<string, ProtocolCalculation> = {}): ProtocolSystemResolution {
  const systems = protocolSystemsSchema.parse(input);
  const result: ProtocolSystemResolution = { parameters: {}, rules: {}, issues: validateProtocolSystems(systems) };
  const issue = (code: string, targetId: string, message: string) => result.issues.push({ code, targetId, message });
  for (const [key, value] of Object.entries(selections)) {
    if (!systems.dimensions.find(d => d.id === key)?.options.some(o => o.id === value)) issue('invalid-selection', key, '选择的体系已不存在，请重新选择 / Invalid selection');
  }
  for (const restriction of systems.restrictions) if (evaluateProtocolCondition(restriction.when, selections) === 'applicable') issue('illegal-combination', restriction.id, restriction.message);
  for (const parameter of systems.parameters) {
    const { source } = parameter;
    if (source.kind === 'calculator') continue;
    let candidate: { value: number; unit: string; id?: string } | undefined;
    const label = parameterDisplayName(parameter);
    let resolved: ResolvedProtocolParameter = { status: 'unknown', unit: parameter.unit };
    if (source.kind === 'fixed' && source.value !== null) candidate = { ...source, value: source.value };
    // A source range without an adopted value is entered at the bench, like "执行时填写".
    if (filledAtRun(parameter)) candidate = actualValues[parameter.id];
    if (source.kind === 'lookup') {
      const matched = source.values.filter(row => evaluateProtocolCondition(row.when, selections) === 'applicable');
      const unresolved = source.values.some(row => evaluateProtocolCondition(row.when, selections) === 'unknown');
      if (matched.length > 1) resolved = { ...resolved, status: 'conflict', message: `${label}：多条规则同时匹配 / Multiple matching values` };
      else if (unresolved) resolved.message = `${label}：条件待确定 / Conditions incomplete`;
      else if (matched.length === 1 && matched[0].value !== null) candidate = { ...matched[0], value: matched[0].value };
      else resolved.message = `${label}：没有适用值 / Missing value`;
    }
    if (candidate) {
      try { resolved = { status: 'resolved', value: convert(candidate.value, candidate.unit, parameter.unit), unit: normalizeUnit(parameter.unit), sourceId: candidate.id ?? source.kind }; }
      catch { resolved = { ...resolved, status: 'invalid', message: `${label}：单位不兼容 / Incompatible units` }; }
    }
    if (!units[normalizeUnit(parameter.unit)]) resolved = { ...resolved, status: 'invalid', message: `${label}：未知单位 / Unknown unit` };
    result.parameters[parameter.id] = resolved;
    if (resolved.status !== 'resolved') issue(`parameter-${resolved.status}`, parameter.id, resolved.message ?? `${label}：待填写 / Required value`);
  }
  const remaining = systems.parameters.filter(p => p.source.kind === 'calculator');
  for (let pass = 0; pass < systems.parameters.length && remaining.length; pass++) {
    for (const parameter of [...remaining]) {
      if (parameter.source.kind !== 'calculator') continue;
      if (Object.values(parameter.source.inputs).some(id => !result.parameters[id])) continue;
      remaining.splice(remaining.indexOf(parameter), 1);
      // Optional inputs (a second count, purity) may stay empty; required ones must be known first.
      const source = parameter.source;
      const waiting = protocolCalculations[source.calculatorId].inputs.filter(input => !input.optional && result.parameters[source.inputs[input.key] ?? '']?.status !== 'resolved').map(input => input.label);
      let resolved: ResolvedProtocolParameter = { status: 'unknown', unit: parameter.unit, message: `${parameterDisplayName(parameter)}：请先填写或确认 ${waiting.join('、')} / Inputs incomplete` };
      if (!waiting.length) {
        try {
          const receipt = calculations[parameter.id];
          const fingerprint = protocolCalculationFingerprint(parameter, result.parameters);
          // Confirmed input/binding snapshots survive calculator code upgrades. Only
          // changed inputs invalidate them; historical adopted values are not recomputed.
          if (receipt?.confirmedAt && calculationReceiptMatches(receipt.fingerprint, fingerprint) && Number.isFinite(receipt.value) && adoptableCalculation(receipt.snapshot)) {
            resolved = { status: 'resolved', value: convert(receipt.value, receipt.unit, parameter.unit), unit: parameter.unit, sourceId: `${receipt.snapshot.calculatorId}:${receipt.snapshot.methodVersion}` };
          } else {
            previewProtocolCalculation(parameter, result.parameters); // Validate the new proposed inputs only.
            resolved = { ...resolved, message: `${parameterDisplayName(parameter)}：需重新计算并确认 / Recalculate and confirm` };
          }
        } catch (error) { resolved = { ...resolved, status: 'invalid', message: `${parameterDisplayName(parameter)}：${error instanceof Error ? error.message : '计算失败'}` }; }
      }
      result.parameters[parameter.id] = resolved;
      if (resolved.status !== 'resolved') issue(`parameter-${resolved.status}`, parameter.id, resolved.message!);
    }
  }
  remaining.forEach(p => { result.parameters[p.id] = { status: 'unknown', unit: p.unit, message: '计算依赖无法解析' }; issue('parameter-unknown', p.id, '计算依赖无法解析'); });
  const exclusive = new Map<string, string[]>();
  for (const rule of systems.rules) {
    let status = evaluateProtocolCondition(rule.when, selections);
    if (status === 'applicable' && rule.parameterIds.some(id => result.parameters[id]?.status !== 'resolved')) status = 'unknown';
    result.rules[rule.id] = status;
    if (status === 'applicable' && rule.exclusiveGroup) exclusive.set(rule.exclusiveGroup, [...(exclusive.get(rule.exclusiveGroup) ?? []), rule.id]);
  }
  for (const [group, ids] of exclusive) if (ids.length > 1) {
    issue('exclusive-conflict', group, '互斥分支同时适用 / Conflicting exclusive branches');
    ids.forEach(id => { result.rules[id] = 'unknown'; });
  }
  if (result.issues.some(i => ['invalid-reference', 'duplicate-id', 'incompatible-unit', 'invalid-selection', 'illegal-combination', 'dependency-cycle'].includes(i.code))) {
    for (const rule of systems.rules) result.rules[rule.id] = 'unknown';
  }
  return result;
}

function protocolCalculationInputs(parameter: ProtocolSystems['parameters'][number], parameters: ProtocolSystemResolution['parameters']) {
  if (parameter.source.kind !== 'calculator') throw new Error('此参数不是计算来源');
  const source = parameter.source;
  return calculationRequest(source.calculatorId, key => { const input = parameters[source.inputs[key] ?? '']; return input?.status === 'resolved' ? { value: input.value!, unit: input.unit } : undefined; }).inputs;
}
export function protocolCalculationFingerprint(parameter: ProtocolSystems['parameters'][number], parameters: ProtocolSystemResolution['parameters']) {
  if (parameter.source.kind !== 'calculator') throw new Error('此参数不是计算来源');
  return JSON.stringify({ tool: parameter.source.calculatorId, inputs: protocolCalculationInputs(parameter, parameters), bindings: Object.fromEntries(Object.entries(parameter.source.inputs).sort(([a], [b]) => a.localeCompare(b))), output: parameter.source.output, unit: parameter.unit });
}
export function calculationReceiptMatches(saved: string, current: string) {
  try {
    const old = JSON.parse(saved), next = JSON.parse(current);
    // Twelve significant figures: unit conversion noise (500.00000000000006 µL) is not a changed input.
    const sorted = (value: Record<string, unknown>) => JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, typeof item === 'number' ? Number(item.toPrecision(12)) : item])));
    return old.tool === next.tool && old.output === next.output && old.unit === next.unit && sorted(old.inputs) === sorted(next.inputs) && (!old.bindings || sorted(old.bindings) === sorted(next.bindings));
  } catch { return false; }
}

/** Typed adapter to the existing engine. No formula or independent unit system lives here. */
export function previewProtocolCalculation(parameter: ProtocolSystems['parameters'][number], parameters: ProtocolSystemResolution['parameters']): Omit<ProtocolCalculation, 'confirmedAt'> {
  if (parameter.source.kind !== 'calculator') throw new Error('此参数不是计算来源');
  const { calculatorId, output: outputKey } = parameter.source;
  const inputs = protocolCalculationInputs(parameter, parameters);
  let snapshot: CalculatorResult;
  try { snapshot = calculate({ calculatorId: protocolCalculations[calculatorId].engine, inputs }); }
  catch (error) { throw new Error(readableCalculationError(calculatorId, error)); }
  if (!adoptableCalculation(snapshot)) throw new Error('计算结果无效，不能采用');
  const output = snapshot.outputMap[outputKey];
  if (typeof output !== 'number' || !Number.isFinite(output)) throw new Error('计算器没有返回有效结果');
  const outputUnit = snapshot.outputs.find(item => item.key === outputKey)?.unit;
  if (!outputUnit) throw new Error('计算输出缺少单位');
  const value = convert(output, outputUnit, parameter.unit);
  const fingerprint = protocolCalculationFingerprint(parameter, parameters);
  return { value, unit: parameter.unit, snapshot, fingerprint };
}

/** Projects a view, never mutates the authored snapshot or reassigns source ownership. */
export function resolveProtocolDocument(document: ProtocolDocument, selections: ProtocolSelection, actualValues: Record<string, { value: number; unit: string }> = {}, calculations: Record<string, ProtocolCalculation> = {}) {
  const systems = document.systems;
  const resolution = systems ? resolveProtocolSystem(systems, selections, actualValues, calculations) : { parameters: {}, rules: {}, issues: [] } as ProtocolSystemResolution;
  const rules = systems?.rules ?? [];
  const state = targetApplicability(systems, resolution.rules);
  const source = projectProtocolExecution(document);
  const known = { step: new Set(source.steps.map(s => s.source_ref)), block: new Set(document.sections.flatMap(s => s.blocks.map(b => b.id))), row: new Set(document.sections.flatMap(s => s.blocks.flatMap(b => b.type === 'table' ? b.rowIds ?? [] : []))) };
  for (const rule of rules) if (!known[rule.target].has(rule.targetId)) resolution.issues.push({ code: 'invalid-reference', targetId: rule.id, message: '条件目标已删除或不存在 / Missing condition target' });
  const globalBlock = resolution.issues.some(i => ['invalid-reference', 'duplicate-id', 'incompatible-unit', 'invalid-selection', 'illegal-combination', 'exclusive-conflict', 'dependency-cycle'].includes(i.code));
  const filterBlock = (source: ProtocolContentBlock): ProtocolContentBlock[] => {
    if (state('block', source.id) === 'not-applicable') return [];
    // An empty recipe table has nothing to execute (the editor still shows it).
    return [source.type === 'table' ? tableForSelection(source, state, selections) : source].filter(block => !isEmptyTable(block));
  };
  const render = <T,>(value: T) => mapChipReferences(value, id => protocolChipText(id, systems, resolution.parameters));
  const steps = source.steps.map(step => {
    const id = step.source_ref!;
    const start = document.sections.flatMap(s => s.blocks).find(b => b.execution?.role === 'step' && (b.execution.stepId ?? b.id) === id);
    const applicability = conjunction([state('step', id), state('block', start?.id ?? '')]);
    const blocks = (step.content_blocks ?? []).flatMap(filterBlock);
    const stepRules = rules.filter(r => r.target === 'step' && r.targetId === id);
    const referenced = new Set(stepRules.flatMap(r => [...r.parameterIds, ...(r.timerParameterId ? [r.timerParameterId] : [])]));
    mapChipReferences([step.title, ...blocks], key => { chipParameterIds(key, systems).forEach(id => referenced.add(id)); return key; });
    const unknownContent = blocks.some(b => state('block', b.id) === 'unknown' || b.type === 'table' && b.rowIds?.some(rowId => state('row', rowId) === 'unknown'));
    const unresolved = [...referenced].filter(key => resolution.parameters[key]?.status !== 'resolved');
    const blocked = globalBlock || applicability !== 'applicable' || unknownContent || unresolved.length > 0;
    // Waiting only for values entered at the bench (执行时填写, an unfixed source range): the step itself asks for them.
    const awaitingInput = !globalBlock && applicability === 'applicable' && !unknownContent && unresolved.length > 0 && unresolved.every(key => { const parameter = systems?.parameters.find(p => p.id === key); return parameter && filledAtRun(parameter); });
    // Every chip in the step can take an actual value; those marked "执行时必填" must. A value filled at execution is an input, not an actual.
    const ruleFields = stepRules.flatMap(r => r.actualFields);
    const chipFields = [...referenced].flatMap(key => { const parameter = systems?.parameters.find(p => p.id === key); return parameter && !filledAtRun(parameter) && !ruleFields.some(f => f.id === key) ? [{ id: key, label: parameterLongName(parameter, systems!), unit: parameter.unit, required: parameter.actual === 'required', source: 'chip' as const }] : []; });
    const content_blocks = render(blocks);
    // `source_blocks` keep chip references for interface rendering; `content_blocks` are plain reading text.
    return { ...step, title: render(step.title), content_blocks, source_blocks: blocks, description: content_blocks.map(executionBlockText).join('\n'), applicability, blocked, ...(awaitingInput ? { awaitingInput } : {}),
      optional: stepRules.some(r => r.optional),
      actualFields: [...ruleFields, ...chipFields] as StepActualField[],
      chipIds: [...referenced],
    };
  });
  return { ...resolution, steps, commonBlocks: render(source.commonBlocks.flatMap(filterBlock)), notePlacement: source.notePlacement, document: { ...document, sections: document.sections.map(s => ({ ...s, blocks: render(s.blocks.flatMap(filterBlock)) })) } };
}

/** Applicability of a step, block or table row from its rules; content without rules is common. */
export function targetApplicability(systems: ProtocolSystems | undefined, ruleStates: Record<string, Applicability>) {
  return (target: 'step' | 'block' | 'row', id: string) => conjunction((systems?.rules ?? []).filter(r => r.target === target && r.targetId === id).map(r => ruleStates[r.id]));
}

/** A table as one selection reads it: header kept, inapplicable rows and system columns removed, formats aligned. */
export function tableForSelection(source: Extract<ProtocolContentBlock, { type: 'table' }>, state: ReturnType<typeof targetApplicability>, selections: ProtocolSelection): typeof source {
  const block = applicableColumns(source, selections);
  const retained = block.rows.flatMap((_, index) => index === 0 || state('row', block.rowIds?.[index] ?? '') !== 'not-applicable' ? [index] : []);
  return { ...block, rows: retained.map(i => block.rows[i]), ...(block.rowIds ? { rowIds: retained.map(i => block.rowIds![i]) } : {}),
    ...(block.cellColors ? { cellColors: retained.map(i => block.cellColors![i]) } : {}),
    ...(block.cellFontSizesPt ? { cellFontSizesPt: retained.map(i => block.cellFontSizesPt![i]) } : {}),
    ...(block.cellRichContent ? { cellRichContent: retained.map(i => block.cellRichContent![i]) } : {}),
  };
}

/** Keep a recipe table's common columns and the columns of the chosen (or still pending) system. */
function applicableColumns(block: Extract<ProtocolContentBlock, { type: 'table' }>, selections: ProtocolSelection): typeof block {
  const conditions = block.columnConditions;
  if (!conditions?.some(Boolean)) return block;
  const pick = <T,>(row: T[]) => row.filter((_, index) => !conditions[index] || evaluateProtocolCondition({ all: [conditions[index]!] }, selections) !== 'not-applicable');
  return { ...block, rows: block.rows.map(pick), columnConditions: pick(conditions),
    ...(block.columnWidths ? { columnWidths: pick(block.columnWidths) } : {}),
    ...(block.cellFontSizesPt ? { cellFontSizesPt: block.cellFontSizesPt.map(pick) } : {}),
    ...(block.cellColors ? { cellColors: block.cellColors.map(pick) } : {}),
    ...(block.cellRichContent ? { cellRichContent: block.cellRichContent.map(pick) } : {}) };
}

export function protocolConditionLabel(when: ProtocolCondition, systems: ProtocolSystems): string {
  const label = (p: { dimensionId: string; optionId: string }) => {
    const dimension = systems.dimensions.find(d => d.id === p.dimensionId);
    return `${dimension?.label ?? p.dimensionId}：${dimension?.options.find(o => o.id === p.optionId)?.label ?? p.optionId}`;
  };
  return [(when.all ?? []).map(label).join(' 且 '), (when.any ?? []).map(label).join(' 或 '), (when.not ?? []).map(p => `非（${label(p)}）`).join(' 且 ')].filter(Boolean).join('；') || '通用';
}

/** An all-system reading/export view: common prose once, all explicit alternatives inline. */
export function allSystemProtocolDocument(document: ProtocolDocument): ProtocolDocument {
  const systems = document.systems;
  if (!systems) return document;
  return { ...document, sections: document.sections.map(section => ({ ...section, blocks: section.blocks.map(block => {
    const chipped = mapChipReferences(block, id => protocolChipText(id, systems));
    if (chipped.type !== 'table') return chipped;
    const marks = optionMarks(systems);
    const header = (text: string, index: number) => { const column = chipped.columnConditions?.[index]; const mark = column && marks.get(`${column.dimensionId}:${column.optionId}`); return !mark ? text : mark.glyph ? `${mark.glyph} ${text}` : `${text}（${mark.label}）`; };
    const rendered = chipped.columnConditions?.some(Boolean) ? { ...chipped, rows: chipped.rows.map((row, index) => index ? row : row.map(header)),
      ...(chipped.cellRichContent?.[0] ? { cellRichContent: chipped.cellRichContent.map((row, index) => index ? row : row.map((cell, column) => cell && chipped.columnConditions?.[column] ? [{ type: 'paragraph', content: [{ type: 'text', text: header('', column).trim() }] }, ...cell] : cell)) } : {}) } : chipped;
    const rowLabel = (index: number) => systems.rules.filter(r => r.target === 'row' && r.targetId === rendered.rowIds?.[index]).map(r => protocolConditionLabel(r.when, systems)).join('；');
    return { ...rendered, rows: rendered.rows.map((row, index) => rowLabel(index) ? [`${row[0]}〔${rowLabel(index)}〕`, ...row.slice(1)] : row),
      ...(rendered.cellRichContent ? { cellRichContent: rendered.cellRichContent.map((row, index) => rowLabel(index) && row[0] ? [[...row[0], { type: 'paragraph', content: [{ type: 'text', text: `〔${rowLabel(index)}〕` }] }], ...row.slice(1)] : row) } : {}),
    };
  }) })) };
}

/** Portable presentation uses the same resolver and condition labels as the browser. */
export function allSystemProtocolExportDocument(document: ProtocolDocument): ProtocolDocument {
  const systems = document.systems;
  if (!systems) return document;
  const rendered = allSystemProtocolDocument(document);
  const marks = optionMarks(systems);
  return { ...rendered, sections: rendered.sections.map(section => ({ ...section, blocks: [
    ...(section.key === 'description' ? [{ id: 'system-export-legend', type: 'text' as const, text: `通用规程 · 全部体系（不是本次执行记录）\n${systems.dimensions.map(d => `${d.label}：${d.options.map(o => [marks.get(`${d.id}:${o.id}`)?.glyph, o.label].filter(Boolean).join(' ')).join('；')}`).join('\n')}` }] : []),
    ...section.blocks.flatMap(block => {
      const labels = systems.rules.filter(r => r.target === 'block' && r.targetId === block.id || r.target === 'step' && block.execution?.role === 'step' && r.targetId === (block.execution.stepId ?? block.id)).map(r => protocolConditionLabel(r.when, systems));
      return [...(labels.length ? [{ id: `${block.id}-condition-export`, type: 'text' as const, text: `适用条件：${labels.join('；')}` }] : []), block];
    }),
  ] })) };
}
