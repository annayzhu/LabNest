import { describe, expect, it } from "vitest";
import { parseProtocolDocumentXml } from "./protocol-docx";
import { parseProtocolDocxBytes } from "./protocol-docx";
import { exportProtocolDocx, protocolDocxFilename } from "./protocol-docx-export";
import {
  exportProtocolDocxTemplate,
  isUnfilledProtocolDocxTemplateTitle,
  protocolDocxTemplateFilename,
  protocolDocxTemplateTitle,
} from "./protocol-docx-template";
import { createProtocolTemplateDocument } from "./protocol-document";

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>PRT-100012</w:t></w:r></w:p>
    <w:p><w:r><w:t>RNA逆转录</w:t></w:r></w:p>
    <w:p><w:r><w:t>Reverse Transcription</w:t></w:r></w:p>
    <w:tbl>
      <w:tr><w:tc><w:p><w:r><w:t>Protocol Title</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>PRT-100012 RNA逆转录</w:t></w:r></w:p></w:tc></w:tr>
      <w:tr><w:tc><w:p><w:r><w:t>Availability</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Active</w:t></w:r></w:p></w:tc></w:tr>
      <w:tr><w:tc><w:p><w:r><w:t>Review stage</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Reviewed</w:t></w:r></w:p></w:tc></w:tr>
      <w:tr><w:tc><w:p><w:r><w:t>Tag</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>RNA; qPCR</w:t></w:r></w:p></w:tc></w:tr>
    </w:tbl>
    <w:p><w:r><w:t>Description</w:t></w:r></w:p>
    <w:p><w:r><w:t>Structured description.</w:t></w:r></w:p>
    <w:p><w:r><w:t>Purpose</w:t></w:r></w:p><w:p><w:r><w:t>Make cDNA.</w:t></w:r></w:p>
    <w:p><w:r><w:t>Background</w:t></w:r></w:p><w:p><w:r><w:t>Background text.</w:t></w:r></w:p>
    <w:p><w:r><w:t>Material</w:t></w:r></w:p>
    <w:tbl><w:tr><w:tc><w:p><w:r><w:t>Name</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Use</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:r><w:t>RT Mix</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Reaction</w:t></w:r></w:p></w:tc></w:tr></w:tbl>
    <w:p><w:r><w:t>Steps</w:t></w:r></w:p><w:p><w:r><w:t>1. Setup</w:t></w:r></w:p><w:p><w:r><w:t>☐ Mix gently.</w:t></w:r></w:p>
    <w:p><w:r><w:t>Result Templates</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Sample ID</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>QC</w:t></w:r></w:p></w:tc></w:tr><w:tr><w:tc><w:p><w:r><w:t></w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t></w:t></w:r></w:p></w:tc></w:tr></w:tbl>
    <w:p><w:r><w:t>Consumption Rules</w:t></w:r></w:p><w:p><w:r><w:t>Per sample.</w:t></w:r></w:p>
  </w:body>
</w:document>`;

describe("Protocol DOCX parser", () => {
  it("preserves fixed sections and mixed content blocks", () => {
    const parsed = parseProtocolDocumentXml(xml, "PRT-100012_RNA逆转录_v0.1_Active.docx");
    expect(parsed.humanCode).toBe("PRT-100012");
    expect(parsed.canonicalTitle).toBe("RNA逆转录");
    expect(parsed.availability).toBe("active");
    expect(parsed.reviewStage).toBe("reviewed");
    expect(parsed.tags).toEqual(["RNA", "qPCR"]);
    expect(parsed.document.sections.map((section) => section.key)).toHaveLength(7);
    expect(parsed.materials[0].name).toBe("RT Mix");
    expect(parsed.steps[0].description).toBe("Mix gently.");
  });

  it("reports filename and internal code mismatches", () => {
    const parsed = parseProtocolDocumentXml(xml, "PRT-100009_RNA逆转录_v0.1_Active.docx");
    expect(parsed.document.importWarnings[0]).toContain("does not match");
  });

  it("exports a valid DOCX that can be imported back into the fixed template", () => {
    const document = createProtocolTemplateDocument();
    document.sections.find((section) => section.key === "description")!.blocks = [
      { id: "description-rich", type: "rich_text", nodes: [{ type: "paragraph", content: [{ text: "Quantify RNA", bold: true }, { text: " before reverse transcription." }] }] },
    ];
    document.sections.find((section) => section.key === "steps")!.blocks = [
      { id: "step-heading", type: "heading", text: "1. Prepare reaction" },
      { id: "step-detail", type: "rich_text", nodes: [{ type: "paragraph", content: [{ text: "Mix gently and keep on ice." }] }] },
    ];
    const identity = {
      humanCode: "PRT-100099",
      canonicalTitle: "RNA逆转录",
      englishTitle: "Reverse Transcription",
      availability: "active",
      reviewStage: "reviewed",
      displayVersion: "1.0",
      scope: "general",
      tags: ["RNA", "qPCR"],
    };

    const bytes = exportProtocolDocx(identity, document);
    const parsed = parseProtocolDocxBytes(bytes, protocolDocxFilename(identity));
    expect(parsed.humanCode).toBe(identity.humanCode);
    expect(parsed.canonicalTitle).toBe(identity.canonicalTitle);
    expect(parsed.displayVersion).toBe("1.0");
    expect(parsed.tags).toEqual(["RNA", "qPCR"]);
    expect(parsed.steps[0]).toEqual(expect.objectContaining({ title: "Prepare reaction", description: "Mix gently and keep on ice." }));
    expect(parsed.resultTemplates[0].result_type).toBe("result_type");
    expect(parsed.document.sections).toHaveLength(7);
  });

  it("provides a blank import template that round-trips without fake steps or result fields", () => {
    const bytes = exportProtocolDocxTemplate();
    const parsed = parseProtocolDocxBytes(bytes, protocolDocxTemplateFilename);

    expect(parsed.canonicalTitle).toBe(protocolDocxTemplateTitle);
    expect(isUnfilledProtocolDocxTemplateTitle(parsed.canonicalTitle)).toBe(true);
    expect(parsed.document.sections).toHaveLength(7);
    expect(parsed.steps).toEqual([]);
    expect(parsed.materials).toEqual([]);
    expect(parsed.resultTemplates[0]).toEqual(expect.objectContaining({ fields: [] }));
  });
});
