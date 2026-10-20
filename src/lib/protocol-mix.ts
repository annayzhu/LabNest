import { convert, normalizeUnit, parseScalar, units } from './calculators/quantities';
import { chipAmount, chipKindForUnit, chipReferenceId, isMaterialAmount, parameterDisplayName } from './protocol-chips';
import type { ProtocolContentBlock } from './protocol-document';
import type { ProtocolSystems } from './protocol-systems-schema';

export type ProtocolMix = Extract<ProtocolContentBlock, { type: 'mix' }>;
type Parameter = ProtocolSystems['parameters'][number];
type Resolved = { status: string; value?: number; unit: string };

/** The quantity a mix card is scaled by, named the way the bench counts it: 反应数, 孔数, 样本数. */
export const mixPer = (mix: Pick<ProtocolMix, 'per'>) => mix.per || '反应';
export const mixTitle = (mix: Pick<ProtocolMix, 'title'>) => mix.title || '配液卡';
export const mixQuantityLabel = (mix: Pick<ProtocolMix, 'per'>) => `${mixPer(mix)}数`;
/**
 * The per words a mix card offers, as the interface shows them (one, several). Display only: the stored per (反应) and run
 * quantity key (反应数) stay as they are, a word someone typed passes through, and the Chinese interface reads these back.
 */
const perWords = new Map<string, readonly [string, string]>([['反应', ['reaction', 'reactions']], ['孔', ['well', 'wells']], ['样本', ['sample', 'samples']], ['管', ['tube', 'tubes']]]);
const quantityWords = (label: string) => label.endsWith('数') ? perWords.get(label.slice(0, -1)) : undefined;
/** "reaction" for 反应, "reactions" for any other count than 1. */
export const mixPerText = (per: string, count = 1) => perWords.get(per)?.[count === 1 ? 0 : 1] ?? per;
/** "number of reactions" for the run quantity key 反应数, "Number of reactions" as a field label. */
export function runQuantityLabelText(label: string, capital = false) {
  const words = quantityWords(label);
  return words ? `${capital ? 'Number' : 'number'} of ${words[1]}` : label;
}
/** "24 reactions" for 24 under 反应数; a key someone typed reads "24 板数". */
export function runQuantityText(quantity: number, label: string) {
  const words = quantityWords(label);
  return words ? `${quantity} ${words[quantity === 1 ? 0 : 1]}` : `${quantity} ${label}`;
}
/** A bench-made mix card offered from a run to its Protocol. */
export type MixProposal = { id: string; mix: ProtocolMix; stepRef?: string; stepTitle?: string; runCode?: string; createdAt: string };
const isVolume = (unit: string) => units[normalizeUnit(unit)]?.dimension === 'volume';
/** Every chip referenced anywhere in `value`, in order of first appearance. */
const referencedChips = (value: unknown) => new Set([...JSON.stringify(value).matchAll(/\{\{([\w-]+)\}\}/g)].map(match => match[1]));

type MixLine = { id: string; name: string; mode: 'premix' | 'separate'; unit: string; perReaction?: number; total?: number; pending?: string };
export type MixView = {
  lines: MixLine[]; quantity?: number; overagePercent: number;
  /** Premixed volume each reaction receives, when every premixed part is a volume. */
  premixPerReaction?: { value: number; unit: string };
  /** `aliquot` is the wording a confirmed card stores (receipt, watch, Experiment document); `aliquotText` is what the interface shows. */
  aliquot: string; aliquotText: string; warnings: string[]; ready: boolean; fingerprint: string;
};

/**
 * A mix card for one run: each component's amount per reaction (as adopted), the totals for `quantity` reactions with the
 * card's overage on the premix, the aliquot instruction, and pipetting warnings. Pure; the server recomputes it on confirmation.
 */
