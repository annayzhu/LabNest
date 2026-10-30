import { convert, normalizeUnit, unitAliases, units } from './calculators/quantities';
import { formatQuantity } from './calculators/quantity-format';
import { chipSymbols, type chipKinds, type ProtocolCondition, type ProtocolSystems, type toolKinds } from './protocol-systems-schema';

/** What a parameter chip measures. Inferred from its unit; unitless kinds are chosen explicitly. */
export type ChipKind = typeof chipKinds[number];
export type ToolKind = typeof toolKinds[number];
type Parameter = ProtocolSystems['parameters'][number];
type Tool = NonNullable<ProtocolSystems['tools']>[number];
type Resolved = { status: string; value?: number; unit: string };

export const chipKindLabels: Record<ChipKind, string> = {
  volume: '体积', mass: '质量', amount: '物质的量', concentration: '浓度', time: '时间', temperature: '温度', rcf: '离心力', speed: '转速',
  ph: 'pH', voltage: '电压', current: '电流', pressure: '压力', electrical: '电参数', count: '次数', percent: '比例', other: '参数',
};
/** Each tool's fields in display order; the first unit is the default when inserted from the menu. */
export const toolSpecs: Record<ToolKind, { label: string; fields: Array<{ key: string; label: string; units: string[]; optional?: boolean }> }> = {
  centrifuge: { label: '离心', fields: [{ key: 'speed', label: '离心力／转速', units: ['×g', 'rpm'] }, { key: 'time', label: '时间', units: ['min', 's', 'h'] }, { key: 'temperature', label: '温度', units: ['°C'], optional: true }] },
  mix: { label: '混匀', fields: [{ key: 'count', label: '次数', units: ['次'], optional: true }, { key: 'time', label: '时间', units: ['s', 'min'], optional: true }] },
  incubate: { label: '孵育', fields: [{ key: 'temperature', label: '温度', units: ['°C'] }, { key: 'time', label: '时间', units: ['min', 'h', 's'] }, { key: 'speed', label: '摇速', units: ['rpm'], optional: true }] },
  shake: { label: '摇床', fields: [{ key: 'speed', label: '摇速', units: ['rpm'] }, { key: 'time', label: '时间', units: ['min', 'h'] }, { key: 'temperature', label: '温度', units: ['°C'], optional: true }] },
  vacuum: { label: '真空', fields: [{ key: 'pressure', label: '压力', units: ['mbar', 'kPa', 'Pa', 'Torr', 'psi'] }, { key: 'time', label: '时间', units: ['min', 's'], optional: true }] },
  electrophoresis: { label: '电泳', fields: [{ key: 'voltage', label: '电压', units: ['V'] }, { key: 'current', label: '电流', units: ['mA'], optional: true }, { key: 'time', label: '时间', units: ['min', 'h'] }] },
  electroporation: { label: '电转', fields: [{ key: 'voltage', label: '电压', units: ['V', 'kV'] }, { key: 'capacitance', label: '电容', units: ['µF'], optional: true }, { key: 'resistance', label: '电阻', units: ['Ω'], optional: true }, { key: 'pulse', label: '脉冲', units: ['ms'], optional: true }] },
  gas: { label: '气体', fields: [{ key: 'co2', label: 'CO₂', units: ['%'] }, { key: 'o2', label: 'O₂', units: ['%'], optional: true }] },
  dark: { label: '避光', fields: [] },
  gradient: { label: '梯度', fields: [{ key: 'from', label: '起始', units: ['°C', '%'] }, { key: 'to', label: '终止', units: ['°C', '%'] }, { key: 'time', label: '时间', units: ['min'], optional: true }] },
};

export const chipSymbolGlyphs: Record<typeof chipSymbols[number], string> = { triangle: '▲', square: '■', circle: '●', diamond: '◆', star: '★', 'triangle-open': '△', 'square-open': '□', 'circle-open': '○', 'diamond-open': '◇', 'star-open': '☆' };
export const chipToneCount = 5;
/** `key` is `dimensionId:optionId`. */
export type OptionMark = { key: string; glyph?: string; symbol?: typeof chipSymbols[number]; tone: number; label: string; condition: boolean; negated?: boolean; any?: boolean };
/**
 * System options get a unique symbol and colour: the author's choices first, the rest in authoring order.
 * Colours repeat only past the palette; the symbol and the text label still tell options apart. Conditions are named, not symbolized.
 */
