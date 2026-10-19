import { exportProtocolDocx } from "./protocol-docx-export";
import { createEmptyProtocolDocument, createProtocolTemplateDocument, type ProtocolContentBlock, type ProtocolDocument, type ProtocolSectionKey } from "./protocol-document";
import { sectionTitles } from './protocol-habit-text';
import { systemTableCaptions } from './protocol-system-tables';

export const protocolDocxTemplateTitle = "请填写实验规程标题 / Replace with Protocol title";
export const protocolDocxTemplateEnglishTitle = "Replace with English title (optional)";
export const protocolDocxTemplateFilename = "LabNest_Protocol_Template_v1.0.docx";

export function isUnfilledProtocolDocxTemplateTitle(title: string) {
  return title === protocolDocxTemplateTitle
    || /replace with protocol title|请填写实验规程标题/i.test(title);
}


/**
 * The Word template: a Protocol written the way people write one. Numbered steps with amounts as written, a "体系：…" line
 * for the systems that "350/600 µL" follows, a "仅…：" step, and "记录：…" for what to record. Import reads exactly this.
 */
function createProtocolHabitTemplateDocument(): ProtocolDocument {
  const document = createEmptyProtocolDocument();
  for (const section of document.sections) section.title = sectionTitles[section.key];
  const section = (key: ProtocolSectionKey) => document.sections.find((item) => item.key === key)!;
  const text = (id: string, value: string): ProtocolContentBlock => ({ id, type: "text", text: value });
  section("description").blocks = [text("description-1", "写法示例，不是实验操作建议。请替换为你的规程：一步一段，数值直接写；不同体系写“350/600 µL”，并在第一步前写一行“体系：…”；只对部分样本的操作写“仅…：”；要记录的写在“结果”里：“记录：…”。")];
  section("purpose").blocks = [text("purpose-1", "例：从培养细胞中提取总 RNA，用于 qPCR。")];
  section("background").blocks = [text("background-1", "原理、依据或注意事项，可以留空。")];
  section("material").blocks = [{ id: "material-1", type: "table", rows: [["名称", "用量", "说明"], ["Buffer RL", "350/600 µL", "按体系"], ["无水乙醇", "与上清等体积", ""], ["RNase-free 水", "50 µL", "洗脱"]] }];
  section("steps").blocks = [
    text("steps-0", "体系：350 µL / 600 µL"),
    text("steps-1", "1. 加入 Buffer RL 350/600 µL，涡旋混匀 15 s。"),
    text("steps-2", "2. 仅富脂样本：加入氯仿 200 µL，剧烈振荡 15 s。"),
    text("steps-3", "3. 12,000 ×g 离心 2 min，将上清转入新的 1.5 mL 离心管。"),
    text("steps-4", "4. 加入与上清等体积的无水乙醇，混匀后转入吸附柱。"),
    text("steps-5", "5. 室温静置 5 min，12,000 ×g 离心 1 min，弃滤液。"),
  ];
  section("result_templates").blocks = [text("result-0", "RNA 质检"), text("result-1", "记录：浓度 ng/µL、A260/280、A260/230、胶图"), text("result-2", "每个样本：样本名、浓度 ng/µL")];
  return document;
}

export function exportProtocolDocxTemplate() {
  return exportProtocolDocx({
    canonicalTitle: protocolDocxTemplateTitle,
    englishTitle: protocolDocxTemplateEnglishTitle,
    availability: "draft",
    reviewStage: "draft",
    displayVersion: "0.1",
    scope: "general",
    tags: [],
    templateMode: true,
  }, createProtocolHabitTemplateDocument());
}

/*
 * Fixtures: files written from these older templates still import, and the step example also seeds
 * scripts/seed-protocol-consistency.ts.
 */

