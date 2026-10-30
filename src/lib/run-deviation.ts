import { convert, normalizeUnit, units } from './calculators/quantities';
import { chipAmount, parameterLongName, rangeText, withinRange } from './protocol-chips';
import { stepVersion, type StructuredRunView } from './structured-run';

type Quantity = { value: number; unit: string };
/** One recorded value against the adopted one: `line` is absent when they agree, so a value back on plan drops its line. */
export type ActualDeviation = { prefix: string; line?: string; type: 'timing' | 'material' | 'equipment' | 'method' };

/** Whether two amounts are the same once converted; false when their units cannot be compared. */
export const sameAmount = (a: Quantity, b: Quantity) => { try { return Math.abs(convert(a.value, a.unit, b.unit) - b.value) <= Math.abs(b.value) * 1e-9; } catch { return false; } };

/**
 * The deviation lines for values recorded at a step: "时间（规程 30 min，原文 20–30 min）：实际 25 min，在原文范围内".
 * Written in the experiment record's Chinese, like the rest of the deviation record. Values without an adopted one are not compared.
 */
export function actualDeviations(view: Pick<StructuredRunView, 'steps' | 'versions'>, stepId: string, values: Record<string, Quantity>): ActualDeviation[] {
  const version = stepVersion(view, stepId), systems = version?.document.systems;
  if (!version || !systems) return [];
  return Object.entries(values).flatMap(([id, actual]) => {
    const parameter = systems.parameters.find(item => item.id === id), planned = version.parameters[id];
    if (!parameter || planned?.status !== 'resolved' || planned.value === undefined) return [];
    const range = parameter.range;
    const prefix = `${parameterLongName(parameter, systems)}（规程 ${chipAmount(planned.value, planned.unit)}${range ? `，原文 ${rangeText(range)}` : ''}）：`;
    const type = units[normalizeUnit(planned.unit)]?.dimension === 'time' ? 'timing' : parameter.materialRef ? 'material' : parameter.ownerToolId ? 'equipment' : 'method';
    if (sameAmount(actual, { value: planned.value, unit: planned.unit })) return [{ prefix, type }];
    return [{ prefix, type, line: `${prefix}实际 ${chipAmount(actual.value, actual.unit)}${range ? withinRange(actual.value, actual.unit, range) ? '，在原文范围内' : '，超出原文范围' : ''}` }];
  });
}

/** The step's deviation note with each value's line written, replaced or removed; everything the person wrote stays. */
export function noteWithDeviations(note: string | null | undefined, deviations: ActualDeviation[]): string | null {
  const rows = (note ?? '').split('\n');
  for (const { prefix, line } of deviations) {
    const at = rows.findIndex(row => row.startsWith(prefix));
    if (line && at >= 0) rows[at] = line;
    else if (line) rows.push(line);
    else if (at >= 0) rows.splice(at, 1);
  }
  return rows.join('\n').trim() || null;
}
