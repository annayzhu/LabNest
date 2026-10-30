import { chipWithRangeEnd, mapAuthoredStrings, pruneUnusedChips, rangeText } from './protocol-chips';
import type { ProtocolSystems } from './protocol-systems-schema';

type Parameter = ProtocolSystems['parameters'][number];
// Two chips written as a range: "{{a}} - {{b}}", "{{a}}–{{b}}", "{{a}} to {{b}}", "{{a}} 至 {{b}}".
const chipPair = /\{\{([\w-]+)\}\}(\s*(?:[-–—−~～〜]|至|到)\s*|\s+to\s+)\{\{([\w-]+)\}\}/g;

/**
 * 两段式范围: a source range that an earlier import wrote as two chips becomes one range chip. The first chip keeps its
 * identity and has no adopted value until the author picks one; the second is dropped once nothing else uses it, and step
 * rules that pointed at it (a timer) point at the range. Pairs that are not a range of one kind (37 °C - 5 min) stay.
 */
export function mergeRangePairs<T extends { systems?: ProtocolSystems; sections: unknown }>(document: T): { document: T; merged: Array<{ id: string; removed: string; range: string }> } {
  const systems = document.systems;
  if (!systems?.parameters.length) return { document, merged: [] };
  const parameters = new Map<string, Parameter>(systems.parameters.map(parameter => [parameter.id, parameter]));
  const merged: Array<{ id: string; removed: string; range: string }> = [];
  const sections = mapAuthoredStrings(document.sections, text => text.replace(chipPair, (whole, first: string, _separator: string, second: string) => {
    // The same two chips written again elsewhere (step 1 and step 4 both "20 - 30 min") are the same range.
    if (merged.some(item => item.id === first && item.removed === second)) return `{{${first}}}`;
    const low = parameters.get(first), high = parameters.get(second);
    if (!low || !high || high.source.kind !== 'fixed' || high.source.value === null || high.range || high.ownerToolId) return whole;
    const range = chipWithRangeEnd(low, { value: high.source.value, unit: high.source.unit });
    if (!range) return whole;
    parameters.set(first, { ...range, label: low.label || high.label, ...(low.materialRef ?? high.materialRef ? { materialRef: low.materialRef ?? high.materialRef } : {}) });
    merged.push({ id: first, removed: second, range: rangeText(range.range!) });
    return `{{${first}}}`;
  }));
  if (!merged.length) return { document, merged };
  const replaced = new Map(merged.map(item => [item.removed, item.id]));
  const rules = systems.rules.map(rule => ({ ...rule, parameterIds: [...new Set(rule.parameterIds.map(id => replaced.get(id) ?? id))], ...(rule.timerParameterId ? { timerParameterId: replaced.get(rule.timerParameterId) ?? rule.timerParameterId } : {}) }));
  return { document: pruneUnusedChips({ ...document, sections, systems: { ...systems, rules, parameters: systems.parameters.map(parameter => parameters.get(parameter.id)!) } }), merged };
}
