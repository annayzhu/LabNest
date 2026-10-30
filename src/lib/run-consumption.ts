import { convert, normalizeUnit, units } from './calculators/quantities';
import { mixQuantityLabel, mixTitle, runQuantityLabelText } from './protocol-mix';
import { chipAmount, chipReferenceId, isMaterialAmount } from './protocol-chips';
import { mixState, stepMixes, stepQuantities, stepVersion, type StructuredRunView } from './structured-run';

/**
 * One material this run is expected to use: summed over steps, in the unit first written. `key` is stable across reloads.
 * `inventoryItemId`: the stock item the Protocol linked this material to, deducted without guessing by name.
 */
export type ConsumptionLine = { key: string; name: string; unit: string; expected?: number; sources: string[]; pending?: string; inventoryItemId?: string };

/**
 * What this run consumes, from the chips themselves rather than a formula table.
 * A mix card counts at its totals (confirmed, else as it stands); a material-linked chip elsewhere counts per reaction × 反应数,
 * or once when the author marked it "本次总量". Old formula rules are kept as notes and never computed.
 */
export function runConsumption(view: Pick<StructuredRunView, 'steps' | 'plan' | 'versions'>, stepLabel: (step: StructuredRunView['steps'][string]) => string = step => step.title || '步骤'): ConsumptionLine[] {
  const lines = new Map<string, ConsumptionLine>();
  const add = (name: string, unit: string, value: number | undefined, source: string, pending?: string, inventoryItemId?: string) => {
    const dimension = units[normalizeUnit(unit)]?.dimension;
    // No "|" in the key: stored sources are "Chip:<key>|<where>" and the part before "|" identifies the line.
    const key = `${name.trim().toLowerCase()}#${dimension ?? unit}`;
    const line = lines.get(key) ?? { key, name: name.trim(), unit, expected: 0, sources: [] };
    if (inventoryItemId) line.inventoryItemId ??= inventoryItemId;
    if (value === undefined || line.expected === undefined) { line.expected = undefined; line.pending ??= pending ?? 'To be determined'; }
    else line.expected += convert(value, unit, line.unit);
    if (!line.sources.includes(source)) line.sources.push(source);
    lines.set(key, line);
  };
  for (const [stepId, step] of Object.entries(view.steps)) {
    if (step.applicability === 'not-applicable' || view.plan.skips[stepId]) continue;
    const version = stepVersion(view, stepId), systems = version?.document.systems;
    if (!version || !systems) continue;
    const where = `${step.groupLabel ? `${step.groupLabel} · ` : ''}${stepLabel(step)}`;
    const inMix = new Set<string>();
    for (const mix of stepMixes(view, stepId)) {
      const state = mixState(view, stepId, mix), receipt = state.current ? state.receipt : undefined;
      for (const component of mix.components) {
        const id = chipReferenceId(component.amount);
        if (id) inMix.add(id);
        const line = receipt?.lines.find(item => item.id === component.id) ?? state.live.lines.find(item => item.id === component.id);
        const parameter = systems.parameters.find(p => p.id === id);
        const name = parameter?.materialRef?.name ?? (component.name.trim() || parameter?.label.trim());
        if (!name || !line?.unit || !isMaterialAmount(line.unit)) continue;
        add(name, line.unit, line.total, `${where} · ${mixTitle(mix)}`, state.quantity === undefined ? `Not filled in: ${runQuantityLabelText(mixQuantityLabel(mix))}` : undefined, parameter?.materialRef?.inventoryItemId);
      }
    }
    const reactions = stepQuantities(view, stepId).quantities['反应数'];
    for (const id of step.chipIds ?? []) {
      const parameter = systems.parameters.find(p => p.id === id);
      if (!parameter?.materialRef || inMix.has(id)) continue;
      const resolved = version.parameters[id], stock = parameter.materialRef.inventoryItemId;
      if (resolved?.status !== 'resolved') { add(parameter.materialRef.name, parameter.unit, undefined, where, undefined, stock); continue; }
      if (!isMaterialAmount(resolved.unit)) continue;
      if (parameter.perRun) add(parameter.materialRef.name, resolved.unit, resolved.value, where, undefined, stock);
      else add(parameter.materialRef.name, resolved.unit, reactions === undefined ? undefined : resolved.value! * reactions, where, `Not filled in: ${runQuantityLabelText('反应数')}`, stock);
    }
  }
  return [...lines.values()];
}

/** A line's usage row is written once per run, its source prefixed "Chip:<key>"; a line with such a row is already recorded. */
export const consumptionSource = (line: Pick<ConsumptionLine, 'key'>) => `Chip:${line.key}`;
export const consumptionRecorded = (line: Pick<ConsumptionLine, 'key'>, rows: Array<{ source: string }>) => rows.some(row => row.source === consumptionSource(line) || row.source.startsWith(`${consumptionSource(line)}|`));

/** A line's amount as the bench reads it: the expected total, or why it is still open. */
export const consumptionAmount = (line: ConsumptionLine) => line.expected === undefined ? line.pending ?? 'To be determined' : chipAmount(Number(line.expected.toPrecision(6)), line.unit);

/** The stock item for a line: the one the Protocol linked, else by name (see matchStock). */
export function lineStock<T extends { id?: string; name: string }>(line: Pick<ConsumptionLine, 'name' | 'inventoryItemId'>, stock: T[]) {
  return (line.inventoryItemId ? stock.find(item => item.id === line.inventoryItemId) : undefined) ?? matchStock(line.name, stock);
}

/** The stock item a line's material names: the same name first, else one name containing the other. */
export function matchStock<T extends { name: string }>(name: string, stock: T[]) {
  const target = name.trim().toLowerCase();
  return stock.find(item => item.name.trim().toLowerCase() === target) ?? stock.find(item => item.name.toLowerCase().includes(target) || target.includes(item.name.toLowerCase()));
}