/** A structural authoring example, not a wet-lab protocol or vendor recommendation. */
export function createProtocolExecutionExampleDocument() {
  const document=createProtocolTemplateDocument();document.executionConfirmed=true;
  document.sections.find(section=>section.key==='steps')!.blocks=[
    {id:'example-info',type:'text',text:'结构示例：用量依据、适用条件与参考资料放在说明块，不产生执行勾选。此文件不提供科研操作参数。',execution:{role:'info'}},
    {id:'example-a',type:'heading',text:'准备样本',execution:{role:'step',stepId:'example-operation-a',title:'准备样本'}},
    {id:'example-body-a',type:'rich_text',nodes:[{type:'paragraph',content:[{text:'在这里填写同一操作的说明、参数和警告。'}]},{type:'bullet',content:[{text:'普通检查项是本操作的说明，不是第二个独立步骤。'}]}],execution:{role:'detail',stepId:'example-operation-a'}},
    {id:'example-b',type:'heading',text:'记录观察',execution:{role:'step',stepId:'example-operation-b',title:'记录观察'}},
    {id:'example-table',type:'table',rows:[['记录字段','实际观察'],['样本标识','待填写']],execution:{role:'detail',stepId:'example-operation-b'}},
  ];return document;
}
export function exportProtocolExecutionExample(){return exportProtocolDocx({canonicalTitle:'执行步骤结构示例（非科研操作方案）',availability:'draft',reviewStage:'draft',displayVersion:'0.3',scope:'general',tags:[]},createProtocolExecutionExampleDocument());}

/** Editable tables, not hidden metadata, are authoritative after editing this Word template. */
export function exportProtocolSystemsTemplate() {
  const document = createProtocolTemplateDocument();
  document.sections.find(section => section.key === 'description')!.blocks = [
    { id: 'systems-guide', type: 'text', text: '多体系填写模板（软件示例，不是实验操作建议）。替换标题、参数和操作。保留三张定义表的表题及表头；标识使用英文字母、数字、下划线或短横线。条件写为 volume=small；多个条件用 & 连接。空条件表示通用，空量值表示待填写，不能当作零。正文以 {{参数标识}} 引用量值；不要按体系体积推算其他参数。导入后逐项核对并确认步骤。执行范围 group 表示每组分别执行，experiment 表示全实验一次；共同操作必须对各组具有一致内容和参数。复杂互斥分支、计算器及组合限制请在编辑器配置。' },
    { id: 'system-options', type: 'table', caption: systemTableCaptions.dimensions, rows: [
      ['维度标识', '维度名称', '选项标识', '选项名称'],
      ['volume', '体积体系', 'small', '350 µL'], ['volume', '体积体系', 'large', '600 µL'],
      ['sample', '样本属性', 'ordinary', '普通样本'], ['sample', '样本属性', 'fat', '富脂样本'],
    ] },
    { id: 'system-parameters', type: 'table', caption: systemTableCaptions.parameters, rows: [
      ['参数标识', '参数名称', '单位', '适用条件', '量值'],
      ['proteinase', 'Proteinase K', 'µL', 'volume=small', '50'],
      ['proteinase', 'Proteinase K', 'µL', 'volume=large', '80'],
      ['incubation', '共同时间', 'min', '', '10'],
    ] },
  ];
  document.sections.find(section => section.key === 'steps')!.blocks = [{ id: 'system-operations', type: 'table', caption: systemTableCaptions.operations, rows: [
    ['操作标识', '操作标题', '正文', '适用条件', '引用参数（分号分隔）', '计时参数', '执行范围（group/experiment）'],
    ['prepare', '共同准备', '核对样本标识与原始说明。', '', '', '', 'experiment'],
    ['add', '加入试剂', '加入 {{proteinase}}。示例数值应以正式说明书核对。', '', 'proteinase', '', 'group'],
    ['wait', '共同等待', '按原方案等待 {{incubation}}；计时结束后由操作者确认完成。', '', 'incubation', 'incubation', 'group'],
  ] }];
  return exportProtocolDocx({ canonicalTitle: protocolDocxTemplateTitle, availability: 'draft', reviewStage: 'draft', displayVersion: '0.4', scope: 'general', tags: [], templateMode: true }, document);
}
