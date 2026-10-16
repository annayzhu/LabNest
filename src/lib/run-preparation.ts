import { convert, normalizeUnit, units } from './calculators/quantities';
import { calculationGroups } from './protocol-calculations';
import { chipAmount, parameterLongName, toolSpecs } from './protocol-chips';
import { mixQuantityLabel, mixTitle, runQuantityLabels } from './protocol-mix';
import { consumptionAmount, consumptionRecorded, matchStock, runConsumption } from './run-consumption';
import { mixState, stepMixes, stepVersion, type ExecutionPlan, type StructuredRunView } from './structured-run';

export type PreparationKind = 'material' | 'mix' | 'plate' | 'equipment' | 'timer';
export type PreparationItem = { key: string; kind: PreparationKind; label: string; detail?: string; warning?: string; badge?: string; stepId?: string };
export type PreparationState = ExecutionPlan['preparation'][string];
export type PreparationChecklist = {
  /** What to have ready, in bench order: materials, mix cards, plates, equipment, timers. Each can be ticked "已备". */
  items: PreparationItem[];
  /** What still stops the run or its quantities: an unconfirmed system, a missing 本次数量, a calculation not yet confirmed, stock short. */
  warnings: string[];
  /** Values the Protocol asks to be recorded while executing; nothing to prepare, good to know before starting. */
  reminders: string[];
};
export const preparationKindLabels: Record<PreparationKind, string> = { material: '材料与用量', mix: '配液卡', plate: '孔板布局', equipment: '设备准备', timer: '计时' };

type PlateAttachment = { id: string; name: string };
export type PreparationStock = { name: string; unit: string; currentQuantity: number; quantityRecorded: boolean };
type Options = { plates?: PlateAttachment[]; stock?: PreparationStock[]; recorded?: Array<{ source: string }> };

const stepLabel = (step: StructuredRunView['steps'][string]) => `第 ${step.order} 步`;
const isTime = (unit: string) => units[normalizeUnit(unit)]?.dimension === 'time';
/** "10 min", "1 h 30 min", "45 s". */
export const formatDuration = (seconds: number) => {
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60;
  return [h ? `${h} h` : '', m ? `${m} min` : '', s || (!h && !m) ? `${s} s` : ''].filter(Boolean).join(' ');
};
/** Whether the stock holds less than this run's expected use; false when the two cannot be compared. */
const isShort = (expected: number, unit: string, item: PreparationStock) => {
  if (!item.quantityRecorded) return false;
  const same = normalizeUnit(unit) === normalizeUnit(item.unit) || units[normalizeUnit(unit)]?.dimension === units[normalizeUnit(item.unit)]?.dimension;
  if (!same) return false;
  try { return convert(expected, unit, item.unit) > item.currentQuantity; } catch { return false; }
};

/** What the tool's values mean on the bench: a centrifuge is pre-cooled, an incubator pre-warmed; the rest just list their settings. */
function equipmentDetail(kind: keyof typeof toolSpecs, values: Array<{ key: string; text: string }>) {
  const temperature = values.find(value => value.key === 'temperature')?.text;
  const rest = values.filter(value => value.key !== 'temperature').map(value => value.text).join(' · ');
  if (kind === 'centrifuge' && temperature) return `预冷至 ${temperature}${rest ? ` · ${rest}` : ''}`;
  if (kind === 'incubate' && temperature) return `预热至 ${temperature}${rest ? ` · ${rest}` : ''}`;
  const settings = values.map(value => value.text).join(' · ');
  if (kind === 'gas') return settings ? `设定 ${settings}` : '';
  return settings;
}

/**
 * 实验准备清单: everything this run needs ready before the bench, derived from the frozen Protocols, the confirmed plan
 * and 本次数量, so it is never stored and never drifts. Materials come from the same sums as the usage dialog.
 */
