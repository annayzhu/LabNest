/**
 * Chinese for the import preview of docs/modules/import/preview-edit-20261031/PLAN.md (Q215–Q224), and for the checks
 * the structured import runs, which were English only. Spread into zhUi before the inventory table.
 */
export const importZh: Record<string, string> = {
  // Q215 names: “字段映射” is gone; the result of a preview is the import preview.
  "Preview import": "预览导入",
  "Column headers": "表头对应",
  "Column in the file": "文件中的列",
  "Columns recognised": "已认出的列",
  "Basics": "基本信息",

  // Q216–Q219 editing in the preview
  "Changed here": "已改",
  "Restore the file’s values": "恢复为文件中的值",
  "Add a record": "添加一条",
  "Document sections are edited in the editor after importing.": "正文导入后在编辑器里改。",
  "Finish or cancel the open record first.": "请先完成或取消正在编辑的记录。",
  "Checking the changes…": "正在重新检查…",
  "Nothing is saved until you import. The file is kept as the source, and each record notes what was changed here.": "点导入之前什么都不会保存。原文件留作来源，每条记录会注明在这里改过什么。",
  "Every record was removed; there is nothing left to import.": "所有记录都已移除，没有可导入的内容。",
  "The preview changes do not match this file. Preview it again.": "预览里的修改与这个文件对不上，请重新预览。",
  "Records can be added only to a table file.": "只有表格文件可以添加记录。",
  "Invalid preview changes.": "预览里的修改无法读取。",
  "Add a line": "添加一行",

  // Choosing and checking the file
  "Choose an import file.": "请选择导入文件。",
  "The selected file is empty.": "所选文件是空的。",
  "The selected file exceeds the 25 MB upload limit.": "所选文件超过 25 MB 上限。",
  "Drop one structured import file at a time.": "一次只能拖入一个导入文件。",
  "No data rows were found in the import file.": "文件里没有数据行。",
  "A single structured import is limited to 500 records.": "一次最多导入 500 条记录。",
  "This exact source file has already been imported.": "这个文件已经导入过了。",
  "The selected file changed after preview. Preview it again before importing.": "预览之后文件有变化，请重新预览后再导入。",
  "The file, filename or import decision changed, or the preview expired. Preview it again before importing.": "文件、文件名或导入规则已变化，或预览已过期。请重新预览后再导入。",
  "The import no longer passes validation.": "导入内容没有通过再次检查。",
  "The structured import failed.": "导入失败。",

  // Checks on a record
  "Research Plan code must use RP- followed by at least three digits.": "研究方案编号须为 RP- 加至少三位数字。",
  "Protocol code must use PRT- followed by at least six digits.": "实验规程编号须为 PRT- 加至少六位数字。",
  "Experiment code must use EXP- followed by at least three digits.": "实验编号须为 EXP- 加至少三位数字。",
  "A Project-scoped Protocol requires a resolvable Project.": "限定项目的实验规程需要一个能找到的项目。",
  "Version must look like 0.1 or 1.0.": "版本须写成 0.1 或 1.0 这样的格式。",
  "Period start must not be after period end.": "开始日期不能晚于结束日期。",
  "A Result Template key was supplied without a template snapshot; the imported Result remains untyped.": "填了结果模板代码但没有模板快照，导入的结果不套用模板。",
  "Package count must be an integer from 0 to 1000.": "按容器管理时，数量须为 0 到 1000 的整数。",
  "Freeze-thaw count must be a non-negative integer.": "冻融次数须为不小于 0 的整数。",
  "Existing Inventory ID was not found; no name-based matching is performed.": "没有找到这个已有库存 ID；不会按名称去匹配。",

  // Names used in the checks
  "Research Plan": "研究方案",
  "Inventory location": "库位",
  "Inventory Item name": "物品名称",
  "Quoted amount": "报价金额",
  "Record kind": "记录用途",

  // Field names that had no Chinese
  "Protocol codes": "实验规程编号",
  "Primary Protocol code": "主要实验规程编号",
  "Research Plan codes": "研究方案编号",
  "Primary Research Plan codes": "主要研究方案编号",
  "Structured document JSON": "结构化文档 JSON",
  "First Protocol code": "首个实验规程编号",
  "Supporting Protocol codes": "辅助实验规程编号",
  "Research Plan name": "研究计划名称",
  "Method sources & versions": "方法来源与版本",
  "Result Template key": "结果模板代码",
  "Template instance key": "模板实例代码",
  "Template instance label": "模板实例名称",
  "Template values JSON": "模板数值 JSON",
  "Template snapshot JSON": "模板快照 JSON",
  "Template validation status": "模板校验状态",
  "Source type": "来源类型",
  "Quality status": "质量状态",
  "Text value": "文本值",
  "Analysis method": "分析方法",
  "Tool": "工具",
  "Executive summary": "摘要",
  "Research question & design": "研究问题与设计",
  "Methods & execution": "方法与执行",
  "Results & evidence": "结果与证据",
  "Limitations & next steps": "局限与下一步",

  // Purchases: English field names, Chinese as the purchases pages say it
  "Import purchases": "导入实际购买",
  "Purchase or quote": "记录用途",
  "Actual purchase": "实际购买",
  "Price quote": "报价",
  "Quoted total": "报价总金额",
  "Actual total": "实际总金额",
  "Purchase status": "购买状态",
  "Invoice status": "发票状态",
  "Invoice to follow": "待补",
  "Invoice in hand": "已备齐",
  "No invoice needed": "无需发票",
};

