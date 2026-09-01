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
});