export function optionMarks(systems: Pick<ProtocolSystems, 'dimensions'>): Map<string, OptionMark> {
  const marks = new Map<string, OptionMark>();
  const options = systems.dimensions.flatMap(d => d.kind === 'condition' ? [] : d.options);
  const freeSymbols = chipSymbols.filter(symbol => !options.some(o => o.symbol === symbol));
  const freeTones = Array.from({ length: chipToneCount }, (_, tone) => tone).filter(tone => !options.some(o => o.tone === tone));
  let nextSymbol = 0, nextTone = 0, order = 0;
  for (const d of systems.dimensions) for (const o of d.options) {
    const key = `${d.id}:${o.id}`;
    if (d.kind === 'condition') { marks.set(key, { key, tone: 0, label: o.label, condition: true }); continue; }
    const symbol = o.symbol ?? freeSymbols[nextSymbol++] ?? chipSymbols[order % chipSymbols.length];
    const tone = o.tone ?? freeTones[nextTone++] ?? order % chipToneCount;
    marks.set(key, { key, symbol, glyph: chipSymbolGlyphs[symbol], tone, label: o.label, condition: false });
    order += 1;
  }
  return marks;
}

export function parameterDisplayName(parameter: Pick<Parameter, 'label' | 'unit' | 'kind' | 'materialRef'>) {
  return parameter.label.trim() || parameter.materialRef?.name || chipKindLabels[parameter.kind ?? chipKindForUnit(parameter.unit)];
}

/** A chip's full name where it is read alone (a record, a field list): "离心 · 时间" for a tool field, otherwise its name. */
export function parameterLongName(parameter: Parameter, systems: Pick<ProtocolSystems, 'tools'>) {
  const tool = parameter.ownerToolId ? systems.tools?.find(t => t.id === parameter.ownerToolId) : undefined;
  const field = tool?.fields.find(f => f.parameterId === parameter.id);
  return tool ? `${tool.method?.trim() || toolSpecs[tool.kind].label} · ${toolSpecs[tool.kind].fields.find(f => f.key === field?.key)?.label ?? parameterDisplayName(parameter)}` : parameterDisplayName(parameter);
}

const superscript = (exponent: number) => String(exponent).replace(/[-0-9]/g, digit => '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'['-0123456789'.indexOf(digit)]);
// Cell numbers and titers read as 247,500 or 2.5×10⁶, the way they are written at the bench.
const countLike = (unit: string) => ['cells', 'cell-concentration', 'TU/mL', 'IU/mL', 'PFU/mL', 'TCID50/mL', 'VG/mL'].includes(units[normalizeUnit(unit)]?.dimension ?? '');
/** How a number reads in a chip: two decimals at most (the record keeps the exact value); calculated results are first cut to four significant figures. */
function numberText(value: number, unit: string, calculated = false) {
  if (calculated) value = Number(value.toPrecision(4));
  if (countLike(unit) && Math.abs(value) >= 1e6) {
    const exponent = Math.floor(Math.log10(Math.abs(value)));
    return `${formatQuantity(Number((value / 10 ** exponent).toPrecision(3)))}×10${superscript(exponent)}`;
  }
  return (['×g', 'rpm'].includes(unit) || countLike(unit)) && Math.abs(value) >= 1000 ? value.toLocaleString('en', { maximumFractionDigits: 2 }) : formatQuantity(value);
}
/** A value with its unit as a chip reads it: "247,500 cells/mL", "5.333 mL". */
export function chipAmount(value: number, unit: string, calculated = false) {
  return formatChipValue(numberText(value, unit, calculated), unit);
}
/** Where a unit sits: "pH 7.4" and "MOI 5" lead with it, "75%" and "10×" join it to the number, "50 µL" follows after a space. */
export function unitPlacement(unit: string): 'before' | 'joined' | 'after' {
  return unit === 'pH' || unit === 'MOI' ? 'before' : unit === '%' || unit === '×' ? 'joined' : 'after';
}
/** "50 µL", "37 °C", "75%", "pH 7.4", "10×", "MOI 5", "12,000 ×g": values already in `unit`. */
export function formatChipValue(values: string, unit: string) {
  const placement = unitPlacement(unit);
  return placement === 'before' ? `${unit} ${values}` : placement === 'joined' ? `${values}${unit}` : `${values} ${unit}`;
}
function conditionMarks(when: ProtocolCondition, marks: Map<string, OptionMark>): OptionMark[] {
  const mark = (p: { dimensionId: string; optionId: string }, negated = false): OptionMark => ({ ...(marks.get(`${p.dimensionId}:${p.optionId}`) ?? { key: `${p.dimensionId}:${p.optionId}`, tone: 0, label: '?', condition: true }), ...(negated ? { negated: true } : {}) });
  return [...(when.all ?? []).map(p => mark(p)), ...(when.any ?? []).map(p => ({ ...mark(p), any: true })), ...(when.not ?? []).map(p => mark(p, true))];
}

