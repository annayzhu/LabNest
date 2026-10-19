import { normalizeResultTemplate, normalizeResultValues, resultDatasetValuesFromResultValues } from './result-templates';
import type { ScientificContentBlock, ScientificDocument } from './scientific-document';

const qualityLabels: Record<string, string> = { not_assessed: '未评估', pass: '合格', warning: '需注意', fail: '不合格' };

/**
 * One run's part of a report: its title and Protocol, then what the Experiment record holds for this run (each step,
 * the system chosen and the values entered), then its deviations.
 */
export function experimentReportBlocks(input: { key: string; title: string; runCode?: string | null; methods: string[]; record: ScientificDocument }): ScientificContentBlock[] {
  const section = (key: string) => input.record.sections.find(item => item.key === key)?.blocks ?? [];
  const blocks: ScientificContentBlock[] = [{ id: `${input.key}-title`, type: 'heading', text: `${input.runCode ? `${input.runCode} · ` : ''}${input.title}` }];
  if (input.methods.length) blocks.push({ id: `${input.key}-methods`, type: 'text', text: `规程：${input.methods.join('；')}` });
  const execution = copied(section('execution'), input.key);
  blocks.push(...(execution.length ? execution : [{ id: `${input.key}-empty`, type: 'text' as const, text: '还没有执行记录。' }]));
  const deviations = copied(section('deviations'), input.key);
  if (deviations.length) blocks.push({ id: `${input.key}-deviations`, type: 'text', text: '偏差与事件' }, ...deviations);
  return blocks;
}

/** One result's part of a report: its values with units (per-sample tables too), its quality status and its summary. */
export function resultReportBlocks(input: {
  key: string; title: string; qualityStatus: string; numericValue?: number | null; textValue?: string | null; unit?: string | null; sampleLabel?: string | null;
  template: unknown; values: unknown; summaryBlocks: ScientificContentBlock[];
}): ScientificContentBlock[] {
  const template = normalizeResultTemplate(input.template);
  const values = normalizeResultValues(input.values);
  const rows = template.fields.flatMap(field => recorded(values[field.key ?? '']) ? [[field.label || field.name || field.key || '', shown(values[field.key ?? '']), field.unit ?? '']] : []);
  const single = input.numericValue ?? input.textValue;
  if (!rows.length && recorded(single)) rows.push([input.sampleLabel || '数值', shown(single), input.unit ?? '']);
  const datasetRows = resultDatasetValuesFromResultValues(input.values);
  const datasets = (template.datasets ?? []).flatMap(dataset => {
    const filled = (datasetRows[dataset.key] ?? []).filter(row => dataset.columns.some(column => recorded(row[column.key])));
    if (!filled.length) return [];
    const header = dataset.columns.map(column => column.unit ? `${column.label}（${column.unit}）` : column.label);
    return [{ id: `${input.key}-dataset-${dataset.key}`, type: 'table' as const, caption: dataset.label, rows: [header, ...filled.map(row => dataset.columns.map(column => recorded(row[column.key]) ? shown(row[column.key]) : ''))] }];
  });
  const blocks: ScientificContentBlock[] = [{ id: `${input.key}-title`, type: 'heading', text: input.title }];
  if (rows.length) blocks.push({ id: `${input.key}-values`, type: 'table', rows: [['项目', '数值', '单位'], ...rows] });
  blocks.push(...datasets);
  if (!rows.length && !datasets.length) blocks.push({ id: `${input.key}-empty`, type: 'text', text: '还没有填写数值。' });
  blocks.push({ id: `${input.key}-quality`, type: 'text', text: `质量：${qualityLabels[input.qualityStatus] ?? input.qualityStatus}` });
  blocks.push(...copied(input.summaryBlocks, input.key));
  return blocks;
}

const recorded = (value: unknown) => value !== undefined && value !== null && value !== '' && !(Array.isArray(value) && !value.length);
const shown = (value: unknown) => Array.isArray(value) ? value.join('、') : typeof value === 'boolean' ? (value ? '是' : '否') : typeof value === 'object' ? JSON.stringify(value) : String(value);

/**
 * Blocks copied into a report, renamed so ids stay unique. Photos and datasets stay in their record, and so do the steps
 * a run did not do (another system's, folded away in the Experiment record).
 */
function copied(blocks: ScientificContentBlock[], key: string): ScientificContentBlock[] {
  return blocks.filter(block => block.type !== 'media' && block.type !== 'dataset' && !block.execution?.fold)
    .map(block => ({ ...Object.fromEntries(Object.entries(block).filter(([field]) => field !== 'execution')), id: `${key}-${block.id}` }) as ScientificContentBlock);
}
