import { compatibleUnits, convert, normalizeUnit, units } from './calculators/quantities';
import { toolFieldNamesZh } from './i18n';
import { calculationGroups } from './protocol-calculations';
import { chipAmount, parameterLongName, toolSpecs, type ToolKind } from './protocol-chips';
import { mixQuantityLabel, mixTitle, runQuantityLabels, runQuantityLabelText, runQuantityText } from './protocol-mix';
import { consumptionAmount, consumptionRecorded, lineStock, runConsumption } from './run-consumption';
import { mixState, stepMixes, stepVersion, type ExecutionPlan, type StructuredRunView } from './structured-run';

export type PreparationKind = 'sample' | 'material' | 'mix' | 'plate' | 'equipment';
export type PreparationItem = { key: string; kind: PreparationKind; label: string; detail?: string; warning?: string; badge?: string; stepId?: string };
export type PreparationState = ExecutionPlan['preparation'][string];
export type PreparationChecklist = {
  /**
   * What to have ready before the bench, in bench order: materials, mix cards, plates, equipment. Each can be ticked ready.
   * Timers and values recorded at run time belong to their steps, not here.
   */
  items: PreparationItem[];
  /** What still stops the run or its quantities: an unconfirmed system, a missing 本次数量, a calculation not yet confirmed, stock short. */
  warnings: string[];
  /** Something is entered in preparation before the run can go on: systems to choose or a 本次数量 to fill in. */
  needsInput: boolean;
};
export const preparationKindLabels: Record<PreparationKind, string> = { sample: 'Samples to take out', material: 'Materials and amounts', mix: 'Mix cards', plate: 'Plate layouts', equipment: 'Equipment setup' };
// The checklist's text is English; the Chinese interface translates it (translateDynamic in i18n.ts), names and codes untouched.
const equipmentNames: Record<ToolKind, string> = { centrifuge: 'Centrifuge', mix: 'Mix', incubate: 'Incubate', shake: 'Shaker', vacuum: 'Vacuum', electrophoresis: 'Electrophoresis', electroporation: 'Electroporation', gas: 'Gas', dark: 'Protect from light', gradient: 'Gradient' };
/** A tool field still open, named in English by its toolSpecs label. */
const toolFieldNames = Object.fromEntries(Object.entries(toolFieldNamesZh).map(([english, chinese]) => [chinese, english]));