/** A chip as seen by a reader: shared by the plain-text renderer and the interface chip. */
/** `range`: the source's range ("20–30 min") beside the value this Protocol adopted within it. */
export type ChipView =
  | { type: 'missing' }
  | { type: 'pending'; name: string; reason: '待选体系' | '待填写' | '待选采用值' | '执行时填写' | '计算后确认' | '取值冲突' | '单位不兼容'; unit?: string; kind: ChipKind; displayUnit: string; range?: string }
  | { type: 'value'; values: Array<{ marks: OptionMark[]; text: string }>; unit: string; kind: ChipKind; name?: string; range?: string }
  | { type: 'tool'; tool: ToolKind; label: string; fields: Array<{ key: string; label: string; view: ChipView }> };

export function protocolChipView(id: string, systems: ProtocolSystems | undefined, resolution?: Record<string, Resolved>): ChipView {
  const tool = systems?.tools?.find(t => t.id === id);
  if (tool) return toolView(tool, systems!, resolution);
  const parameter = systems?.parameters.find(p => p.id === id);
  return parameter && systems ? parameterView(parameter, systems, resolution) : { type: 'missing' };
}

/** "20–30 min", or "10 pg – 100 ng" when the two ends use different units. */
export function rangeText(range: NonNullable<Parameter['range']>) {
  if (normalizeUnit(range.min.unit) === normalizeUnit(range.max.unit)) return formatChipValue(`${numberText(range.min.value, range.min.unit)}–${numberText(range.max.value, range.max.unit)}`, range.max.unit);
  return `${chipAmount(range.min.value, range.min.unit)} – ${chipAmount(range.max.value, range.max.unit)}`;
}
/** Whether a value lies within the source range; false when the units cannot be compared. */
export function withinRange(value: number, unit: string, range: NonNullable<Parameter['range']>) {
  try { return convert(range.min.value, range.min.unit, unit) <= value * (1 + 1e-9) && value <= convert(range.max.value, range.max.unit, unit) * (1 + 1e-9); } catch { return false; }
}
/** A value entered at the bench: "执行时填写", or a source range the Protocol has not fixed yet. */
export const filledAtRun = (parameter: Pick<Parameter, 'source' | 'range'>) => parameter.source.kind === 'actual' || (parameter.source.kind === 'fixed' && parameter.source.value === null && Boolean(parameter.range));

