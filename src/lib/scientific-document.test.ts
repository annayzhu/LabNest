import { describe, expect, it } from "vitest";
import { createScientificDocument, normalizeResearchPlanDocument, normalizeScientificDocument, researchPlanSections, scientificDocumentFromStructuredRecord } from "./scientific-document";

describe("Research Plan scientific document", () => {
  it("creates the current template modules without persisting compatibility aliases", () => {
    const document = createScientificDocument(researchPlanSections);

    expect(document.sections.map((section) => section.key)).toEqual([
      "design",
      "material_methods",
      "acceptance_criteria",
      "constraints",
      "references",
    ]);
    expect(document.sections[0]).toEqual({ key: "design", title: "Design", blocks: [] });
    expect(document.sections[1]).toEqual({ key: "material_methods", title: "Material & methods", blocks: [] });
  });

  it("migrates legacy Variables & controls content into Material & methods", () => {
    const document = normalizeScientificDocument({
      schemaVersion: 1,
      sections: [{
        key: "variables",
        title: "Variables & controls",
        blocks: [{ id: "legacy-variables", type: "text", text: "Treatment and vehicle control groups." }],
      }],
    }, researchPlanSections);

    expect(document.sections[1]).toEqual({
      key: "material_methods",
      title: "Material & methods",
      blocks: [{ id: "legacy-variables", type: "text", text: "Treatment and vehicle control groups." }],
    });
  });

  it("moves legacy plain-text Design into the structured Design section", () => {
    const document = normalizeResearchPlanDocument(null, "Randomized, blinded comparison with three biological replicates.");

    expect(document.sections[0]).toEqual({
      key: "design",
      title: "Design",
      blocks: [{
        id: "design-legacy-1",
        type: "text",
        text: "Randomized, blinded comparison with three biological replicates.",
      }],
    });
  });

  it("keeps structured Design content ahead of the legacy fallback", () => {
    const document = normalizeResearchPlanDocument({
      schemaVersion: 1,
      sections: [{
        key: "design",
        title: "Design",
        blocks: [{ id: "design-current-1", type: "checklist", items: ["Randomize plates", "Blind image scoring"] }],
      }],
    }, "Legacy design text.");

    expect(document.sections[0].blocks).toEqual([
      { id: "design-current-1", type: "checklist", items: ["Randomize plates", "Blind image scoring"] },
    ]);
  });

  it("upgrades a legacy imported Markdown table into native text and table blocks", () => {
    const document = normalizeResearchPlanDocument({
      schemaVersion: 1,
      sections: [{
        key: "design",
        title: "Design",
        blocks: [{
          id: "design-import-1",
          type: "text",
          text: "【实验一】细胞质量控制\n\n| 细胞 | 分组 | 检测指标 | 检测方法 |\n| --- | --- | --- | --- |\n| A549、NCI-H596 | 无 | 细胞活率 | 支原体检测 |\n\n记录细胞来源与批次。",
        }],
      }],
    });

    expect(document.sections[0].blocks).toEqual([
      expect.objectContaining({ type: "text", text: "【实验一】细胞质量控制" }),
      expect.objectContaining({
        type: "table",
        rows: [
          ["细胞", "分组", "检测指标", "检测方法"],
          ["A549、NCI-H596", "无", "细胞活率", "支原体检测"],
        ],
      }),
      expect.objectContaining({ type: "text", text: "记录细胞来源与批次。" }),
    ]);
  });

  it("creates native table blocks directly from structured import fields", () => {
    const document = scientificDocumentFromStructuredRecord(researchPlanSections, {
      design: "1. 质量控制\n\n| Cell | Group |\n| --- | --- |\n| A549 | Control |",
    }, { design: "design" });

    expect(document.sections[0].blocks.map((block) => block.type)).toEqual(["text", "table"]);
    expect(document.sections[0].blocks[1]).toEqual(expect.objectContaining({ rows: [["Cell", "Group"], ["A549", "Control"]] }));
  });
});
