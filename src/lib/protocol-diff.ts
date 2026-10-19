import { chipAmount, parameterLongName, protocolChipText } from './protocol-chips';
import { protocolSectionLabels, type ProtocolContentBlock, type ProtocolDocument } from './protocol-document';
import { executionBlockText } from './protocol-execution';
import { formatProtocolSource } from './protocol-sources';
import type { ProtocolCondition, ProtocolSystems } from './protocol-systems-schema';

export type DiffEntry = { id: string; label: string; before?: string; after?: string; change: 'added' | 'removed' | 'changed' };
export type ProtocolDiff = {
  sections: Array<{ key: string; title: string; entries: DiffEntry[] }>;
  parameters: DiffEntry[];
  sources: DiffEntry[];
  counts: { added: number; removed: number; changed: number };
};

/** A block as a reader sees it: chips shown as their values, never as `{{id}}`. */
const readable = (block: ProtocolContentBlock, systems: ProtocolSystems | undefined) =>
  executionBlockText(block).replace(/\{\{([\w-]+)\}\}/g, (_, id: string) => protocolChipText(id, systems).replace(/^〔|〕$/g, '')).replace(/\s+/g, ' ').trim();

const whenLabel = (when: ProtocolCondition, systems: ProtocolSystems) => {
  const name = (dimensionId: string, optionId: string) => { const dimension = systems.dimensions.find(d => d.id === dimensionId); return dimension?.options.find(o => o.id === optionId)?.label ?? optionId; };
  return [...(when.all ?? []).map(p => name(p.dimensionId, p.optionId)), ...(when.any ?? []).map(p => `or ${name(p.dimensionId, p.optionId)}`), ...(when.not ?? []).map(p => `not ${name(p.dimensionId, p.optionId)}`)].join(' + ') || 'Default';
};
const amount = (value: number | null | undefined, unit: string) => value === null || value === undefined ? `Not filled (${unit})` : chipAmount(value, unit);
/** What a parameter is set to, in words: a fixed value, one value per system, filled at execution, or computed. The Chinese interface translates it. */
export function parameterSetting(parameter: ProtocolSystems['parameters'][number], systems: ProtocolSystems) {
  const source = parameter.source;
  if (source.kind === 'fixed') return amount(source.value, source.unit);
  if (source.kind === 'lookup') return source.values.length ? `By system: ${source.values.map(value => `${whenLabel(value.when, systems)} → ${amount(value.value, value.unit)}`).join('; ')}` : 'By system (not filled)';
  if (source.kind === 'actual') return 'Filled in at run time';
  return `Calculated (${source.calculatorId} → ${source.output})`;
}

/** How a reader finds a block: its step number ("Step 3", "Step 3 · details") or its place in the section ("Block 2"). */
function blockLabels(blocks: ProtocolContentBlock[]) {
  const labels = new Map<string, string>();
  let step = 0;
  const numbers = new Map<string, number>();
  blocks.forEach((block, index) => {
    const stepId = block.execution?.stepId ?? (block.execution?.role === 'step' ? block.id : undefined);
    if (block.execution?.role === 'step' && stepId) { step += 1; numbers.set(stepId, step); }
    labels.set(block.id, stepId && numbers.has(stepId) ? `Step ${numbers.get(stepId)}${block.execution?.role === 'detail' ? ' · details' : ''}` : `Block ${index + 1}`);
  });
  return labels;
}

function diffById<T>(before: Map<string, T>, after: Map<string, T>, label: (id: string, item: T) => string, text: (item: T) => string): DiffEntry[] {
  const entries: DiffEntry[] = [];
  for (const [id, item] of after) {
    const previous = before.get(id);
    if (!previous) entries.push({ id, label: label(id, item), after: text(item), change: 'added' });
    else if (text(previous) !== text(item)) entries.push({ id, label: label(id, item), before: text(previous), after: text(item), change: 'changed' });
  }
  for (const [id, item] of before) if (!after.has(id)) entries.push({ id, label: label(id, item), before: text(item), change: 'removed' });
  return entries;
}

/**
 * Two versions side by side: blocks by their stable ids with chips rendered as values, parameters by id with their settings,
 * and sources. Computed in memory; nothing is stored. Blocks that are empty on both sides are ignored.
 */
export function diffProtocolVersions(a: ProtocolDocument, b: ProtocolDocument): ProtocolDiff {
  const sections = a.sections.map(section => {
    const other = b.sections.find(item => item.key === section.key);
    const blocks = (document: ProtocolDocument, list: ProtocolContentBlock[]) => new Map(list.map(block => [block.id, readable(block, document.systems)] as const).filter(([, text]) => text));
    const labels = new Map([...blockLabels(section.blocks), ...blockLabels(other?.blocks ?? [])]);
    const entries = diffById(blocks(a, section.blocks), blocks(b, other?.blocks ?? []), id => labels.get(id) ?? id, text => text);
    return { key: section.key, title: protocolSectionLabels[section.key] ?? section.title, entries };
  }).filter(section => section.entries.length);
  const parameters = (document: ProtocolDocument) => new Map((document.systems?.parameters ?? []).map(p => [p.id, p] as const));
  const parameterEntries = diffById(parameters(a), parameters(b), (id, p) => parameterLongName(p, (b.systems ?? a.systems)!), p => parameterSetting(p, (b.systems ?? a.systems)!));
  const sources = (document: ProtocolDocument) => new Map((document.sources ?? []).map(source => [source.id, source] as const));
  const sourceEntries = diffById(sources(a), sources(b), (_, source) => source.title || source.kind, formatProtocolSource);
  const all = [...sections.flatMap(section => section.entries), ...parameterEntries, ...sourceEntries];
  return { sections, parameters: parameterEntries, sources: sourceEntries, counts: { added: all.filter(e => e.change === 'added').length, removed: all.filter(e => e.change === 'removed').length, changed: all.filter(e => e.change === 'changed').length } };
}
