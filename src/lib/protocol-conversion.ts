import { chipifyText } from './method-design';
import { executionRoleBlocks } from './protocol-execution';
import { projectProtocolDocument, protocolTableColumnIndex, richTextPlainText, type ProtocolContentBlock, type ProtocolDocument, type ProtocolRichTextNode } from './protocol-document';
import { blankProtocolSystems, chipSymbols, type ProtocolSystems } from './protocol-systems-schema';
import { templateFromRecordLines, type RecordLines } from './result-record-line';
import { resultTemplateFieldsToRows } from './result-templates';

export type ConversionSummary = {
  steps: number;
  notes: number;
  /** Each new chip as it reads, e.g. "500 µL" or "350/600 µL". */
  chips: string[];
  /** Sizes left as words, e.g. "1.5 mL" in "1.5 mL 离心管". */
  keptAsText: string[];
  /** Choices declared by a line such as "体系：350 µL / 600 µL". */
  systems: string[];
  /** Steps written as "仅…：", e.g. "第 2 步 · 仅富脂样本". */
  conditions: string[];
  /** Rows of the old formula table now in the material table, and those skipped because the material was already listed. */
  formulaRows: number;
  alreadyListed: string[];
  /** Result templates after conversion, and how many of them came from "记录：…" lines. */
  resultTemplates: number;
  recordLines: number;
};

/** True when the Steps section is not written as step blocks yet. */
export const isLegacyProtocol = (document: ProtocolDocument) =>
  !(document.sections.find(section => section.key === 'steps')?.blocks ?? []).some(block => block.execution?.format === 'block');

// "1." or "1、" opens a step; "3.5 mL" does not.
/**
 * 旧规程转换, and the reading of a Protocol written by habit (a Word file, a pasted text): the Steps section becomes step
 * blocks. Each step of the current reading (headings, numbered lines or checklists) becomes one step block with its own
 * lines and lists; numbers become chips, except container sizes; "体系：A / B" lines declare the systems that "50/80 µL"
 * follows; "仅富脂样本：" limits a step; notes between steps stay notes. "记录：…" lines become result templates. The old
 * formula table's rows, and anything else written under 消耗规则, join the materials ("名称 / 用量 / 说明"). The summary
 * says what moved where. The given document is never changed.
 */
