import { describe, expect, it } from "vitest";
import { createEmptyProtocolDocument, normalizeProtocolDocument, projectProtocolDocument } from "./protocol-document";

describe("Protocol document structured projections", () => {
  it("preserves controlled inline font sizes while normalizing saved content", () => {
    const document = createEmptyProtocolDocument();
    document.sections[0].blocks = [
      { id: "sized-run", type: "rich_text", nodes: [{ type: "paragraph", content: [{ text: "Important", fontSizePt: 14 }], lineHeight: 1.5 }] },
    ];

    const normalized = normalizeProtocolDocument(document);
    const block = normalized?.sections[0].blocks[0];
    expect(block?.type).toBe("rich_text");
    if (block?.type === "rich_text") {
      expect(block.nodes[0].content[0].fontSizePt).toBe(14);
      expect(block.nodes[0].lineHeight).toBe(1.5);
    }
  });

  it("preserves numbered step headings and their following descriptions", () => {
    const document = createEmptyProtocolDocument();
    const steps = document.sections.find((section) => section.key === "steps")!;
    steps.blocks = [
      { id: "step-heading", type: "heading", text: "1. Prepare reaction" },
      { id: "step-text", type: "rich_text", nodes: [{ type: "paragraph", content: [{ text: "Mix gently and keep on ice." }] }] },
      { id: "step-check", type: "checklist", items: ["Confirm the tube is labeled."] },
    ];

    expect(projectProtocolDocument(document).steps).toEqual([expect.objectContaining({
      order: 1,
      title: "Prepare reaction",
      description: "Mix gently and keep on ice.\nConfirm the tube is labeled.",
    })]);
  });

  it("projects materials, equipment, result fields and consumption columns by header", () => {
    const document = createEmptyProtocolDocument();
    document.sections.find((section) => section.key === "material")!.blocks = [
      { id: "materials", type: "table", caption: "Materials", rows: [["Name", "Unit", "Role", "Notes"], ["RT Mix", "µL", "Reaction", "Keep cold"]] },
      { id: "equipment", type: "table", caption: "Equipment", rows: [["Name", "Notes"], ["Thermocycler", "Heated lid"]] },
    ];
    document.sections.find((section) => section.key === "result_templates")!.blocks = [
      { id: "results", type: "table", caption: "RT QC", rows: [["Field", "Type", "Unit", "Required"], ["Concentration", "number", "ng/µL", "Yes"]] },
    ];
    document.sections.find((section) => section.key === "consumption_rules")!.blocks = [
      { id: "consumption", type: "table", rows: [["Formula", "Unit", "Material"], ["sample_count * 4", "µL", "RT Mix"]] },
    ];

    const projected = projectProtocolDocument(document);
    expect(projected.materials[0]).toEqual({ name: "RT Mix", unit: "µL", role: "Reaction", notes: "Keep cold" });
    expect(projected.equipment[0]).toEqual(expect.objectContaining({ name: "Thermocycler", notes: "Heated lid" }));
    expect(projected.resultTemplates[0].fields[0]).toEqual({ name: "Concentration", type: "number", unit: "ng/µL", required: true });
    expect(projected.consumptionRules[0]).toEqual({ material_name: "RT Mix", formula: "sample_count * 4", unit: "µL" });
  });
});