function parameterView(parameter: Parameter, systems: ProtocolSystems, resolution?: Record<string, Resolved>): ChipView {
  const name = parameterDisplayName(parameter), kind = parameter.kind ?? chipKindForUnit(parameter.unit), named = parameter.label.trim() || parameter.materialRef?.name;
  const range = parameter.range ? { range: rangeText(parameter.range) } : {};
  const pending = (reason: Extract<ChipView, { type: 'pending' }>['reason'], unit?: string): ChipView => ({ type: 'pending', name, reason, kind, displayUnit: parameter.unit, ...(unit ? { unit } : {}), ...range });
  const value = (text: string, unit: string, marks: OptionMark[] = []): ChipView => ({ type: 'value', values: [{ marks, text }], unit, kind, ...(named ? { name: named } : {}), ...range });
  if (resolution) {
    const resolved = resolution[parameter.id];
    if (resolved?.status === 'resolved') return value(numberText(resolved.value!, resolved.unit, parameter.source.kind === 'calculator'), resolved.unit);
    if (resolved?.status === 'conflict') return pending('取值冲突');
    if (resolved?.status === 'invalid') return pending('单位不兼容');
    if (filledAtRun(parameter)) return pending('执行时填写');
    if (parameter.source.kind === 'calculator') return pending('计算后确认');
    return pending(parameter.source.kind === 'lookup' ? '待选体系' : '待填写');
  }
  const { source } = parameter;
  const amount = (number: number | null, unit: string) => { if (number === null) return '—'; try { return numberText(convert(number, unit, parameter.unit), parameter.unit); } catch { return '单位不兼容'; } };
  if (source.kind === 'fixed') return source.value === null ? pending(parameter.range ? '待选采用值' : '待填写') : value(amount(source.value, source.unit), parameter.unit);
  if (source.kind === 'actual') return pending('执行时填写', parameter.unit);
  if (source.kind === 'calculator') return pending('计算后确认', parameter.unit);
  if (!source.values.length) return pending('待填写');
  const marks = optionMarks(systems);
  return { type: 'value', values: source.values.map(v => ({ marks: conditionMarks(v.when, marks), text: amount(v.value, v.unit) })), unit: parameter.unit, kind, ...(named ? { name: named } : {}), ...range };
}

function toolView(tool: Tool, systems: ProtocolSystems, resolution?: Record<string, Resolved>): ChipView {
  const spec = toolSpecs[tool.kind];
  const fields = spec.fields.flatMap(f => { const id = tool.fields.find(field => field.key === f.key)?.parameterId; const parameter = id && systems.parameters.find(p => p.id === id); return parameter ? [{ key: f.key, label: f.label, view: parameterView(parameter, systems, resolution) }] : []; });
  return { type: 'tool', tool: tool.kind, label: tool.method?.trim() || spec.label, fields };
}

const markText = (marks: OptionMark[]) => marks.map((mark, index) => `${mark.any && marks[index - 1]?.any ? '/' : ''}${mark.negated ? '非' : ''}${mark.glyph ?? mark.label}`).join('');
/** Plain reading text of a chip view; exports, titles and the watch use this. */
export function chipViewText(view: ChipView): string {
  if (view.type === 'missing') return '〔参数已删除〕';
  // A range still to settle reads as the range itself: "20–30 min（执行时填写）".
  if (view.type === 'pending') return view.range ? `${view.range}（${view.reason}）` : `〔${view.name}：${view.reason}${view.unit ? ` · ${view.unit}` : ''}〕`;
  if (view.type === 'value') return `${formatChipValue(view.values.map(v => { const mark = markText(v.marks); return `${mark}${/\p{L}$/u.test(mark) ? ' ' : ''}${v.text}`; }).join(' / '), view.unit)}${view.range ? `（原文 ${view.range}）` : ''}`;
  const field = (key: string) => view.fields.find(f => f.key === key);
  if (view.tool === 'dark') return view.label;
  if (view.tool === 'gas') return view.fields.map(f => `${chipViewText(f.view)} ${f.label}`).join(' · ') || view.label;
  if (view.tool === 'gradient') { const from = field('from'), to = field('to'), time = field('time'); return [`${view.label} ${from ? chipViewText(from.view) : '—'} → ${to ? chipViewText(to.view) : '—'}`, time && chipViewText(time.view)].filter(Boolean).join(' · '); }
  return view.fields.length ? `${view.label} ${view.fields.map(f => chipViewText(f.view)).join(' · ')}` : view.label;
}