export function convertLegacyProtocol(document: ProtocolDocument, newId: (prefix: string) => string): { document: ProtocolDocument; summary: ConversionSummary } {
  const next: ProtocolDocument = structuredClone(document);
  const systems: ProtocolSystems = next.systems ?? blankProtocolSystems();
  const firstChip = systems.parameters.length;
  const keptAsText: string[] = [], declared: string[] = [], conditions: string[] = [];
  const chip = (text: string) => chipifyText(text, systems, newId, keptAsText);
  const chipLines = (nodes: ProtocolRichTextNode[]) => nodes.map(node => ({ ...node, content: node.content.map(run => run.code || run.link ? run : { ...run, text: chip(run.text) }) }));

  const { blocks } = executionRoleBlocks(markNumberedSteps(document));
  // Declarations first, so every "50/80 µL" below them knows its system.
  const declarations = new Set<ProtocolContentBlock>();
  for (const block of blocks) {
    const lines = block.execution?.role === 'step' ? [] : plainLines(block).filter(line => line.trim());
    const read = lines.length === 1 ? readDeclaration(lines[0]) : undefined;
    if (!read) continue;
    declarations.add(block);
    if (systems.dimensions.some(item => item.label === read.label && item.options.length === read.options.length)) continue;
    const condition = !read.label.endsWith('体系');
    systems.dimensions.push({ id: newId('dimension'), label: read.label, ...(condition ? { kind: 'condition' as const } : {}),
      options: read.options.map((label, index) => ({ id: newId('option'), label, ...(condition ? {} : { symbol: chipSymbols[index % chipSymbols.length], tone: index }) })) });
    declared.push(`${read.label}：${read.options.join(' / ')}`);
  }
  /** "仅X：" on a step: the option named X, or a 是/否 condition named X, as the editor's 仅适用于 menu would make it. */
  const limit = (stepId: string, label: string, order: number) => {
    let dimension = systems.dimensions.find(item => item.options.some(option => option.label === label));
    let option = dimension?.options.find(item => item.label === label);
    if (!dimension || !option) {
      dimension = systems.dimensions.find(item => item.kind === 'condition' && item.label === label) ?? { id: newId('dimension'), label, kind: 'condition', options: [{ id: newId('option'), label: '是' }, { id: newId('option'), label: '否' }] };
      if (!systems.dimensions.includes(dimension)) systems.dimensions.push(dimension);
      option = dimension.options[0];
    }
    systems.rules.push({ id: newId('rule'), target: 'step', targetId: stepId, when: { all: [{ dimensionId: dimension.id, optionId: option.id }] }, parameterIds: [], actualFields: [], optional: false });
    conditions.push(`第 ${order} 步 · 仅${label}`);
  };

  const stepIds = new Map<string, string>();
  // Each written block remembers the source block it came from, so fragments of one list can come back together.
  const out: ProtocolContentBlock[] = [], origin: string[] = [];
  const push = (block: ProtocolContentBlock, from: ProtocolContentBlock) => { out.push(block); origin.push(sourceOf(from)); };
  let notes = 0;
  for (const block of blocks) {
    if (declarations.has(block)) continue;
    if (block.execution?.role === 'step') {
      const stepId = newId('step');
      stepIds.set(block.execution.stepId ?? block.id, stepId);
      const lines = linesOf(block);
      // The first line opens the step: "1." is dropped (steps are numbered for you), "仅…：" becomes the step's scope.
      const [first, ...rest] = lines?.length ? lines : [paragraph(block.execution.title ?? '')];
      const written = first.content.map(run => run.text).join('');
      const numbered = written.match(stepNumber)?.[0].length ?? 0;
      const scope = written.slice(numbered).match(onlyFor);
      if (scope) limit(stepId, scope[1].trim(), stepIds.size);
      const content = dropLeading(first.content, numbered + (scope?.[0].length ?? 0));
      push({ id: stepId, type: 'rich_text', nodes: chipLines([{ ...first, type: 'paragraph', content }, ...rest]), execution: { role: 'step', stepId, format: 'block' } }, block);
      // A step that opened with a table, a picture or a tool keeps it, right under its first line.
      if (!lines) push({ ...structuredClone(block), id: newId('block'), execution: { role: 'detail', stepId } } as ProtocolContentBlock, block);
      continue;
    }
    const stepId = block.execution?.role === 'detail' ? stepIds.get(block.execution.stepId ?? '') : undefined;
    const execution = stepId ? { role: 'detail' as const, stepId } : { role: 'info' as const };
    const last = out.at(-1);
    if (last && origin.at(-1) === sourceOf(block) && last.execution?.role === execution.role && last.execution?.stepId === stepId) {
      if (block.type === 'checklist' && last.type === 'checklist') { last.items.push(...block.items.map(item => stepId ? chip(item) : item)); if (block.itemNodes) last.itemNodes = [...(last.itemNodes ?? []), ...block.itemNodes.map(nodes => stepId ? chipLines(nodes) : structuredClone(nodes))]; continue; }
      if (block.type === 'rich_text' && last.type === 'rich_text') { last.nodes.push(...(stepId ? chipLines(block.nodes) : structuredClone(block.nodes))); continue; }
    }
    if (!stepId) notes += 1;
    const id = newId('block');
    // Step content gets chips; notes between steps keep their words.
    if (stepId && (block.type === 'heading' || block.type === 'text' || block.type === 'rich_text')) push({ id, type: 'rich_text', nodes: chipLines(linesOf(block)!), execution }, block);
    else if (stepId && block.type === 'checklist') push({ ...structuredClone(block), id, items: block.items.map(chip), ...(block.itemNodes ? { itemNodes: block.itemNodes.map(chipLines) } : {}), execution }, block);
    else push({ ...structuredClone(block), id, execution } as ProtocolContentBlock, block);
  }
  next.sections.find(section => section.key === 'steps')!.blocks = out;
  // Scopes set before conversion ("仅…" on a step or a block) follow their step or block to its new id.
  const blockIds = new Map<string, string>();
  out.forEach((block, index) => { if (!blockIds.has(origin[index])) blockIds.set(origin[index], block.id); });
  systems.rules = systems.rules.map(rule => rule.target === 'step' && stepIds.has(rule.targetId) ? { ...rule, targetId: stepIds.get(rule.targetId)! }
    : rule.target === 'block' && blockIds.has(rule.targetId) ? { ...rule, targetId: blockIds.get(rule.targetId)! } : rule);

  // "记录：…" (and a "每个样本：…" under it) become a result template; a short line right above names it.
  const results = next.sections.find(section => section.key === 'result_templates')!;
  const kept: ProtocolContentBlock[] = [];
  let pending: (RecordLines & { title?: string }) | undefined, recordLines = 0;
  const flush = () => {
    if (pending?.record || pending?.perSample) {
      const template = templateFromRecordLines(pending, undefined, pending.title);
      kept.push({ id: newId('result'), type: 'table', caption: template.title, rows: resultTemplateFieldsToRows(template), resultTemplate: template });
      recordLines += 1;
    }
    pending = undefined;
  };
  for (const block of results.blocks) {
    const lines = plainLines(block).filter(line => line.trim());
    if (!lines.length || !lines.every(line => recordLine.test(line))) { flush(); kept.push(block); continue; }
    for (const line of lines) {
      if (/^\s*记录/.test(line)) {
        if (pending?.record) flush();
        const above = pending ? undefined : kept.at(-1);
        const name = above ? plainLines(above).join('').trim() : '';
        const title = name && name.length <= 30 ? name : undefined;
        if (title) kept.pop();
        pending = { ...pending, title: pending?.title ?? title, record: line.trim() };
      } else pending = { ...pending, perSample: line.trim() };
    }
  }
  flush();
  results.blocks = kept;

  // The old formula table: its rows join the materials, unless the material is already listed there. Rows without a
  // formula and anything else written under 消耗规则 move along too, so converting never drops what was written.
  const projection = projectProtocolDocument(document);
  const listed = new Set([...projection.materials, ...projection.equipment].map(item => item.name.trim().toLowerCase()));
  const known = (name: string) => listed.has(name.trim().toLowerCase());
  const rules = projection.consumptionRules;
  const alreadyListed = rules.filter(rule => known(rule.material_name)).map(rule => rule.material_name);
  const consumption = next.sections.find(section => section.key === 'consumption_rules')!;
  const unformulated = consumption.blocks.flatMap(block => {
    if (block.type !== 'table') return [];
    const headers = block.rows[0] ?? [];
    const name = protocolTableColumnIndex(headers, ['material', 'name', '材料', '名称'], 0), formula = protocolTableColumnIndex(headers, ['formula', 'calculation', '公式', '计算'], 1), unit = protocolTableColumnIndex(headers, ['unit', '单位'], 2);
    return block.rows.slice(1).filter(row => row[name]?.trim() && !row[formula]?.trim() && !known(row[name])).map(row => [row[name].trim(), '', row[unit] ?? '']);
  });
  const rows = [...rules.filter(rule => !known(rule.material_name)).map(rule => [rule.material_name, rule.formula, rule.unit]), ...unformulated];
  const material = next.sections.find(section => section.key === 'material')!;
  if (rows.length) material.blocks.push({ id: newId('table'), type: 'table', caption: '材料（来自旧公式表）', rows: [['名称', '用量', '说明'], ...rows] });
  material.blocks.push(...consumption.blocks.filter(block => block.type !== 'table'));
  consumption.blocks = [];

  if (systems.parameters.length || systems.dimensions.length) next.systems = systems;
  next.executionConfirmed = true;
  const chips = systems.parameters.slice(firstChip).map(parameter => parameter.source.kind === 'fixed' ? `${parameter.source.value} ${parameter.source.unit}`
    : parameter.source.kind === 'lookup' ? `${parameter.source.values.map(value => value.value).join('/')} ${parameter.unit}` : parameter.id);
  return { document: next, summary: {
    steps: stepIds.size, notes, chips, keptAsText, systems: declared, conditions, formulaRows: rows.length, alreadyListed,
    resultTemplates: projectProtocolDocument(next).resultTemplates.length, recordLines,
  } };
}