export function mixView(mix: ProtocolMix, systems: ProtocolSystems | undefined, resolution: Record<string, Resolved>, quantity?: number): MixView {
  const per = mixPer(mix), factor = 1 + mix.overagePercent / 100;
  const validQuantity = quantity !== undefined && Number.isFinite(quantity) && quantity > 0;
  const validOverage = Number.isFinite(mix.overagePercent) && mix.overagePercent >= 0 && mix.overagePercent <= 100;
  const lines: MixLine[] = mix.components.map(component => {
    const id = chipReferenceId(component.amount), parameter = id ? systems?.parameters.find(p => p.id === id) : undefined;
    const name = component.name.trim() || (parameter ? parameterDisplayName(parameter) : '组分');
    const resolved = id ? resolution[id] : undefined;
    if (!parameter || resolved?.status !== 'resolved') return { id: component.id, name, mode: component.mode, unit: parameter?.unit ?? '', pending: !parameter ? 'Amount deleted' : parameter.source.kind === 'lookup' ? 'System to choose' : parameter.source.kind === 'actual' ? 'Filled in at run time' : 'To fill in' };
    const line = { id: component.id, name, mode: component.mode, unit: resolved.unit };
    const perReaction = resolved.value;
    if (perReaction === undefined || !Number.isFinite(perReaction) || perReaction < 0) return { ...line, pending: 'Amount must be finite and nonnegative' };
    const total = validQuantity && validOverage ? perReaction * quantity * (component.mode === 'premix' ? factor : 1) : undefined;
    if (total !== undefined && !Number.isFinite(total)) return { ...line, pending: 'Total amount is too large' };
    return { ...line, perReaction,
      ...(total !== undefined ? { total } : {}) };
  });
  const premix = lines.filter(line => line.mode === 'premix');
  const premixPerReaction = premix.length && premix.every(line => line.perReaction !== undefined && isVolume(line.unit))
    ? { value: premix.reduce((sum, line) => sum + convert(line.perReaction!, line.unit, 'µL'), 0), unit: 'µL' } : undefined;
  const separate = lines.filter(line => line.mode === 'separate');
  const amount = (line: MixLine) => line.perReaction === undefined ? '—' : chipAmount(line.perReaction, line.unit);
  const premixAmount = premixPerReaction ? chipAmount(Number(premixPerReaction.value.toPrecision(6)), 'µL') : '—';
  const aliquot = [
    premix.length ? `每${per}分装预混液 ${premixAmount}` : '',
    separate.length ? `${premix.length ? '再加' : '每' + per + '加'} ${separate.map(line => `${line.name} ${amount(line)}`).join('、')}` : '',
  ].filter(Boolean).join('，') + '。';
  const perText = mixPerText(per), additions = separate.map(line => `${line.name} ${amount(line)}`).join(', ');
  const aliquotText = premix.length ? `Aliquot ${premixAmount} of premix per ${perText}${separate.length ? `, then add ${additions}` : ''}.` : separate.length ? `Add ${additions} per ${perText}.` : '';
  const warnings: string[] = [];
  const minimum = mix.minPipetteUl;
  for (const line of lines) {
    if (line.perReaction === undefined || !isVolume(line.unit)) continue;
    const pipetted = line.mode === 'premix' ? line.total : line.perReaction;
    if (pipetted !== undefined && convert(pipetted, line.unit, 'µL') < minimum) warnings.push(`${line.name} ${line.mode === 'premix' ? 'total' : `per ${perText}`} ${chipAmount(Number(pipetted.toPrecision(4)), line.unit)} is below the pipetting minimum of ${minimum} µL; dilute it first or increase the ${runQuantityLabelText(mixQuantityLabel(mix))}.`);
  }
  if (premix.some(line => line.perReaction !== undefined && !isVolume(line.unit))) warnings.push('The premix has a component that is not a volume; the aliquot volume leaves it out.');
  const amountsValid = lines.length > 0 && lines.every(line => line.perReaction !== undefined) && (!premixPerReaction || Number.isFinite(premixPerReaction.value));
  const ready = validQuantity && validOverage && amountsValid;
  const fingerprint = JSON.stringify({ quantity: quantity ?? null, overage: mix.overagePercent, lines: lines.map(line => [line.id, line.mode, line.unit, line.perReaction === undefined ? null : Number(line.perReaction.toPrecision(12))]) });
  return { lines, quantity, overagePercent: mix.overagePercent, premixPerReaction: amountsValid ? premixPerReaction : undefined,
    aliquot: amountsValid && validOverage ? aliquot : '', aliquotText: amountsValid && validOverage ? aliquotText : 'Resolve invalid or missing amounts before preparing this mix.', warnings, ready, fingerprint };
}

