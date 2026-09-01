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
        { type: "heading2", content: [{ text: "RNA extraction", bold: true, fontSizePt: 12 }], lineHeight: 1.5, fontFamily: "serif" },
        { type: "paragraph", content: [{ text: "Keep samples cold.", italic: true, color: "risk", fontSizePt: 11 }] },
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