/** One line for the version's change summary and the preview heading. */
export function conversionSummaryText(summary: ConversionSummary) {
  return [`转换为步骤块：${summary.steps} 步`, summary.chips.length ? `${summary.chips.length} 个参数块` : '', summary.systems.length ? `${summary.systems.length} 个体系` : '',
    summary.formulaRows ? `旧公式表 ${summary.formulaRows} 行并入材料表` : ''].filter(Boolean).join('，');
}

const stepNumber = /^\s*(?:\d+\s*(?:[、)）．]|\.(?!\d))|第\s*\d+\s*步\s*[：:、.]?|step\s*\d+\s*[:.)]?)\s*/i;
const numberedLine = /^\s*\d+\s*(?:[、)）．]|\.(?!\d))\s*\S/;
export const onlyFor = /^\s*仅(?:限|对)?\s*([^：:，,。]{1,20}?)\s*[：:]\s*/;
export const recordLine = /^\s*(记录|每个样本|每个样品)\s*[：:]/;
const declaration = /^\s*([^\s：:/／]{0,8}体系|样本类型|样本|样品|分组|组别)\s*[：:]\s*(.+?)\s*$/;

/** "体系：350 µL / 600 µL" or "样本：普通样本 / 富脂样本": a choice made once per run, its options in order. */
function readDeclaration(text: string) {
  const match = text.match(declaration);
  if (!match) return undefined;
  const options = match[2].split(/\s*[/／|]\s*/).map(option => option.trim()).filter(Boolean);
  return options.length >= 2 && options.length <= 6 && options.every(option => option.length <= 24) ? { label: match[1], options } : undefined;
}

