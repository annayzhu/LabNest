import { convert, normalizeUnit, units } from './calculators/quantities';
import { protocolSystemsSchema, type ProtocolCondition, type ProtocolSystems } from './protocol-systems-schema';
import type { ProtocolContentBlock, ProtocolDocument } from './protocol-document';
import { executionBlockText, projectProtocolExecution } from './protocol-execution';
import { calculate, type CalculatorResult } from './calculators/calculator-engine';
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

export function validateProtocolSystems(systems: ProtocolSystems): ProtocolSystemResolution['issues'] {
  const issues: ProtocolSystemResolution['issues'] = [];
  const add = (code: string, targetId: string, message: string) => issues.push({ code, targetId, message });
  const unique = (ids: string[]) => ids.forEach((id, index) => { if (ids.indexOf(id) !== index) add('duplicate-id', id, `重复标识：${id} / Duplicate identifier`); });
  unique(systems.dimensions.map(d => d.id)); unique(systems.parameters.map(p => p.id)); unique(systems.rules.map(r => r.id));
  systems.dimensions.forEach(d => unique(d.options.map(o => o.id)));
  const condition = (when: ProtocolCondition, targetId: string) => {
    for (const predicate of [...(when.all ?? []), ...(when.any ?? []), ...(when.not ?? [])]) {
      if (!systems.dimensions.find(d => d.id === predicate.dimensionId)?.options.some(o => o.id === predicate.optionId)) add('invalid-reference', targetId, `条件引用不存在：${predicate.dimensionId}/${predicate.optionId}`);
    }
  };
  for (const parameter of systems.parameters) {
    if (parameter.source.kind === 'lookup') { unique(parameter.source.values.map(v => v.id)); parameter.source.values.forEach(v => condition(v.when, parameter.id)); }
    if (parameter.source.kind === 'calculator') for (const id of Object.values(parameter.source.inputs)) {
      if (!systems.parameters.some(p => p.id === id)) add('invalid-reference', parameter.id, `计算输入引用不存在：${id}`);
    }
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
    for (const id of [...rule.parameterIds, ...(rule.timerParameterId ? [rule.timerParameterId] : [])]) if (!systems.parameters.some(p => p.id === id)) add('invalid-reference', rule.id, `参数引用不存在：${id}`);
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
    if (!systems.dimensions.find(d => d.id === key)?.options.some(o => o.id === value)) issue('invalid-selection', key, `无效选择：${key} / Invalid selection`);
  }
  for (const restriction of systems.restrictions) if (evaluateProtocolCondition(restriction.when, selections) === 'applicable') issue('illegal-combination', restriction.id, restriction.message);
  for (const parameter of systems.parameters) {
    const { source } = parameter;
    if (source.kind === 'calculator') continue;
    let candidate: { value: number; unit: string; id?: string } | undefined;
    let resolved: ResolvedProtocolParameter = { status: 'unknown', unit: parameter.unit };
    if (source.kind === 'fixed') candidate = source;
    if (source.kind === 'actual') candidate = actualValues[parameter.id];
    if (source.kind === 'lookup') {
      const matched = source.values.filter(row => evaluateProtocolCondition(row.when, selections) === 'applicable');
      const unresolved = source.values.some(row => evaluateProtocolCondition(row.when, selections) === 'unknown');
      if (matched.length > 1) resolved = { ...resolved, status: 'conflict', message: `${parameter.label}：多条规则同时匹配 / Multiple matching values` };
      else if (unresolved) resolved.message = `${parameter.label}：条件待确定 / Conditions incomplete`;
      else if (matched.length === 1) candidate = matched[0];
      else resolved.message = `${parameter.label}：没有适用值 / Missing value`;
    }
    if (candidate) {
      try { resolved = { status: 'resolved', value: convert(candidate.value, candidate.unit, parameter.unit), unit: normalizeUnit(parameter.unit), sourceId: candidate.id ?? source.kind }; }
      catch { resolved = { ...resolved, status: 'invalid', message: `${parameter.label}：单位不兼容 / Incompatible units` }; }
    }
    if (!units[normalizeUnit(parameter.unit)]) resolved = { ...resolved, status: 'invalid', message: `${parameter.label}：未知单位 / Unknown unit` };
    result.parameters[parameter.id] = resolved;
    if (resolved.status !== 'resolved') issue(`parameter-${resolved.status}`, parameter.id, resolved.message ?? `${parameter.label}：待填写 / Required value`);
  }
  const remaining = systems.parameters.filter(p => p.source.kind === 'calculator');
  for (let pass = 0; pass < systems.parameters.length && remaining.length; pass++) {
    for (const parameter of [...remaining]) {
      if (parameter.source.kind !== 'calculator') continue;
      if (Object.values(parameter.source.inputs).some(id => !result.parameters[id])) continue;
      remaining.splice(remaining.indexOf(parameter), 1);
      let resolved: ResolvedProtocolParameter = { status: 'unknown', unit: parameter.unit, message: `${parameter.label}：输入待确定 / Inputs incomplete` };
      if (Object.values(parameter.source.inputs).every(id => result.parameters[id]?.status === 'resolved')) {
        try {
          const preview = previewProtocolCalculation(parameter, result.parameters);
          const receipt = calculations[parameter.id];
          // Recompute for validation, but never adopt a new result without its matching confirmation.
          resolved = receipt?.confirmedAt && receipt.fingerprint === preview.fingerprint
            ? { status: 'resolved', value: preview.value, unit: preview.unit, sourceId: `${preview.snapshot.calculatorId}:${preview.snapshot.methodVersion}` }
            : { ...resolved, message: `${parameter.label}：需重新计算并确认 / Recalculate and confirm` };
        } catch (error) { resolved = { ...resolved, status: 'invalid', message: `${parameter.label}：${error instanceof Error ? error.message : '计算失败'}` }; }
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

/** Typed adapter to the existing engine. No formula or independent unit system lives here. */
export function previewProtocolCalculation(parameter: ProtocolSystems['parameters'][number], parameters: ProtocolSystemResolution['parameters']): Omit<ProtocolCalculation, 'confirmedAt'> {
  if (parameter.source.kind !== 'calculator') throw new Error('此参数不是计算来源');
  const inputs: Record<string, unknown> = { mode: 'final' };
  for (const [key, id] of Object.entries(parameter.source.inputs)) {
    const input = parameters[id];
    if (input?.status !== 'resolved') throw new Error('请先填写全部计算输入');
    inputs[key] = input.value; inputs[`${key}Unit`] = input.unit;
  }
  const snapshot = calculate({ calculatorId: parameter.source.calculatorId, inputs });
  if (snapshot.status !== 'valid') throw new Error('计算结果无效，不能采用');
  const output = snapshot.outputMap[parameter.source.output];
  if (typeof output !== 'number' || !Number.isFinite(output)) throw new Error('计算器没有返回有效体积');
  const outputKey = parameter.source.output;
  const outputUnit = snapshot.outputs.find(item => item.key === outputKey)?.unit;
  if (!outputUnit) throw new Error('计算输出缺少单位');
  const value = convert(output, outputUnit, parameter.unit);
  const fingerprint = JSON.stringify({ tool: snapshot.calculatorId, method: snapshot.methodVersion, inputs, output: parameter.source.output, unit: parameter.unit });
  return { value, unit: parameter.unit, snapshot, fingerprint };
}

const literalKeys = new Set(['id', 'stepId', 'source_ref', 'attachmentId', 'url', 'link', 'filename', 'rowIds', 'execution']);
function mapParameterText<T>(value: T, replace: (id: string) => string, key = ''): T {
  if (literalKeys.has(key)) return value;
  if (typeof value === 'string') return value.replace(/\{\{([\w-]+)\}\}/g, (_, id: string) => replace(id)) as T;
  if (Array.isArray(value)) return value.map(item => mapParameterText(item, replace)) as T;
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, mapParameterText(v, replace, k)])) as T;
  return value;
}

/** Projects a view, never mutates the authored snapshot or reassigns source ownership. */
export function resolveProtocolDocument(document: ProtocolDocument, selections: ProtocolSelection, actualValues: Record<string, { value: number; unit: string }> = {}, calculations: Record<string, ProtocolCalculation> = {}) {
  const systems = document.systems;
  const resolution = systems ? resolveProtocolSystem(systems, selections, actualValues, calculations) : { parameters: {}, rules: {}, issues: [] } as ProtocolSystemResolution;
  const rules = systems?.rules ?? [];
  const state = (target: 'step' | 'block' | 'row', id: string) => conjunction(rules.filter(r => r.target === target && r.targetId === id).map(r => resolution.rules[r.id]));
  const source = projectProtocolExecution(document);
  const known = { step: new Set(source.steps.map(s => s.source_ref)), block: new Set(document.sections.flatMap(s => s.blocks.map(b => b.id))), row: new Set(document.sections.flatMap(s => s.blocks.flatMap(b => b.type === 'table' ? b.rowIds ?? [] : []))) };
  for (const rule of rules) if (!known[rule.target].has(rule.targetId)) resolution.issues.push({ code: 'invalid-reference', targetId: rule.id, message: '条件目标已删除或不存在 / Missing condition target' });
  const globalBlock = resolution.issues.some(i => ['invalid-reference', 'duplicate-id', 'incompatible-unit', 'invalid-selection', 'illegal-combination', 'exclusive-conflict', 'dependency-cycle'].includes(i.code));
  const filterBlock = (block: ProtocolContentBlock): ProtocolContentBlock[] => {
    if (state('block', block.id) === 'not-applicable') return [];
    if (block.type !== 'table') return [block];
    // Keep the header and every cell-format matrix aligned to stable retained rows.
    const retained = block.rows.flatMap((_, index) => index === 0 || state('row', block.rowIds?.[index] ?? '') !== 'not-applicable' ? [index] : []);
    return [{ ...block, rows: retained.map(i => block.rows[i]), ...(block.rowIds ? { rowIds: retained.map(i => block.rowIds![i]) } : {}),
      ...(block.cellColors ? { cellColors: retained.map(i => block.cellColors![i]) } : {}),
      ...(block.cellFontSizesPt ? { cellFontSizesPt: retained.map(i => block.cellFontSizesPt![i]) } : {}),
      ...(block.cellRichContent ? { cellRichContent: retained.map(i => block.cellRichContent![i]) } : {}),
    }];
  };
  const render = <T,>(value: T) => mapParameterText(value, id => {
    const parameter = resolution.parameters[id];
    return parameter?.status === 'resolved' ? `${parameter.value} ${parameter.unit}` : `〔${systems?.parameters.find(p => p.id === id)?.label ?? id}：待确定〕`;
  });
  const steps = source.steps.map(step => {
    const id = step.source_ref!;
    const start = document.sections.flatMap(s => s.blocks).find(b => b.execution?.role === 'step' && (b.execution.stepId ?? b.id) === id);
    const applicability = conjunction([state('step', id), state('block', start?.id ?? '')]);
    const blocks = (step.content_blocks ?? []).flatMap(filterBlock);
    const referenced = new Set(rules.filter(r => r.target === 'step' && r.targetId === id).flatMap(r => [...r.parameterIds, ...(r.timerParameterId ? [r.timerParameterId] : [])]));
    mapParameterText(blocks, key => { referenced.add(key); return key; });
    const unknownContent = blocks.some(b => state('block', b.id) === 'unknown' || b.type === 'table' && b.rowIds?.some(rowId => state('row', rowId) === 'unknown'));
    const blocked = globalBlock || applicability !== 'applicable' || unknownContent || [...referenced].some(key => resolution.parameters[key]?.status !== 'resolved');
    const content_blocks = render(blocks);
    return { ...step, title: render(step.title), content_blocks, description: content_blocks.map(executionBlockText).join('\n'), applicability, blocked,
      optional: rules.some(r => r.target === 'step' && r.targetId === id && r.optional),
      actualFields: rules.filter(r => r.target === 'step' && r.targetId === id).flatMap(r => r.actualFields),
    };
  });
  return { ...resolution, steps, commonBlocks: render(source.commonBlocks.flatMap(filterBlock)), document: { ...document, sections: document.sections.map(s => ({ ...s, blocks: render(s.blocks.flatMap(filterBlock)) })) } };
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
  const parameters = Object.fromEntries(systems.parameters.map(parameter => {
    const { source } = parameter;
    const quantity = (value: number, unit: string) => { try { return `${convert(value, unit, parameter.unit)} ${parameter.unit}`; } catch { return '单位不兼容'; } };
    const text = source.kind === 'actual' ? `${parameter.label}：执行时填写（${parameter.unit}）` : source.kind === 'calculator' ? `${parameter.label}：稀释计算器计算后确认（${parameter.unit}）` : source.kind === 'fixed' ? quantity(source.value, source.unit)
      : source.values.map(v => `${protocolConditionLabel(v.when, systems)} → ${quantity(v.value, v.unit)}`).join(' / ') || `${parameter.label}：缺少取值`;
    return [parameter.id, text];
  }));
  return { ...document, sections: document.sections.map(section => ({ ...section, blocks: section.blocks.map(block => {
    const rendered = mapParameterText(block, id => parameters[id] ?? `〔${id}：引用不存在〕`);
    if (rendered.type !== 'table') return rendered;
    return { ...rendered, rows: rendered.rows.map((row, index) => {
      const labels = systems.rules.filter(r => r.target === 'row' && r.targetId === rendered.rowIds?.[index]).map(r => protocolConditionLabel(r.when, systems));
      return labels.length ? [`${row[0]}〔${labels.join('；')}〕`, ...row.slice(1)] : row;
    }) };
  }) })) };
}

/** Portable presentation uses the same resolver and condition labels as the browser. */
export function allSystemProtocolExportDocument(document: ProtocolDocument): ProtocolDocument {
  const systems = document.systems;
  if (!systems) return document;
  const rendered = allSystemProtocolDocument(document);
  const symbols = ['▲', '■', '●', '◆'];
  return { ...rendered, sections: rendered.sections.map(section => ({ ...section, blocks: [
    ...(section.key === 'description' ? [{ id: 'system-export-legend', type: 'text' as const, text: `通用规程 · 全部体系（不是本次执行记录）\n${systems.dimensions.map(d => `${d.label}：${d.options.map((o, i) => `${symbols[i % symbols.length]} ${o.label}`).join('；')}`).join('\n')}` }] : []),
    ...section.blocks.flatMap(block => {
      const labels = systems.rules.filter(r => r.target === 'block' && r.targetId === block.id || r.target === 'step' && block.execution?.role === 'step' && r.targetId === (block.execution.stepId ?? block.id)).map(r => protocolConditionLabel(r.when, systems));
      return [...(labels.length ? [{ id: `${block.id}-condition-export`, type: 'text' as const, text: `适用条件：${labels.join('；')}` }] : []), block];
    }),
  ] })) };
}
