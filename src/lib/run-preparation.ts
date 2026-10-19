import { compatibleUnits, convert, normalizeUnit, units } from './calculators/quantities';
import { toolFieldNamesZh } from './i18n';
import { calculationGroups } from './protocol-calculations';
import { chipAmount, parameterLongName, toolSpecs, type ToolKind } from './protocol-chips';
import { mixQuantityLabel, mixTitle, runQuantityLabels, runQuantityLabelText, runQuantityText } from './protocol-mix';
import { consumptionAmount, consumptionRecorded, matchStock, runConsumption } from './run-consumption';
import { mixState, stepMixes, stepVersion, type ExecutionPlan, type StructuredRunView } from './structured-run';

export type PreparationKind = 'material' | 'mix' | 'plate' | 'equipment' | 'timer';
export type PreparationItem = { key: string; kind: PreparationKind; label: string; detail?: string; warning?: string; badge?: string; stepId?: string };
export type PreparationState = ExecutionPlan['preparation'][string];
export type PreparationChecklist = {
  /** What to have ready, in bench order: materials, mix cards, plates, equipment, timers. Each can be ticked ready. */
  items: PreparationItem[];
  /** What still stops the run or its quantities: an unconfirmed system, a missing 本次数量, a calculation not yet confirmed, stock short. */
  warnings: string[];
  /** Values the Protocol asks to be recorded while executing; nothing to prepare, good to know before starting. */
  reminders: string[];
};
export const preparationKindLabels: Record<PreparationKind, string> = { material: 'Materials and amounts', mix: 'Mix cards', plate: 'Plate layouts', equipment: 'Equipment setup', timer: 'Timers' };
// The checklist's text is English; the Chinese interface translates it (translateDynamic in i18n.ts), names and codes untouched.
const equipmentNames: Record<ToolKind, string> = { centrifuge: 'Centrifuge', mix: 'Mix', incubate: 'Incubate', shake: 'Shaker', vacuum: 'Vacuum', electrophoresis: 'Electrophoresis', electroporation: 'Electroporation', gas: 'Gas', dark: 'Protect from light', gradient: 'Gradient' };
/** A tool field still open, named in English by its toolSpecs label. */
const toolFieldNames = Object.fromEntries(Object.entries(toolFieldNamesZh).map(([english, chinese]) => [chinese, english]));

type PlateAttachment = { id: string; name: string };
export type PreparationStock = { name: string; unit: string; currentQuantity: number; quantityRecorded: boolean };
type Options = { plates?: PlateAttachment[]; stock?: PreparationStock[]; recorded?: Array<{ source: string }> };