const paragraph = (text: string): ProtocolRichTextNode => ({ type: 'paragraph', content: [{ text }] });
/** The fragment's source block: execution fragments of one list or paragraph group are "<id>:<n>". */
const sourceOf = (block: ProtocolContentBlock) => block.id.replace(/:\d+$/, '');
const plainLines = (block: ProtocolContentBlock) => block.type === 'rich_text' ? richTextPlainText(block.nodes).split('\n')
  : block.type === 'heading' || block.type === 'text' ? block.text.split('\n') : [];

/** The runs without their first `count` characters, formatting kept. */
function dropLeading(runs: ProtocolRichTextNode['content'], count: number) {
  const out: ProtocolRichTextNode['content'] = [];
  let left = count;
  for (const run of runs) {
    if (left >= run.text.length) { left -= run.text.length; continue; }
    out.push(left ? { ...run, text: run.text.slice(left) } : run);
    left = 0;
  }
  return out.length ? out : [{ text: '' }];
}

/**
 * Lines written "1. …" open steps, as numbered headings do, whatever paragraph carries them: a Word line, or a LabNest
 * paragraph that came back from Word as plain text. Only Steps sections still without roles are read this way.
 */
function markNumberedSteps(document: ProtocolDocument): ProtocolDocument {
  const steps = document.sections.find(section => section.key === 'steps');
  if (!steps || steps.blocks.every(block => block.execution)) return document;
  const blocks = steps.blocks.map((block): ProtocolContentBlock => {
    if (block.execution) return block;
    if (block.type === 'text' && numberedLine.test(block.text)) return { ...block, type: 'heading' };
    if (block.type === 'rich_text') return { ...block, nodes: block.nodes.map(node => node.type === 'paragraph' && numberedLine.test(node.content.map(run => run.text).join('')) ? { ...node, type: 'heading3' as const } : node) };
    return block;
  });
  return { ...document, sections: document.sections.map(section => section === steps ? { ...section, blocks } : section) };
}

/** A fragment as rich-text lines, whatever kind of block it was. */
function linesOf(block: ProtocolContentBlock): ProtocolRichTextNode[] | undefined {
  if (block.type === 'rich_text') return structuredClone(block.nodes);
  if (block.type === 'heading' || block.type === 'text') return structuredClone(block.nodes ?? [paragraph(block.text)]);
  if (block.type === 'checklist') return block.items.map((item, index) => structuredClone(block.itemNodes?.[index]?.[0] ?? paragraph(item)));
  return undefined;
}
