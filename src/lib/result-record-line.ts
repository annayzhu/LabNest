import { normalizeUnit, units } from './calculators/quantities';
import { normalizeResultTemplate, stableResultKey } from './result-templates';
import type { ResultTemplate, ResultTemplateArtifact, ResultTemplateDataset, ResultTemplateField } from './types';

/**
 * A result template written the way people write it: "记录：浓度 ng/µL、A260/280、胶图" and, for one row per sample,
 * "每个样本：样本名、Ct 值". LabNest reads the items, keeps the author's words, and builds the template from them.
 */
export type RecordLines = NonNullable<ResultTemplate['authored']>;

export const parseRecordItems = (line: string) => splitItems(line).map(parseRecordItem);

/**
 * The template a pair of lines describes. Settings made under 高级设置 (roles, ranges, descriptions) stay on the items
 * they belong to as long as the item keeps its key and its type.
 */
export function templateFromRecordLines(lines: RecordLines, previous?: ResultTemplate, title?: string): ResultTemplate {
  const items = parseRecordItems(lines.record ?? '');
  const fieldItems = items.filter((item): item is Extract<RecordItem, { kind: 'field' }> => item.kind === 'field');
  const artifactItems = items.filter((item): item is Extract<RecordItem, { kind: 'artifact' }> => item.kind === 'artifact');
  const oldFields = (previous?.fields ?? []).map(field => ({ ...field, key: field.key ?? stableResultKey(field.label ?? field.name ?? 'field'), label: field.label ?? field.name ?? '' }));
  const fields: ResultTemplateField[] = keyed(fieldItems, oldFields, index => oldFields[index]?.dataType === fieldItems[index].dataType).map(item => {
    const old = oldFields.find(field => field.key === item.key);
    const kept = old && (old.dataType ?? old.type) === item.dataType ? old : undefined;
    return {
      ...(kept ?? {}), key: item.key, label: item.label, name: item.label, dataType: item.dataType, type: item.dataType,
      unit: item.unit, options: item.options, required: item.required,
      semanticRole: kept?.semanticRole ?? (item.dataType === 'number' ? 'measurement' : 'annotation'),
    };
  });
  const oldArtifacts = previous?.artifacts ?? [];
  const artifacts: ResultTemplateArtifact[] = keyed(artifactItems, oldArtifacts, index => oldArtifacts[index]?.kind === artifactItems[index].artifactKind)
    .map(item => ({ key: item.key, label: item.label, kind: item.artifactKind, required: item.required }));
  const columns = parseRecordItems(lines.perSample ?? '').map(item => item.kind === 'field' ? item : { kind: 'field' as const, label: item.label, dataType: 'text' as const, required: item.required });
  const oldDataset = previous?.datasets?.[0];
  const datasets: ResultTemplateDataset[] = columns.length ? [{
    key: oldDataset?.key ?? 'samples', label: oldDataset?.label ?? '每个样本', required: oldDataset?.required ?? false,
    columns: keyed(columns, oldDataset?.columns.map(column => ({ key: column.key, label: column.label ?? column.key })) ?? [], () => true).map(column => ({
      key: column.key, label: column.label, dataType: column.dataType === 'select' ? 'category' : column.dataType, required: column.required, unit: column.unit,
      semanticRole: column.dataType === 'number' ? 'measurement' : 'label',
    })),
  }] : [];
  const name = title?.trim() || previous?.title || '结果记录';
  // An empty template takes its kind and view from what it now records; a filled one keeps what was chosen for it.
  const fresh = !previous || (!previous.fields.length && !previous.artifacts?.length && !previous.datasets?.length);
  return normalizeResultTemplate({
    ...(previous ?? {}), result_type: previous?.result_type ?? name, templateKey: previous?.templateKey, title: name,
    fields, artifacts, datasets, cardinality: datasets.length ? 'per_sample' : previous?.cardinality ?? 'per_run',
    ...(fresh ? { resultKind: undefined, view: { charts: previous?.view?.charts ?? [] } } : {}),
    authored: { record: lines.record?.trim() || undefined, perSample: lines.perSample?.trim() || undefined },
  });
}