/** Reading text of a chip across all systems (`resolution` omitted) or for one adopted plan. Never a raw reference. */
export function protocolChipText(id: string, systems: ProtocolSystems | undefined, resolution?: Record<string, Resolved>): string {
  return chipViewText(protocolChipView(id, systems, resolution));
}

/** The parameter a field holding exactly one chip refers to, e.g. a mix card amount "{{p-1}}". */
export const chipReferenceId = (text: string) => /^\{\{([\w-]+)\}\}$/.exec(text.trim())?.[1];
/** Amounts that are consumed from stock: volumes, masses and amounts of substance. */
export const isMaterialAmount = (unit: string) => ['volume', 'mass', 'amount'].includes(units[normalizeUnit(unit)]?.dimension ?? '');

const chipReference = /\{\{([\w-]+)\}\}/g;
// Identities, links and file names are never authored text, even when they happen to contain braces.
const literalKeys = new Set(['id', 'stepId', 'source_ref', 'attachmentId', 'url', 'link', 'filename', 'rowIds', 'execution']);
/** Rewrite every authored string (text, rich runs, table cells), leaving identities untouched. */
export function mapAuthoredStrings<T>(value: T, replace: (text: string) => string, key = ''): T {
  if (literalKeys.has(key)) return value;
  if (typeof value === 'string') return replace(value) as T;
  if (Array.isArray(value)) return value.map(item => mapAuthoredStrings(item, replace)) as T;
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, mapAuthoredStrings(v, replace, k)])) as T;
  return value;
}
/** Rewrite every chip reference in authored content, leaving identities untouched. */
export function mapChipReferences<T>(value: T, replace: (id: string) => string, key = ''): T {
  return mapAuthoredStrings(value, text => text.replace(chipReference, (_, id: string) => replace(id)), key);
}

/** Before saving: drop typed chips (and tool fields) the author has since deleted. Named parameters always stay. */
export function pruneUnusedChips<T extends { systems?: ProtocolSystems; sections: unknown }>(document: T): T {
  const systems = document.systems;
  if (!systems) return document;
  const used = new Set<string>();
  mapChipReferences(document.sections, id => { used.add(id); return id; });
  for (const rule of systems.rules) [...rule.parameterIds, ...(rule.timerParameterId ? [rule.timerParameterId] : [])].forEach(id => used.add(id));
  const tools = (systems.tools ?? []).filter(tool => used.has(tool.id));
  tools.forEach(tool => tool.fields.forEach(field => used.add(field.parameterId)));
  const keep = (parameter: Parameter) => used.has(parameter.id) || (!parameter.origin && !parameter.ownerToolId);
  for (const parameter of systems.parameters.filter(keep)) if (parameter.source.kind === 'calculator') Object.values(parameter.source.inputs).forEach(id => used.add(id));
  return { ...document, systems: { ...systems, parameters: systems.parameters.filter(keep), ...(systems.tools ? { tools } : {}) } };
}

type Dimension = ProtocolSystems['dimensions'][number];
/** Which dimension "50/80 µL" belongs to: the only one with that many options, the author's remembered answer, or ask. */
export function splitDimension(count: number, systems: Pick<ProtocolSystems, 'dimensions' | 'splitChoices'>): { dimensionId: string } | { candidates: string[] } | { create: true } {
  const candidates = systems.dimensions.filter(d => d.options.length === count).map(d => d.id);
  const remembered = systems.splitChoices?.[count];
  if (remembered && candidates.includes(remembered)) return { dimensionId: remembered };
  return candidates.length === 1 ? { dimensionId: candidates[0] } : candidates.length ? { candidates } : { create: true };
}
export function splitLookupSource(values: number[], unit: string, dimension: Dimension, newId: () => string): Extract<Parameter['source'], { kind: 'lookup' }> {
  return { kind: 'lookup', values: dimension.options.map((option, index) => ({ id: newId(), when: { all: [{ dimensionId: dimension.id, optionId: option.id }] }, value: values[index] ?? null, unit })) };
}

