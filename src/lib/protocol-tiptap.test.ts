import { describe, expect, it } from "vitest";
import { createEmptyProtocolDocument } from "./protocol-document";
import { protocolDocumentToTiptap, tiptapToProtocolDocument } from "./protocol-tiptap";
import { createDefaultResultTemplate, resultTemplateFieldsToRows } from "./result-templates";

describe("Protocol Tiptap compatibility layer", () => {
  it("round-trips legacy rich text and scientific blocks without changing the save contract", () => {
    const document = createEmptyProtocolDocument();
    document.importWarnings = ["Review imported steps."];
    document.sections.find((section) => section.key === "description")!.blocks = [{
      id: "description-rich",
      type: "rich_text",
      nodes: [
        { type: "heading2", content: [{ text: "RNA extraction", bold: true, fontSizePt: 12 }], lineHeight: 1.5, fontFamily: "times-new-roman" },
        { type: "paragraph", content: [{ text: "Keep ", italic: true, color: "risk", fontSizePt: 11 }, { text: "samples", bold: true, fontFamily: "arial" }, { text: " cold.", fontFamily: "labnest-local-fdevice" }] },
      ],
    }];
    document.sections.find((section) => section.key === "material")!.blocks = [{
      id: "material-table",
      type: "table",
      caption: "Materials",
      rows: [["Name", "Unit"], ["Buffer", "mL"]],
      columnWidths: [180, 90],
      cellFontSizesPt: [[10, 10], [9, 9]],
      cellColors: [[null, null], ["risk", null]],
    }];
    document.sections.find((section) => section.key === "steps")!.blocks = [
      { id: "step-heading", type: "heading", text: "1. Prepare sample" },
      { id: "step-checklist", type: "checklist", items: ["Label the tube", "Keep on ice"] },
      { id: "step-timer", type: "timer", label: "Incubate", durationMinutes: 5, notes: "Room temperature" },
    ];
    const template = createDefaultResultTemplate("measurement");
    document.sections.find((section) => section.key === "result_templates")!.blocks = [{
      id: "result-template",
      type: "table",
      caption: template.result_type,
      rows: resultTemplateFieldsToRows(template),
      resultTemplate: template,
    }];

    const roundTrip = tiptapToProtocolDocument(protocolDocumentToTiptap(document), document.importWarnings);
    expect(roundTrip.importWarnings).toEqual(document.importWarnings);
    expect(roundTrip.sections.find((section) => section.key === "description")!.blocks).toEqual(document.sections.find((section) => section.key === "description")!.blocks);
    expect(roundTrip.sections.find((section) => section.key === "material")!.blocks).toEqual(document.sections.find((section) => section.key === "material")!.blocks);
    expect(roundTrip.sections.find((section) => section.key === "steps")!.blocks).toEqual(document.sections.find((section) => section.key === "steps")!.blocks);
    expect(roundTrip.sections.find((section) => section.key === "result_templates")!.blocks).toEqual(document.sections.find((section) => section.key === "result_templates")!.blocks);
  });

  it("round-trips managed attachments and embedded laboratory tools", () => {
    const document = createEmptyProtocolDocument();
    document.sections.find((section) => section.key === "material")!.blocks = [
      {
        id: "image-1",
        type: "media",
        mediaType: "image",
        url: "/api/attachments/attachment-1?inline=1",
        attachmentId: "attachment-1",
        filename: "plate.png",
        caption: "Plate before treatment",
      },
      {
        id: "planner-1",
        type: "embedded_tool",
        sourceKind: "manifest",
        toolId: "free-plate-layout",
        url: "/tools/plate-layout",
        label: "Plate Map Planner",
      },
    ];

    const roundTrip = tiptapToProtocolDocument(protocolDocumentToTiptap(document));
    expect(roundTrip.sections.find((section) => section.key === "material")!.blocks).toEqual(document.sections.find((section) => section.key === "material")!.blocks);
  });

  it("removes a synthetic leading blank while keeping every required section shell", () => {
    const document = createEmptyProtocolDocument();
    document.sections.find((section) => section.key === "purpose")!.blocks = [
      { id: "purpose-rich-1", type: "rich_text", nodes: [{ type: "paragraph", content: [{ text: "" }] }] },
      { id: "purpose", type: "rich_text", nodes: [{ type: "paragraph", content: [{ text: "Measure RNA quality." }] }] },
    ];

    const tiptap = protocolDocumentToTiptap(document);
    const purpose = tiptap.content?.find((node) => node.attrs?.sectionKey === "purpose");
    expect(purpose?.content?.[0]?.attrs?.protocolBlockId).toBe("purpose");

    const restored = tiptapToProtocolDocument({ type: "doc", content: tiptap.content?.filter((node) => node.attrs?.sectionKey !== "background") });
    expect(restored.sections.map((section) => section.key)).toEqual(["description", "purpose", "background", "material", "steps", "result_templates", "consumption_rules"]);
  });

  it("preserves an intentional leading blank that is not the template placeholder", () => {
    const document = createEmptyProtocolDocument();
    document.sections.find((section) => section.key === "purpose")!.blocks = [
      { id: "purpose-user-blank", type: "rich_text", nodes: [{ type: "paragraph", content: [{ text: "" }] }] },
      { id: "purpose-content", type: "rich_text", nodes: [{ type: "paragraph", content: [{ text: "Keep this after the blank" }] }] },
    ];

    const purpose = protocolDocumentToTiptap(document).content?.find((node) => node.attrs?.sectionKey === "purpose");
    expect(purpose?.content).toHaveLength(2);
    expect(purpose?.content?.[0]?.attrs?.protocolBlockId).toBe("purpose-user-blank");
  });
});