/** The lines for a template, as the author wrote them, or rebuilt from its items for a template made the old way. */
export function recordLinesOf(template: ResultTemplate): RecordLines {
  if (template.authored?.record || template.authored?.perSample) return template.authored;
  const items = [
    ...template.fields.map(field => `${field.label ?? field.name ?? field.key}${unitLabel(field)}${field.required ? '*' : ''}`),
    ...(template.artifacts ?? []).map(artifact => `${artifact.label}${artifact.required ? '*' : ''}`),
  ];
  const columns = template.datasets?.[0]?.columns.map(column => `${column.label ?? column.key}${column.unit ? ` ${column.unit}` : ''}`) ?? [];
  return { record: items.length ? `记录：${items.join('、')}` : undefined, perSample: columns.length ? `每个样本：${columns.join('、')}` : undefined };
}

/** What LabNest understood, one short phrase per item: "浓度 · 数值 · ng/µL". */
export function readBackTemplate(template: ResultTemplate) {
  const phrase = (label: string, type: string, extra?: string, required?: boolean) => [label, type, extra].filter(Boolean).join(' · ') + (required ? ' · 必填' : '');
  return {
    items: [
      ...template.fields.map(field => phrase(field.label ?? field.name ?? field.key ?? '', typeWords[field.dataType ?? field.type ?? 'text'] ?? '文字', field.unit ?? field.options?.join('/'), field.required)),
      ...(template.artifacts ?? []).map(artifact => phrase(artifact.label, artifactWords[artifact.kind] ?? '文件', undefined, artifact.required)),
    ],
    perSample: template.datasets?.[0]?.columns.map(column => phrase(column.label ?? column.key, typeWords[column.dataType ?? 'text'] ?? '文字', column.unit)) ?? [],
  };
}

/** A template with nothing to record yet: the editor shows its 记录 line empty, ready to be written. */
export const emptyRecordTemplate = () => templateFromRecordLines({});

/** After a field-by-field edit under 高级设置, the written lines stay only while they still say the same thing. */
export function keepWrittenLines<B extends { resultTemplate?: unknown }>(before: B, after: B): B {
  const template = after.resultTemplate ? normalizeResultTemplate(after.resultTemplate) : undefined;
  if (!template?.authored) return after;
  const rebuilt = (value: unknown) => value ? JSON.stringify(recordLinesOf({ ...normalizeResultTemplate(value), authored: undefined })) : '';
  return rebuilt(before.resultTemplate) === rebuilt(after.resultTemplate) ? after : { ...after, resultTemplate: { ...template, authored: undefined } };
}

type FieldType = 'text' | 'number' | 'select' | 'boolean' | 'date' | 'datetime';
type RecordItem =
  | { kind: 'field'; label: string; dataType: FieldType; unit?: string; options?: string[]; required: boolean }
  | { kind: 'artifact'; label: string; artifactKind: 'image' | 'file'; required: boolean };

const prefix = /^\s*(?:记录|需记录|要记录|每个样本|每个样品|每样本|每孔|record|per sample)\s*[：:]\s*/i;
const imageWords = /(胶图|照片|图片|图像|截图|影像|显微图|图|image|photo|picture)$/i;
const fileWords = /(原始数据|数据文件|文件|报告|附件|file|raw data)$/i;
const numberWords = /(数|数量|个数|计数|浓度|含量|产量|得率|效率|比值|值|读数|count|ratio|yield|concentration)$/i;
const measureNames = /^(?:A\d{3}\s*\/\s*A?\d{3}|(?:OD|A)\d{3}|Ct|Cq|Tm|RIN|RQN|DIN|pH)$/i;

/** Items of a line, split on 、，,；; but not inside brackets, so "结果（阳性/阴性，可疑）" stays one item. */
function splitItems(text: string) {
  const items: string[] = [];
  let depth = 0, current = '';
  for (const char of text.replace(prefix, '')) {
    if ('（(['.includes(char)) depth += 1;
    if ('）)]'.includes(char)) depth = Math.max(0, depth - 1);
    if (!depth && /[、，,；;\n]/.test(char)) { items.push(current); current = ''; continue; }
    current += char;
  }
  items.push(current);
  return items.map(item => item.trim()).filter(Boolean);
}

/** A registered unit, in its canonical spelling; undefined for anything else. */
function unitOf(text: string) {
  const unit = normalizeUnit(text.trim());
  return unit && units[unit] ? unit : undefined;
}