/** Replace every chip reference in plain text with its reading text. */
export function renderChipTokens(text: string, systems: ProtocolSystems | undefined, resolution?: Record<string, Resolved>) {
  return mapChipReferences(text, id => protocolChipText(id, systems, resolution));
}

/** Parameter IDs a chip depends on: itself, or every field of a tool. */
export function chipParameterIds(id: string, systems: ProtocolSystems | undefined): string[] {
  const tool = systems?.tools?.find(t => t.id === id);
  return tool ? tool.fields.map(f => f.parameterId) : [id];
}

const kindByDimension: Record<string, ChipKind> = {
  volume: 'volume', mass: 'mass', amount: 'amount', 'molar-concentration': 'concentration', 'mass-concentration': 'concentration', 'cell-concentration': 'concentration',
  time: 'time', temperature: 'temperature', '×g': 'rcf', rpm: 'speed', acidity: 'ph', voltage: 'voltage', current: 'current', pressure: 'pressure',
  capacitance: 'electrical', resistance: 'electrical', count: 'count', '%': 'percent', cells: 'count', wells: 'count',
  'TU/mL': 'concentration', 'IU/mL': 'concentration', 'PFU/mL': 'concentration', 'TCID50/mL': 'concentration',
};
export function chipKindForUnit(unit: string): ChipKind {
  return kindByDimension[units[normalizeUnit(unit)]?.dimension ?? ''] ?? 'other';
}

// Units that become chips while typing. Lengths, bare amperes and counts stay text: too many false positives.
const typedUnits = ['µL', 'mL', 'nL', 'L', 'kg', 'g', 'mg', 'µg', 'ng', 'pg', 'M', 'mM', 'µM', 'nM', 'pM', 'mg/mL', 'µg/mL', 'ng/mL', 'ng/µL', 'µg/µL', 'g/L', '%',
  'ms', 's', 'min', 'h', 'day', '°C', '×g', 'rpm', 'kV', 'V', 'mV', 'mA', 'µA', 'µF', 'kΩ', 'Ω', 'kPa', 'Pa', 'MPa', 'mbar', 'bar', 'psi', 'Torr', 'mmHg'];
const spellings = [...new Set([...typedUnits, ...Object.keys(unitAliases).filter(alias => typedUnits.includes(unitAliases[alias])),
  'uL', 'μL', 'µl', 'μl', 'ul', 'ML', 'ug', 'μg', 'uM', 'μM', 'ug/mL', 'ng/uL', 'ng/ul', 'uA', 'uF'])]
  .filter(spelling => typedUnits.includes(normalizeUnit(spelling)))
  .sort((a, b) => b.length - a.length);
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const number = String.raw`\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?`;
const trigger = String.raw`[ \t ,，。.;；:：、)）\]】!！?？]|[㐀-鿿]+`;
// A value starts a word: not inside "A549", "v1.2", a range "20–25" or "20-25".
const valueStart = String.raw`(?<![A-Za-z0-9_.\/\-–−])`;
const quantityPattern = new RegExp(String.raw`${valueStart}(([-−]?(?:${number})(?:\s?\/\s?(?:${number}))*)[  ]?(${spellings.map(escape).join('|')}))(?:${trigger})$`, 'u');
// No "." trigger: "pH 7." is still being typed.
const phPattern = new RegExp(String.raw`(?<![A-Za-z0-9_])(pH\s?=?\s?(${number}))(?:[ \t ,，;；:：、)）\]】!！?？]|[㐀-鿿]+)$`, 'u');