type PlateAttachment = { id: string; name: string };
export type PreparationStock = { id?: string; name: string; unit: string; currentQuantity: number; quantityRecorded: boolean };
/** The boxes the experiment's samples come out of (S15), with their positions. */
export type PreparationSamples = { boxes: Array<{ label: string; count: number; positions: string }>; unplaced: number };
type Options = { plates?: PlateAttachment[]; stock?: PreparationStock[]; recorded?: Array<{ source: string }>; samples?: PreparationSamples };

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
  const items: PreparationItem[] = [], warnings: string[] = [];
  let needsInput = false;
  const steps = Object.entries(run.steps).filter(([id, step]) => step.applicability !== 'not-applicable' && !run.plan.skips[id]).sort((a, b) => a[1].order - b[1].order);
  // A shared-preparation step belongs to every group: its version is the first group's, as stepVersion resolves it.
  const versionOf = (stepId: string) => stepVersion(run, stepId);
  // With several Protocols a bare "Step 3" is ambiguous: the step names its Protocol by code (by title when the snapshot has no code).
  const several = new Set(run.versions.map(version => version.sourceVersionId)).size > 1;
  const stepLabel = (step: StructuredRunView['steps'][string]) => {
    const version = several ? run.versions.find(item => item.id === step.versionId || item.sourceVersionId === step.versionId) : undefined;
    return version ? `${version.code ?? version.title} step ${step.order}` : `Step ${step.order}`;
  };
  // A group's own row (its mix card, its equipment when the groups differ) names the group.
  const groupOf = (step: StructuredRunView['steps'][string]) => run.plan.groups.length > 1 && step.groupLabel && step.groupId !== 'shared' ? `${step.groupLabel} · ` : '';
  for (const version of run.versions) {
    const adopted = run.plan.versions[version.id], systems = version.document.systems;
    const name = version.groupLabel ? `${version.groupLabel} · ${version.title}` : version.title;
    if (!adopted && systems?.dimensions.length) { warnings.push(`Systems for this run not confirmed: ${name}`); needsInput = true; }
    // A draft generated from a search still carries what the method card could not verify. Said once per Protocol, not per group.
    if (version.document.provenance?.design?.unverified) warnings.push(`${version.title} was generated by method design; its method card has ${version.document.provenance.design.unverified} unverified items. Check the original first`);
    if (version.document.provenance?.recognition?.unverified) warnings.push(`${version.title} was generated by AI from instructions; ${version.document.provenance.recognition.unverified} lines have no source in the original. Check the original first`);
    for (const label of runQuantityLabels(version.document)) if (run.plan.quantities[version.id]?.[label] === undefined) { warnings.push(`Run quantity not filled in: ${runQuantityLabelText(label)} · ${name}`); needsInput = true; }
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
    const stock = options.stock ? lineStock(line, options.stock) : undefined;
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
    items.push({ key: `mix:${stepId}:${mix.id}`, kind: 'mix', stepId, label: `${groupOf(step)}${mixTitle(mix)} · ${stepLabel(step)}`, detail: `${quantity} · ${state.current && state.receipt ? 'Confirmed' : 'Not confirmed'}`, ...(state.quantity === undefined ? { warning: quantity } : {}) });
  }
  for (const box of options.samples?.boxes ?? []) items.push({ key: `sample:${box.label}`, kind: 'sample', label: box.label, detail: `${box.count} ${box.count === 1 ? 'sample' : 'samples'}${box.positions ? ` · ${box.positions}` : ''}` });
  if (options.samples?.unplaced) items.push({ key: 'sample:unplaced', kind: 'sample', label: 'Samples without a place', detail: `${options.samples.unplaced} ${options.samples.unplaced === 1 ? 'sample' : 'samples'}` });
  for (const plate of options.plates ?? []) items.push({ key: `plate:${plate.id}`, kind: 'plate', label: plate.name, detail: 'Plate layout attachment' });
  // Equipment: each tool a step uses, with this run's settings. Groups that set it up the same way share one row.
  const equipment = new Map<string, Array<{ item: PreparationItem; settings: string; steps: string[]; group?: string }>>();
  for (const version of run.versions) {
    const systems = version.document.systems;
    for (const tool of systems?.tools ?? []) {
      const using = steps.filter(([id, step]) => versionOf(id)?.id === version.id && (step.chipIds?.includes(tool.id) || tool.fields.some(field => step.chipIds?.includes(field.parameterId))));
      if (!using.length) continue;
      const spec = toolSpecs[tool.kind];
      const values = tool.fields.flatMap(field => { const resolved = version.parameters[field.parameterId]; const label = spec.fields.find(item => item.key === field.key)?.label ?? field.key;
        return resolved?.status === 'resolved' && resolved.value !== undefined && resolved.value !== null ? [{ key: field.key, text: chipAmount(resolved.value, resolved.unit) }] : [{ key: field.key, text: `${toolFieldNames[label] ?? label} to be determined` }]; });
      const label = `${equipmentNames[tool.kind]}${tool.method?.trim() ? ` · ${tool.method.trim()}` : ''}`;
      const entries = equipment.get(`${version.sourceVersionId}:${tool.id}`) ?? [];
      entries.push({ item: { key: `equipment:${version.id}:${tool.id}`, kind: 'equipment', label }, settings: equipmentDetail(tool.kind, values), steps: using.map(([, step]) => stepLabel(step)), group: version.groupLabel });
      equipment.set(`${version.sourceVersionId}:${tool.id}`, entries);
    }
  }
  const detail = (...parts: string[]) => parts.filter(Boolean).join(' · ');
  for (const [key, entries] of equipment) {
    const [first] = entries;
    if (entries.length > 1 && entries.every(entry => entry.settings === first.settings)) items.push({ ...first.item, key: `equipment:${key}`, detail: detail(first.settings, entries.map(entry => entry.group ?? '').join(' · '), [...new Set(entries.flatMap(entry => entry.steps))].join(', ')) });
    else for (const entry of entries) items.push({ ...entry.item, label: entries.length > 1 && entry.group ? `${entry.group} · ${entry.item.label}` : entry.item.label, detail: detail(entry.settings, [...new Set(entry.steps)].join(', ')) });
  }
  return { items, warnings: [...new Set(warnings)], needsInput };
}

/** Ticked items over all items; the list changes with the plan, the ticks follow their keys. */
export function preparationProgress(items: PreparationItem[], state: ExecutionPlan['preparation']) {
  const done = items.filter(item => state[item.key]?.done).length;
  return { done, total: items.length, pending: items.filter(item => !state[item.key]?.done) };
}
