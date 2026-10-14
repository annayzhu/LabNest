import type { ProtocolContentBlock, ProtocolDocument } from './protocol-document';
import { protocolSystemsSchema, type ProtocolCondition } from './protocol-systems-schema';
import { validateProtocolSystems } from './structured-protocol';

export const systemTableCaptions = {
  dimensions: '实验体系定义（LabNest v1）',
  parameters: '体系参数定义（LabNest v1）',
  operations: '执行操作定义（LabNest v1）',
} as const;

/** Only explicitly labelled authoring tables are executable definitions. Ordinary tables stay content. */
export function applyProtocolSystemTables(document: ProtocolDocument): boolean {
  const blocks = document.sections.flatMap(section => section.blocks);
  const tables = Object.fromEntries(Object.entries(systemTableCaptions).map(([key, caption]) => {
    const matches = blocks.filter((block): block is Extract<ProtocolContentBlock, { type: 'table' }> => block.type === 'table' && block.caption === caption);
    if (matches.length > 1) throw new Error(`重复的体系定义表：${caption}`);
    return [key, matches[0]];
  }));
  if (!Object.values(tables).some(Boolean)) return false;
  if (!tables.dimensions || !tables.parameters || !tables.operations) throw new Error('多体系模板需要保留体系、参数和执行操作三张定义表。');
  const headers: Record<string, string[]> = {
    dimensions: ['维度标识', '维度名称', '选项标识', '选项名称'],
    parameters: ['参数标识', '参数名称', '单位', '适用条件', '量值'],
    operations: ['操作标识', '操作标题', '正文', '适用条件', '引用参数（分号分隔）', '计时参数'],
  };
  for (const [key, expected] of Object.entries(headers)) if (!expected.every((header, index) => tables[key]!.rows[0]?.[index]?.trim() === header)) throw new Error(`体系定义表的表头被改动，请恢复模板列顺序：${systemTableCaptions[key as keyof typeof systemTableCaptions]}`);
  const condition = (text = ''): ProtocolCondition => ({ all: text.trim() ? text.split('&').map(pair => {
    const parts = pair.trim().split('=').map(value => value.trim());
    if (parts.length !== 2 || !parts.every(Boolean)) throw new Error(`适用条件须写为维度标识=选项标识：${text}`);
    return { dimensionId: parts[0], optionId: parts[1] };
  }) : [] });
  const rows = (key: string) => tables[key]!.rows.slice(1).filter(row => row.some(cell => cell.trim()));
  const dimensions = new Map<string, { id: string; label: string; options: { id: string; label: string }[] }>();
  for (const [id, label, optionId, optionLabel] of rows('dimensions')) {
    const dimension = dimensions.get(id) ?? { id, label, options: [] };
    if (dimension.label !== label) throw new Error(`同一体系维度名称不一致：${id}`);
    dimension.options.push({ id: optionId, label: optionLabel }); dimensions.set(id, dimension);
  }
  const quantities = rows('parameters');
  const parameters = [...new Set(quantities.map(row => row[0]))].map(id => {
    const values = quantities.filter(row => row[0] === id);
    const [, label, unit] = values[0];
    if (values.some(row => row[1] !== label || row[2] !== unit)) throw new Error(`参数名称或单位不一致：${id}`);
    const quantity = (text: string) => {
      if (!text?.trim()) return null;
      const value = Number(text);
      if (!Number.isFinite(value)) throw new Error(`参数 ${id} 的量值不是有限数字：${text}`);
      return value;
    };
    const source = values.length === 1 && !values[0][3]?.trim()
      ? { kind: 'fixed', value: quantity(values[0][4]), unit }
      : { kind: 'lookup', values: values.map((row, index) => ({ id: `${id}-${index + 1}`, when: condition(row[3]), value: quantity(row[4]), unit })) };
    return { id, label, unit, source };
  });
  const operations = rows('operations');
  if (!operations.length) throw new Error('请至少定义一个操作，或使用普通规程模板。');
  const rules = operations.map(([id, , , when, parameterIds, timerParameterId, scope]) => ({
    scope: scope?.trim() || 'group',
    id: `rule-${id}`, target: 'step', targetId: id, when: condition(when),
    parameterIds: (parameterIds ?? '').split(/[;,；，]/).map(value => value.trim()).filter(Boolean),
    ...(timerParameterId?.trim() ? { timerParameterId: timerParameterId.trim() } : {}),
  }));
  if (new Set(operations.map(row => row[0])).size !== operations.length) throw new Error('执行操作标识不能重复。');
  const systems = protocolSystemsSchema.parse({ schemaVersion: 1, dimensions: [...dimensions.values()], parameters, rules, presets: [], restrictions: [] });
  const issues = validateProtocolSystems(systems);
  if (issues.length) throw new Error(issues.map(issue => issue.message).join('；'));
  const operationBlocks: ProtocolContentBlock[] = operations.flatMap(([id, title, text]) => [
    { id: `heading-${id}`, type: 'heading', text: title, execution: { role: 'step', stepId: id, title } },
    { id: `body-${id}`, type: 'text', text, execution: { role: 'detail', stepId: id } },
  ]);
  for (const section of document.sections) section.blocks = section.blocks.flatMap(block => {
    if (block === tables.operations) return operationBlocks;
    return block === tables.dimensions || block === tables.parameters ? [] : [block];
  });
  document.systems = systems;
  document.executionConfirmed = false;
  document.importWarnings.push('已读取多体系定义表；请在预览中核对各体系的值，并在编辑页确认执行步骤后使用。');
  return true;
}