const recordKinds: Record<string, string> = {
  Project: "项目",
  "Research Plan": "研究方案",
  Protocol: "实验规程",
  Experiment: "实验",
  "Inventory location": "库位",
  "Inventory Item": "库存物品",
  "Research Plans": "研究方案",
  Reports: "报告",
  Results: "结果",
};

/**
 * Import messages with a name, number or field in them. `zh` gives the Chinese of a field name or a whole message; a
 * general pattern (“X is required.”) answers only when it knows X, so other modules' messages are left to them.
 */
export function translateImportDynamic(value: string, zh: (text: string) => string): string | undefined {
  let match: RegExpMatchArray | null;
  const known = (label: string) => {
    const translated = zh(label);
    return translated !== label ? translated : undefined;
  };
  if ((match = value.match(/^Import preview · (\d+) records?$/))) return `导入预览 · ${match[1]} 条`;
  if ((match = value.match(/^(\d+) recognised · (\d+) not imported$/))) return `已认出 ${match[1]} 列 · 不导入 ${match[2]} 列`;
  if ((match = value.match(/^Import (\d+) records?$/))) return `导入 ${match[1]} 条`;
  if ((match = value.match(/^New record (\d+)$/))) return `新增记录 ${match[1]}`;
  if ((match = value.match(/^More fields · (\d+)$/))) return `更多字段 · ${match[1]} 项`;
  if ((match = value.match(/^Raw data · (\d+)$/))) return `原始数据 · ${match[1]} 项`;
  if ((match = value.match(/^Import column “([\s\S]+)” as$/))) return `“${match[1]}”列导入为`;
  if ((match = value.match(/^The file says “([\s\S]*)”\.$/))) return `文件中写的是“${match[1]}”。`;
  if ((match = value.match(/^([\s\S]+) — not on the list$/))) return `${match[1]}（不在列表中）`;
  if ((match = value.match(/^AI matched (\d+) more columns?; check them under Column headers\.$/))) return `AI 又对应了 ${match[1]} 列，请在“表头对应”里核对。`;
  if ((match = value.match(/^Line (\d+): ([\s\S]+)$/))) return `第 ${match[1]} 行：${zh(match[2])}`;
  if ((match = value.match(/^Unmapped columns retained outside the import: ([\s\S]+)\.$/))) return `这些列没有对应项，不会导入：${match[1]}。`;
  if ((match = value.match(/^Multiple source columns map to (.+); choose one source\.$/))) return `有多列都对应到“${zh(match[1])}”，请只保留一列。`;
  if ((match = value.match(/^Use one of the supported formats: (.+)\.$/))) return `请使用以下格式之一：${match[1]}。`;
  if ((match = value.match(/^(Project|Research Plan|Protocol|Experiment|Inventory location) “([\s\S]*)” was not found\.$/))) return `没有找到${recordKinds[match[1]]}“${match[2]}”。`;
  if ((match = value.match(/^(Project|Research Plan|Protocol|Experiment|Inventory location) “([\s\S]*)” is ambiguous; use a stable ID or a more specific code\.$/))) return `${recordKinds[match[1]]}“${match[2]}”不唯一，请改用稳定 ID 或更具体的编号。`;
  if ((match = value.match(/^Project “([\s\S]+)” already exists\.$/))) return `项目“${match[1]}”已存在。`;
  if ((match = value.match(/^Project “([\s\S]+)” is duplicated in this file\.$/))) return `项目“${match[1]}”在文件里重复。`;
  if ((match = value.match(/^This (Research Plan|Protocol|Experiment|Inventory Item) is duplicated in the import file\.$/))) return `这个${recordKinds[match[1]]}在文件里重复。`;
  if ((match = value.match(/^Replace the template (.+) before importing\.$/))) return `导入前请替换模板里的${zh(match[1])}。`;
  if ((match = value.match(/^Aliquot code (.+) already exists\.$/))) return `分装编号 ${match[1]} 已存在。`;
  if ((match = value.match(/^([A-Z]+-\d+) already exists\.$/))) return `${match[1]} 已存在。`;
  if ((match = value.match(/^(.+) version (.+) was not found\.$/))) return `没有找到 ${match[1]} 的 ${match[2]} 版。`;
  if ((match = value.match(/^Declared status “(.+)” is retained in the source file; imported (Research Plans|Reports) start as Draft\.$/))) return `文件里写的状态“${match[1]}”只留在源文件中，导入的${recordKinds[match[2]]}一律从草稿开始。`;
  if ((match = value.match(/^Declared record status “(.+)” is retained in the source file; imported Results start as Draft\.$/))) return `文件里写的记录状态“${match[1]}”只留在源文件中，导入的结果一律从草稿开始。`;
  if ((match = value.match(/^Declared state (\S+) \/ (\S+) is retained in the source file; imported Experiments start as Planned \/ Draft\.$/))) return `文件里写的状态 ${match[1]} / ${match[2]} 只留在源文件中，导入的实验一律从“已计划 / 草稿”开始。`;
  if ((match = value.match(/^Template key (.+) was normalized to (.+)\.$/))) return `模板代码 ${match[1]} 已规范为 ${match[2]}。`;
  if ((match = value.match(/^Category “([\s\S]+)” is not an inventory type or 大类; the product will be To be classified\.$/))) return `“${match[1]}”不是库存类型或大类，产品会归入“待分类”。`;
  let label: string | undefined;
  if ((match = value.match(/^(.+) is required\.$/)) && (label = known(match[1]))) return `请填写${label}。`;
  if ((match = value.match(/^(.+) must be a finite number\.$/)) && (label = known(match[1]))) return `${label}须为数字。`;
  if ((match = value.match(/^(.+) is not a valid date\.$/)) && (label = known(match[1]))) return `${label}不是有效日期，请写成 YYYY-MM-DD。`;
  if ((match = value.match(/^(.+) must be one of: (.+)\.$/)) && (label = known(match[1]))) return `${label}只能是：${match[2]}。`;
  if ((match = value.match(/^(.+) cannot be negative\.$/)) && (label = known(match[1]))) return `${label}不能为负数。`;
  if ((match = value.match(/^(.+) must be a number greater than 0\.$/)) && (label = known(match[1]))) return `${label}须为大于 0 的数字。`;
  if ((match = value.match(/^(.+) must be an amount with at most two decimals\.$/)) && (label = known(match[1]))) return `${label}须为最多两位小数的金额。`;
  return undefined;
}