it("retains paragraph layout after validation and reopening", () => {
  const document = createEmptyProtocolDocument();
  document.sections[0].blocks = [{id:"layout",type:"rich_text",nodes:[{type:"paragraph",content:[{text:"剂量 5 µL"}]}]}];
  const json=protocolDocumentToTiptap(document);
  Object.assign(json.content![0].content![0].attrs!,{textAlign:"right",documentIndent:2,spaceBeforePt:6,spaceAfterPt:12});
  const saved=tiptapToProtocolDocument(json);
  const reopened=protocolDocumentToTiptap(saved);
  expect(reopened.content![0].content![0].attrs).toMatchObject({textAlign:"right",documentIndent:2,spaceBeforePt:6,spaceAfterPt:12});
});

it('preserves legacy block formatting without changing step source identities',()=>{
 const doc=createEmptyProtocolDocument();doc.sections.find(s=>s.key==='steps')!.blocks=[{id:'h',type:'heading',text:'Prepare'},{id:'t',type:'text',text:'Add 5 µL'},{id:'c',type:'checklist',items:['Confirm']}];
 const json=protocolDocumentToTiptap(doc);const nodes=json.content!.find(n=>n.attrs?.sectionKey==='steps')?.content ?? json.content!.find(n=>n.content?.some(c=>c.attrs?.protocolBlockId==='h'))!.content!;
 nodes[0].attrs={...nodes[0].attrs,textAlign:'center'};nodes[1].attrs={...nodes[1].attrs,documentIndent:2};nodes[2].content![0].content![0].content![0].marks=[{type:'textStyle',attrs:{fontSize:'18pt'}}];
 const saved=tiptapToProtocolDocument(json);const reopened=protocolDocumentToTiptap(saved).content!.find(n=>n.content?.some(c=>c.attrs?.protocolBlockId==='h'))!.content!;
 expect(reopened[0].attrs?.textAlign).toBe('center');expect(reopened[1].attrs?.documentIndent).toBe(2);expect(reopened[2].content![0].content![0].content![0].marks).toContainEqual({type:'textStyle',attrs:{fontSize:'18pt'}});
 expect(saved.sections.find(s=>s.key==='steps')!.blocks.map(b=>[b.id,b.type])).toEqual([['h','heading'],['t','text'],['c','checklist']]);
});

it('keeps nested list content and continuation paragraphs when reopening',()=>{
 const doc=createEmptyProtocolDocument();doc.sections[0].blocks=[{id:'list',type:'rich_text',nodes:[{type:'bullet',content:[{text:'Parent'}]}]}];
 const json=protocolDocumentToTiptap(doc);const item=json.content![0].content![0].content![0];
 item.content!.push({type:'bulletList',content:[{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'Child 5 µL'}]}]}]},{type:'paragraph',content:[{type:'text',text:'Keep on ice'}]});
 const saved=tiptapToProtocolDocument(json);const restored=protocolDocumentToTiptap(saved).content![0].content![0].content![0];
 expect(restored.content?.map(node=>node.type)).toEqual(['paragraph','bulletList','paragraph']);
 expect(JSON.stringify(restored)).toContain('Child 5 µL');expect(JSON.stringify(restored)).toContain('Keep on ice');
});

it('preserves nested checklist details without creating extra confirmation items',()=>{
 const doc=createEmptyProtocolDocument();doc.sections.find(s=>s.key==='steps')!.blocks=[{id:'check',type:'checklist',items:['Parent']}];const json=protocolDocumentToTiptap(doc);
 const item=json.content!.find(n=>n.content?.some(c=>c.type==='taskList'))!.content![0].content![0];
 item.content!.push({type:'taskList',content:[{type:'taskItem',attrs:{checked:false},content:[{type:'paragraph',content:[{type:'text',text:'Child dose 5 µL'}]}]}]},{type:'paragraph',content:[{type:'text',text:'Followup note'}]});
 const saved=tiptapToProtocolDocument(json);const restored=protocolDocumentToTiptap(saved).content!.find(n=>n.content?.some(c=>c.type==='taskList'))!.content![0].content![0];
 expect(restored.content?.map(n=>n.type)).toEqual(['paragraph','taskList','paragraph']);expect(saved.sections.find(s=>s.key==='steps')!.blocks).toHaveLength(1);
});
