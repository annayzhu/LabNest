import { exportProtocolDocx } from "./protocol-docx-export";
import { createProtocolTemplateDocument } from "./protocol-document";
import { systemTableCaptions } from './protocol-system-tables';

export const protocolDocxTemplateTitle = "请填写实验规程标题 / Replace with Protocol title";
export const protocolDocxTemplateEnglishTitle = "Replace with English title (optional)";
export const protocolDocxTemplateFilename = "LabNest_Protocol_Import_Template_v0.2_Draft.docx";

export function isUnfilledProtocolDocxTemplateTitle(title: string) {
  return title === protocolDocxTemplateTitle
    || /replace with protocol title|请填写实验规程标题/i.test(title);
}

export function exportProtocolDocxTemplate() {
  const document = createProtocolTemplateDocument();
  const steps = document.sections.find((section) => section.key === "steps");

  // A blank rich-text paragraph keeps the section editable without creating a
  // synthetic numbered step when the DOCX is imported again.
  if (steps) {
    steps.blocks = [{
      id: "steps-rich-1",
      type: "rich_text",
      nodes: [{ type: "paragraph", content: [{ text: "" }] }],
    }];
  }

  return exportProtocolDocx({
    canonicalTitle: protocolDocxTemplateTitle,
    englishTitle: protocolDocxTemplateEnglishTitle,
    availability: "draft",
    reviewStage: "draft",
    displayVersion: "0.2",
    scope: "general",
    tags: [],
    templateMode: true,
  }, document);
}

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