/** A new mix card with one empty component; amounts are chips so they can differ by system. */
export function newMix(newId: (prefix: string) => string): { block: ProtocolMix; parameters: Parameter[] } {
  const parameter = newMixParameter(newId);
  return { block: { id: newId('mix'), type: 'mix', title: '预混液', per: '反应', overagePercent: 10, minPipetteUl: 0.5, components: [{ id: newId('component'), name: '', amount: `{{${parameter.id}}}`, mode: 'premix' }] }, parameters: [parameter] };
}
export function newMixParameter(newId: (prefix: string) => string, label = '', value: number | null = null, unit = 'µL'): Parameter {
  return { id: newId('p'), label, unit, kind: chipKindForUnit(unit), origin: 'chip', source: { kind: 'fixed', value, unit } };
}

/** "10 µL", "4uL", "2.5 mg" as an amount in a registered unit; anything else is not an amount. */
function cellQuantity(cell: string) {
  const match = /^\s*([-−]?[\d.,]+(?:e[+-]?\d+)?)\s*(\S+)\s*$/i.exec(cell);
  if (!match) return undefined;
  const unit = normalizeUnit(match[2]);
  try { return units[unit] ? { value: parseScalar(match[1].replace(/,/g, '').replace('−', '-')), unit } : undefined; } catch { return undefined; }
}
/**
 * A recipe table ("组分 | 每反应" or "组分 | 6 孔板 | 12 孔板") as a mix card. The first column names the component; a cell holding a
 * chip keeps it; "10 µL" becomes a fixed amount; columns marked for a system option become one value per option.
 */
export function recipeTableToMix(table: Extract<ProtocolContentBlock, { type: 'table' }>, newId: (prefix: string) => string, systems?: ProtocolSystems): { block: ProtocolMix; parameters: Parameter[] } {
  const parameters: Parameter[] = [];
  const valueColumns = table.rows[0]?.map((_, index) => index).filter(index => index > 0) ?? [];
  const systemColumns = valueColumns.filter(index => table.columnConditions?.[index]);
  const components = table.rows.slice(1).flatMap(row => {
    const name = row[0]?.replace(/\{\{[\w-]+\}\}/g, '').trim();
    if (!name) return [];
    const cells = valueColumns.map(index => row[index]?.trim() ?? '');
    const chip = chipReferenceId(cells[0] ?? '');
    if (chip && valueColumns.length === 1 && !systemColumns.length) return [{ id: newId('component'), name, amount: `{{${chip}}}`, mode: 'premix' as const }];
    if (valueColumns.length > 1 && systemColumns.length !== valueColumns.length) throw new Error('请先为每个用量列指定体系；原表格已保留。 / Assign a system to each amount column before conversion.');
    let parameter: Parameter;
    if (systemColumns.length) {
      const values = systemColumns.flatMap(index => {
        const id = chipReferenceId(row[index] ?? '');
        const quantity = id ? undefined : cellQuantity(row[index] ?? '');
        const source = id ? systems?.parameters.find(p => p.id === id)?.source : { kind: 'fixed' as const, value: quantity?.value ?? null, unit: quantity?.unit ?? 'µL' };
        if (!source || (source.kind !== 'fixed' && source.kind !== 'lookup')) throw new Error('此列引用未确定的参数或计算结果；请保留原表格。 / This column references a missing, runtime or calculated amount; keep the original table.');
        const rows = source.kind === 'lookup' ? source.values : [{ ...source, when: { all: [] } }];
        return rows.map(value => ({ ...value, when: { ...value.when, all: [...(value.when.all ?? []), table.columnConditions![index]!] } }));
      });
      const unit = values.find(value => value.value !== null)?.unit ?? 'µL';
      parameter = { ...newMixParameter(newId, name, null, unit), source: { kind: 'lookup', values: values.map(value => ({ id: newId('value'), when: value.when, value: value.value === null ? null : convert(value.value, value.unit, unit), unit })) } };
    } else {
      const quantity = cellQuantity(cells[0] ?? '');
      parameter = newMixParameter(newId, name, quantity?.value ?? null, quantity?.unit ?? 'µL');
    }
    parameters.push(parameter);
    return [{ id: newId('component'), name, amount: `{{${parameter.id}}}`, mode: 'premix' as const }];
  });
  return { block: { id: newId('mix'), type: 'mix', title: table.caption?.trim() || '预混液', per: '反应', overagePercent: 10, minPipetteUl: 0.5, components }, parameters };
}