/** "浓度ng/µL": a unit glued to Chinese text, longest registered spelling first. */
const unitSuffixes = Object.keys(units).filter(unit => /[A-Za-zµ%×°]/.test(unit)).sort((a, b) => b.length - a.length);
function gluedUnit(text: string) {
  const unit = unitSuffixes.find(candidate => text.endsWith(candidate) && /[一-鿿]$/.test(text.slice(0, -candidate.length)));
  return unit ? { label: text.slice(0, -unit.length), unit } : undefined;
}

/** One item: its label as written, and the type its name, unit or options imply. */
function parseRecordItem(raw: string): RecordItem {
  let text = raw.trim(), required = false;
  const marker = text.match(/\s*(?:[*＊]|[（(]必填[）)])\s*$/);
  if (marker) { required = true; text = text.slice(0, marker.index).trim(); }
  let unit: string | undefined, options: string[] | undefined;
  const bracket = text.match(/^(.*?)\s*[（(]([^（()）]+)[）)]\s*$/);
  if (bracket) {
    const inner = bracket[2].trim();
    if (unitOf(inner)) { unit = unitOf(inner); text = bracket[1].trim(); }
    else if (/[/、|，,]/.test(inner)) { options = inner.split(/[/、|，,]/).map(option => option.trim()).filter(Boolean); text = bracket[1].trim(); }
  }
  if (!unit && !options) {
    const space = text.match(/^(.*\S)\s+(\S+)$/);
    if (space && unitOf(space[2]) && !measureNames.test(text)) { unit = unitOf(space[2]); text = space[1]; }
    else { const glued = gluedUnit(text); if (glued) { unit = glued.unit; text = glued.label; } }
  }
  const label = text;
  if (unit) return { kind: 'field', label, dataType: 'number', unit, required };
  if (options?.length) return { kind: 'field', label, dataType: 'select', options, required };
  if (imageWords.test(label)) return { kind: 'artifact', label, artifactKind: 'image', required };
  if (fileWords.test(label)) return { kind: 'artifact', label, artifactKind: 'file', required };
  if (/^(是否|有无)/.test(label) || /[?？]$/.test(label)) return { kind: 'field', label: label.replace(/[?？]$/, ''), dataType: 'boolean', required };
  if (/(日期|date)$/i.test(label)) return { kind: 'field', label, dataType: 'date', required };
  if (/(时间|时刻|time)$/i.test(label)) return { kind: 'field', label, dataType: 'datetime', required };
  if (measureNames.test(label) || numberWords.test(label)) return { kind: 'field', label, dataType: 'number', required };
  return { kind: 'field', label, dataType: 'text', required };
}

/**
 * Keys that survive edits: an item keeps the key of the earlier item with the same label; an item renamed in place
 * (same position, same kind, its old label gone) keeps that item's key; anything new gets a key from its label that no
 * earlier item ever had, so values recorded under a removed item never attach to a new one.
 */
function keyed<T extends { label: string }>(items: T[], previous: Array<{ key: string; label: string }>, sameKind: (index: number) => boolean) {
  const used = new Set<number>();
  const keys = items.map(item => {
    const match = previous.findIndex((old, index) => !used.has(index) && old.label === item.label);
    if (match < 0) return undefined;
    used.add(match);
    return previous[match].key;
  });
  items.forEach((_, index) => {
    if (keys[index] || !previous[index] || used.has(index) || !sameKind(index)) return;
    used.add(index);
    keys[index] = previous[index].key;
  });
  const taken = new Set([...previous.map(old => old.key), ...keys.filter((key): key is string => Boolean(key))]);
  return items.map((item, index) => {
    let key = keys[index];
    if (!key) {
      const base = stableResultKey(item.label, `item_${index + 1}`);
      key = base;
      for (let n = 2; taken.has(key); n += 1) key = `${base}_${n}`;
      taken.add(key);
    }
    return { ...item, key };
  });
}

const unitLabel = (item: { unit?: string; options?: string[] }) => item.unit ? ` ${item.unit}` : item.options?.length ? `（${item.options.join('/')}）` : '';

const typeWords: Record<string, string> = { text: '文字', number: '数值', select: '选项', boolean: '是否', date: '日期', datetime: '时间', 'attachment[]': '附件', category: '分类' };
const artifactWords = { image: '图片', file: '文件', video: '视频' } as const;