export function preparationChecklist(run: Pick<StructuredRunView, 'steps' | 'plan' | 'versions'>, options: Options = {}): PreparationChecklist {
  const items: PreparationItem[] = [], warnings: string[] = [], reminders: string[] = [];
  const steps = Object.entries(run.steps).filter(([id, step]) => step.applicability !== 'not-applicable' && !run.plan.skips[id]).sort((a, b) => a[1].order - b[1].order);
  // A shared-preparation step belongs to every group: its version is the first group's, as stepVersion resolves it.
  const versionOf = (stepId: string) => stepVersion(run, stepId);
  for (const version of run.versions) {
    const adopted = run.plan.versions[version.id], systems = version.document.systems;
    const name = version.groupLabel ? `${version.groupLabel} · ${version.title}` : version.title;
    if (!adopted && systems?.dimensions.length) warnings.push(`尚未确认本次体系：${name}`);
    // A draft generated from a search still carries what the method card could not verify.
    if (version.document.provenance?.design?.unverified) warnings.push(`${name} 由方案设计生成，方法卡有 ${version.document.provenance.design.unverified} 条未核实，请先核对原文`);
    for (const label of runQuantityLabels(version.document)) if (run.plan.quantities[version.id]?.[label] === undefined) warnings.push(`尚未填写${label}：${name}`);
    if (!systems) continue;
    const used = new Set(steps.filter(([id]) => versionOf(id)?.id === version.id).flatMap(([, step]) => step.chipIds ?? []));
    for (const group of calculationGroups(systems.parameters)) {
      const result = group.results.find(item => used.has(item.id)) ?? group.results[0];
      if (!used.has(result.id) || adopted?.calculations[result.id]) continue;
      const step = steps.find(([id, item]) => versionOf(id)?.id === version.id && item.chipIds?.includes(result.id))?.[1];
      warnings.push(`计算待确认：${parameterLongName(result, systems)}${step ? `（${stepLabel(step)}）` : ''}`);
    }
  }
  // Materials: the run's expected use, summed over mix cards and material-linked chips.
  for (const line of runConsumption(run, stepLabel)) {
    const stock = options.stock ? matchStock(line.name, options.stock) : undefined;
    const amount = consumptionAmount(line);
    // The stock on hand, when it is short of this run's expected use.
    const short = stock && line.expected !== undefined && isShort(line.expected, line.unit, stock) ? chipAmount(Number(stock.currentQuantity.toPrecision(6)), stock.unit) : undefined;
    items.push({ key: `material:${line.key}`, kind: 'material', label: line.name, detail: `${amount} · ${line.sources.join('；')}`,
      ...(line.expected === undefined ? { warning: amount } : short !== undefined ? { warning: `库存 ${short}，不足本次用量` } : {}),
      ...(options.recorded && consumptionRecorded(line, options.recorded) ? { badge: '已记录' } : {}) });
    if (short !== undefined) warnings.push(`库存不足：${line.name}（库存 ${short}，本次约需 ${amount}）`);
  }
  for (const [stepId, step] of steps) for (const mix of stepMixes(run, stepId)) {
    const state = mixState(run, stepId, mix), label = mixQuantityLabel(mix);
    const quantity = state.quantity === undefined ? `未填写${label}` : `${state.quantity} ${label}`;
    items.push({ key: `mix:${stepId}:${mix.id}`, kind: 'mix', stepId, label: `${mixTitle(mix)} · ${stepLabel(step)}`, detail: `${quantity} · ${state.current && state.receipt ? '已确认' : '待确认'}`, ...(state.quantity === undefined ? { warning: quantity } : {}) });
  }
  for (const plate of options.plates ?? []) items.push({ key: `plate:${plate.id}`, kind: 'plate', label: plate.name, detail: '孔板布局附件' });
  // Equipment: each tool a step uses, with this run's settings.
  for (const version of run.versions) {
    const systems = version.document.systems;
    for (const tool of systems?.tools ?? []) {
      const using = steps.filter(([id, step]) => versionOf(id)?.id === version.id && (step.chipIds?.includes(tool.id) || tool.fields.some(field => step.chipIds?.includes(field.parameterId))));
      if (!using.length) continue;
      const spec = toolSpecs[tool.kind];
      const values = tool.fields.flatMap(field => { const resolved = version.parameters[field.parameterId]; const label = spec.fields.find(item => item.key === field.key)?.label ?? field.key;
        return resolved?.status === 'resolved' && resolved.value !== undefined && resolved.value !== null ? [{ key: field.key, text: chipAmount(resolved.value, resolved.unit) }] : [{ key: field.key, text: `${label}待定` }]; });
      items.push({ key: `equipment:${version.id}:${tool.id}`, kind: 'equipment', label: `${spec.label}${tool.method?.trim() ? ` · ${tool.method.trim()}` : ''}`, detail: [equipmentDetail(tool.kind, values), using.map(([, step]) => stepLabel(step)).join('、')].filter(Boolean).join(' · ') });
    }
  }
  // Timers: a step's rule timer, else every time chip it holds (each can start the countdown).
  for (const [stepId, step] of steps) {
    const version = versionOf(stepId), systems = version?.document.systems;
    const chips = (step.chipIds ?? []).flatMap(id => { const parameter = systems?.parameters.find(p => p.id === id); return parameter && isTime(parameter.unit) && version?.parameters[id]?.status === 'resolved' ? [parameter] : []; });
    const durations = step.timerDurationSeconds ? [formatDuration(step.timerDurationSeconds)] : chips.map(p => { const resolved = version!.parameters[p.id]; return formatDuration(Math.round(convert(resolved.value!, resolved.unit, 's'))); });
    if (durations.length) items.push({ key: `timer:${stepId}`, kind: 'timer', stepId, label: stepLabel(step), detail: durations.join(' · ') });
    for (const field of step.actualFields) if (field.required && !run.plan.actualValues[stepId]?.[field.id]) reminders.push(`执行时必填：${stepLabel(step)} · ${field.label}`);
    // 执行时填写 values (actual-source chips) are entered at the step; until then the step waits.
    for (const id of step.chipIds ?? []) { const parameter = systems?.parameters.find(p => p.id === id); if (parameter?.source.kind === 'actual' && version && !run.plan.versions[version.id]?.actualInputs[id]) reminders.push(`执行时填写：${stepLabel(step)} · ${parameterLongName(parameter, systems!)}`); }
  }
  return { items, warnings, reminders };
}

/** Ticked items over all items; the list changes with the plan, the ticks follow their keys. */
export function preparationProgress(items: PreparationItem[], state: ExecutionPlan['preparation']) {
  const done = items.filter(item => state[item.key]?.done).length;
  return { done, total: items.length, pending: items.filter(item => !state[item.key]?.done) };
}