/** One line of a mix card for plain text and exports; chips in `amount` read as whatever they were rendered to. */
export function mixSummary(mix: ProtocolMix) {
  const per = mixPer(mix);
  return `${mixTitle(mix)}（每${per}，余量 ${mix.overagePercent}%）：${mix.components.map(component => `${component.name ? component.name + ' ' : ''}${component.amount}${component.mode === 'separate' ? '（单独加）' : ''}`).join('；')}`;
}

/** The counts a run of this Protocol needs: each mix card's (反应数, 孔数…), and 反应数 for material amounts written outside mix cards. */
export function runQuantityLabels(document: { sections: Array<{ blocks: ProtocolContentBlock[] }>; systems?: ProtocolSystems }) {
  const blocks = document.sections.flatMap(section => section.blocks);
  const mixes = blocks.filter((block): block is ProtocolMix => block.type === 'mix');
  const inMixes = new Set(mixes.flatMap(mix => mix.components.flatMap(component => chipReferenceId(component.amount) ?? [])));
  const referenced = referencedChips(blocks.filter(block => block.type !== 'mix'));
  const loose = document.systems?.parameters.some(p => p.materialRef && !p.perRun && referenced.has(p.id) && !inMixes.has(p.id));
  return [...new Set([...mixes.map(mixQuantityLabel), ...(loose ? ['反应数'] : [])])];
}

/** What a Protocol uses per reaction, read from its chips: material-linked amounts and every mix card component, with the step they are in. */
export function protocolUsage(document: { sections: Array<{ key: string; blocks: ProtocolContentBlock[] }>; systems?: ProtocolSystems }, steps: Array<{ order: number; content_blocks?: ProtocolContentBlock[]; title: string }>) {
  const rows: Array<{ key: string; name: string; amount: string; basis: string; step: number }> = [];
  for (const step of steps) {
    const blocks = step.content_blocks ?? [];
    const mixes = blocks.filter((block): block is ProtocolMix => block.type === 'mix');
    const inMixes = new Set<string>();
    for (const mix of mixes) for (const component of mix.components) {
      const id = chipReferenceId(component.amount);
      if (id) inMixes.add(id);
      const parameter = id ? document.systems?.parameters.find(p => p.id === id) : undefined;
      const name = parameter?.materialRef?.name ?? (component.name.trim() || parameter?.label.trim());
      if (name) rows.push({ key: `${step.order}:${mix.id}:${component.id}`, name, amount: component.amount, basis: `Per ${mixPerText(mixPer(mix))} · ${mixTitle(mix)}`, step: step.order });
    }
    for (const id of referencedChips([step.title, ...blocks.filter(block => block.type !== 'mix')])) {
      const parameter = document.systems?.parameters.find(p => p.id === id);
      if (!parameter?.materialRef || inMixes.has(id) || !isMaterialAmount(parameter.unit)) continue;
      rows.push({ key: `${step.order}:${id}`, name: parameter.materialRef.name, amount: `{{${id}}}`, basis: parameter.perRun ? 'Total this run' : 'Per reaction', step: step.order });
    }
  }
  return rows;
}