const isTime = (unit: string) => units[normalizeUnit(unit)]?.dimension === 'time';
/** "10 min", "1 h 30 min", "45 s". */
export const formatDuration = (seconds: number) => {
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60;
  return [h ? `${h} h` : '', m ? `${m} min` : '', s || (!h && !m) ? `${s} s` : ''].filter(Boolean).join(' ');
};
/** The unit 1000 times larger in the same material scale (µL → mL, mg → g, nmol → µmol); none past the largest. */
const largerUnit = (unit: string) => {
  const from = units[normalizeUnit(unit)];
  return from && ['volume', 'mass', 'amount'].includes(from.dimension) ? compatibleUnits(unit).find(key => Math.abs(units[key].factor / from.factor / 1000 - 1) < 1e-9) : undefined;
};
/** An amount as the bench reads it: from 1000 on in the next larger unit (2000 µL → 2 mL); the number by the site-wide rule (chipAmount). */
const benchAmount = (value: number, unit: string) => {
  let amount = Number(value.toPrecision(6)), shown = unit;
  for (let larger = largerUnit(shown); larger && Math.abs(amount) >= 1000; larger = largerUnit(shown)) { amount = convert(amount, shown, larger); shown = larger; }
  return chipAmount(amount, shown);
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
  if (kind === 'centrifuge' && temperature) return `Pre-cool to ${temperature}${rest ? ` · ${rest}` : ''}`;
  if (kind === 'incubate' && temperature) return `Pre-warm to ${temperature}${rest ? ` · ${rest}` : ''}`;
  const settings = values.map(value => value.text).join(' · ');
  if (kind === 'gas') return settings ? `Set to ${settings}` : '';
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
  // With several Protocols a bare "Step 3" is ambiguous: the step names its Protocol by code (by title when the snapshot has no code).
  const several = new Set(run.versions.map(version => version.sourceVersionId)).size > 1;
  const stepLabel = (step: StructuredRunView['steps'][string]) => {
    const version = several ? run.versions.find(item => item.id === step.versionId || item.sourceVersionId === step.versionId) : undefined;
    return version ? `${version.code ?? version.title} step ${step.order}` : `Step ${step.order}`;
  };
  for (const version of run.versions) {
    const adopted = run.plan.versions[version.id], systems = version.document.systems;
    const name = version.groupLabel ? `${version.groupLabel} · ${version.title}` : version.title;
    if (!adopted && systems?.dimensions.length) warnings.push(`Systems for this run not confirmed: ${name}`);
    // A draft generated from a search still carries what the method card could not verify.
    if (version.document.provenance?.design?.unverified) warnings.push(`${name} was generated by method design; its method card has ${version.document.provenance.design.unverified} unverified items. Check the original first`);
    if (version.document.provenance?.recognition?.unverified) warnings.push(`${name} was generated by AI from instructions; ${version.document.provenance.recognition.unverified} lines have no source in the original. Check the original first`);
    for (const label of runQuantityLabels(version.document)) if (run.plan.quantities[version.id]?.[label] === undefined) warnings.push(`Run quantity not filled in: ${runQuantityLabelText(label)} · ${name}`);
    if (!systems) continue;
    const used = new Set(steps.filter(([id]) => versionOf(id)?.id === version.id).flatMap(([, step]) => step.chipIds ?? []));
    for (const group of calculationGroups(systems.parameters)) {
      const result = group.results.find(item => used.has(item.id)) ?? group.results[0];
      if (!used.has(result.id) || adopted?.calculations[result.id]) continue;
      const step = steps.find(([id, item]) => versionOf(id)?.id === version.id && item.chipIds?.includes(result.id))?.[1];
      warnings.push(`Calculation to confirm: ${parameterLongName(result, systems)}${step ? ` (${stepLabel(step)})` : ''}`);
    }
  }
  // Materials: the run's expected use, summed over mix cards and material-linked chips.
  for (const line of runConsumption(run, stepLabel)) {
    const stock = options.stock ? matchStock(line.name, options.stock) : undefined;
    const amount = line.expected === undefined ? consumptionAmount(line) : benchAmount(line.expected, line.unit);
    // The stock on hand, when it is short of this run's expected use.
    const short = stock && line.expected !== undefined && isShort(line.expected, line.unit, stock) ? benchAmount(stock.currentQuantity, stock.unit) : undefined;
    items.push({ key: `material:${line.key}`, kind: 'material', label: line.name, detail: `${amount} · used in ${line.sources.join('; ')}`,
      ...(line.expected === undefined ? { warning: amount } : short !== undefined ? { warning: `Stock ${short}, short of this run’s use` } : {}),
      ...(options.recorded && consumptionRecorded(line, options.recorded) ? { badge: 'Recorded' } : {}) });
    if (short !== undefined) warnings.push(`Stock short: ${line.name} (in stock ${short}, this run needs about ${amount})`);
  }
  for (const [stepId, step] of steps) for (const mix of stepMixes(run, stepId)) {
    const state = mixState(run, stepId, mix), label = mixQuantityLabel(mix);
    const quantity = state.quantity === undefined ? `Not filled in: ${runQuantityLabelText(label)}` : runQuantityText(state.quantity, label);
    items.push({ key: `mix:${stepId}:${mix.id}`, kind: 'mix', stepId, label: `${mixTitle(mix)} · ${stepLabel(step)}`, detail: `${quantity} · ${state.current && state.receipt ? 'Confirmed' : 'Not confirmed'}`, ...(state.quantity === undefined ? { warning: quantity } : {}) });
  }
  for (const plate of options.plates ?? []) items.push({ key: `plate:${plate.id}`, kind: 'plate', label: plate.name, detail: 'Plate layout attachment' });
  // Equipment: each tool a step uses, with this run's settings.
  for (const version of run.versions) {
    const systems = version.document.systems;
    for (const tool of systems?.tools ?? []) {
      const using = steps.filter(([id, step]) => versionOf(id)?.id === version.id && (step.chipIds?.includes(tool.id) || tool.fields.some(field => step.chipIds?.includes(field.parameterId))));
      if (!using.length) continue;
      const spec = toolSpecs[tool.kind];
      const values = tool.fields.flatMap(field => { const resolved = version.parameters[field.parameterId]; const label = spec.fields.find(item => item.key === field.key)?.label ?? field.key;
        return resolved?.status === 'resolved' && resolved.value !== undefined && resolved.value !== null ? [{ key: field.key, text: chipAmount(resolved.value, resolved.unit) }] : [{ key: field.key, text: `${toolFieldNames[label] ?? label} to be determined` }]; });
      items.push({ key: `equipment:${version.id}:${tool.id}`, kind: 'equipment', label: `${equipmentNames[tool.kind]}${tool.method?.trim() ? ` · ${tool.method.trim()}` : ''}`, detail: [equipmentDetail(tool.kind, values), using.map(([, step]) => stepLabel(step)).join(', ')].filter(Boolean).join(' · ') });
    }
  }
  // Timers: a step's rule timer, else every time chip it holds (each can start the countdown).
  for (const [stepId, step] of steps) {
    const version = versionOf(stepId), systems = version?.document.systems;
    const chips = (step.chipIds ?? []).flatMap(id => { const parameter = systems?.parameters.find(p => p.id === id); return parameter && isTime(parameter.unit) && version?.parameters[id]?.status === 'resolved' ? [parameter] : []; });
    const durations = step.timerDurationSeconds ? [formatDuration(step.timerDurationSeconds)] : chips.map(p => { const resolved = version!.parameters[p.id]; return formatDuration(Math.round(convert(resolved.value!, resolved.unit, 's'))); });
    if (durations.length) items.push({ key: `timer:${stepId}`, kind: 'timer', stepId, label: stepLabel(step), detail: durations.join(' · ') });
    for (const field of step.actualFields) if (field.required && !run.plan.actualValues[stepId]?.[field.id]) reminders.push(`Required at run time: ${stepLabel(step)} · ${field.label}`);
    // Values filled in at run time (actual-source chips) are entered at the step; until then the step waits.
    for (const id of step.chipIds ?? []) { const parameter = systems?.parameters.find(p => p.id === id); if (parameter?.source.kind === 'actual' && version && !run.plan.versions[version.id]?.actualInputs[id]) reminders.push(`Filled in at run time: ${stepLabel(step)} · ${parameterLongName(parameter, systems!)}`); }
  }
  return { items, warnings, reminders };
}

/** Ticked items over all items; the list changes with the plan, the ticks follow their keys. */
export function preparationProgress(items: PreparationItem[], state: ExecutionPlan['preparation']) {
  const done = items.filter(item => state[item.key]?.done).length;
  return { done, total: items.length, pending: items.filter(item => !state[item.key]?.done) };
}