// "20-30 min", "20–30 min", "20 ~ 30 min", "20 min - 30 min", "20 to 30 min", "20 至 30 min": one range, not two values.
const rangeSeparator = String.raw`\s*(?:[-–—−~～〜]|至|到)\s*|\s+to\s+`;
const unitSpelling = spellings.map(escape).join('|');
const rangePattern = new RegExp(String.raw`${valueStart}((${number})(?:[  ]?(${unitSpelling}))?(?:${rangeSeparator})(${number})[  ]?(${unitSpelling}))(?:${trigger})$`, 'u');
// The second half typed after a value that is already a chip ("{{p-1}} - 30 min"): the chip becomes the range.
const rangeAfterChipPattern = new RegExp(String.raw`\{\{([\w-]+)\}\}((?:${rangeSeparator})(${number})[  ]?(${unitSpelling}))(?:${trigger})$`, 'u');

/**
 * `source` is exactly what the author typed (to replace in the document); `text` is its display. A range has no value
 * yet (`values` is empty): the author adopts one within it.
 */
export type RecognizedQuantity = { index: number; source: string; text: string; values: number[]; unit: string; kind: ChipKind; range?: NonNullable<Parameter['range']> };
const numeric = (text: string) => Number(text.replace(/,/g, '').replace('−', '-'));
const sameDimension = (a: string, b: string) => normalizeUnit(a) === normalizeUnit(b) || Boolean(units[normalizeUnit(a)] && units[normalizeUnit(a)].dimension === units[normalizeUnit(b)]?.dimension);

/** A range from its two ends: none when the units measure different things or the ends are not in order. */
function quantityRange(min: { value: number; unit: string }, max: { value: number; unit: string }): RecognizedQuantity['range'] {
  if (![min.value, max.value].every(Number.isFinite) || !sameDimension(min.unit, max.unit)) return;
  try { if (convert(min.value, min.unit, max.unit) >= max.value) return; } catch { return; }
  return { min, max };
}

/** Recognize the quantity the author just finished typing; `typed` ends with the character typed after it. */
export function recognizeQuantity(typed: string): RecognizedQuantity | undefined {
  const ph = phPattern.exec(typed);
  if (ph) return { index: ph.index, source: ph[1], text: `pH ${ph[2]}`, values: [numeric(ph[2])], unit: 'pH', kind: 'ph' };
  const ranged = rangePattern.exec(typed);
  if (ranged) {
    const unit = normalizeUnit(ranged[5]);
    const range = quantityRange({ value: numeric(ranged[2]), unit: ranged[3] ? normalizeUnit(ranged[3]) : unit }, { value: numeric(ranged[4]), unit });
    if (range) return { index: ranged.index, source: ranged[1], text: rangeText(range), values: [], unit, kind: chipKindForUnit(unit), range };
  }
  const match = quantityPattern.exec(typed);
  if (!match) return;
  const unit = normalizeUnit(match[3]);
  const values = match[2].split('/').map(part => numeric(part.trim()));
  if (values.some(value => !Number.isFinite(value))) return;
  return { index: match.index, source: match[1], text: `${values.join('/')} ${unit}`, values, unit, kind: chipKindForUnit(unit) };
}

/**
 * " - 30 min" typed right after a chip (the editor reads a chip as "{{id}}"): the upper end of a range whose lower end is
 * that chip. `index` is where the typed end starts, `source` what was typed for it.
 */
export function recognizeRangeEnd(typed: string): { parameterId: string; index: number; source: string; max: { value: number; unit: string } } | undefined {
  const match = rangeAfterChipPattern.exec(typed);
  if (!match) return;
  const value = numeric(match[3]);
  return Number.isFinite(value) ? { parameterId: match[1], index: match.index + `{{${match[1]}}}`.length, source: match[2], max: { value, unit: normalizeUnit(match[4]) } } : undefined;
}

/** A fixed chip turned into a range ending at `max`; undefined when the chip is not a value of the same kind below it. */
export function chipWithRangeEnd(parameter: Parameter, max: { value: number; unit: string }): Parameter | undefined {
  if (parameter.source.kind !== 'fixed' || parameter.source.value === null || parameter.range || parameter.ownerToolId) return;
  const range = quantityRange({ value: parameter.source.value, unit: parameter.source.unit }, max);
  return range ? { ...parameter, unit: max.unit, kind: chipKindForUnit(max.unit), source: { kind: 'fixed', value: null, unit: max.unit }, range } : undefined;
}
