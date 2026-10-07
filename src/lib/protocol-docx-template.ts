import { exportProtocolDocx } from "./protocol-docx-export";
import { createProtocolTemplateDocument } from "./protocol-document";

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
