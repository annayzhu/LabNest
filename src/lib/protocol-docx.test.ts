import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
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
import { normalizeResultTemplate, resultTemplateFieldsToRows } from "./result-templates";

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

  it("recognizes Word checklist controls, checklist styles and list paragraphs in Steps", () => {
    const checklistXml = xml.replace(
      "<w:p><w:r><w:t>☐ Mix gently.</w:t></w:r></w:p>",
      `<w:p><w:pPr><w:pStyle w:val="Checklist"/></w:pPr><w:r><w:t>Seed cells.</w:t></w:r></w:p>
       <w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>Add transfection mix.</w:t></w:r></w:p>
       <w:p><w:sdt><w:sdtPr><w14:checkbox xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"/></w:sdtPr><w:sdtContent><w:r><w:t>Change medium.</w:t></w:r></w:sdtContent></w:sdt></w:p>`,
    );

    const parsed = parseProtocolDocumentXml(checklistXml, "PRT-100012_RNA逆转录_v0.1_Active.docx");
    const checklist = parsed.document.sections
      .find((section) => section.key === "steps")!
      .blocks.find((block) => block.type === "checklist");
    expect(checklist).toEqual(expect.objectContaining({
      type: "checklist",
      items: ["Seed cells.", "Add transfection mix.", "Change medium."],
    }));
    expect(parsed.steps[0].description).toBe("Seed cells.\nAdd transfection mix.\nChange medium.");
  });

  it("exports a valid DOCX that can be imported back into the fixed template", () => {
    const document = createProtocolTemplateDocument();
    document.sections.find((section) => section.key === "description")!.blocks = [
      { id: "description-rich", type: "rich_text", nodes: [{ type: "paragraph", content: [{ text: "Quantify RNA", bold: true, fontSizePt: 14 }, { text: " before reverse transcription." }], lineHeight: 1.5 }] },
    ];
    document.sections.find((section) => section.key === "steps")!.blocks = [
      { id: "step-heading", type: "heading", text: "1. Prepare reaction" },
      { id: "step-detail", type: "rich_text", nodes: [{ type: "paragraph", content: [{ text: "Mix gently and keep on ice." }] }] },
    ];
    const resultTemplate = normalizeResultTemplate({ result_type: "qpcr_expression", templateKey: "qpcr_expression", resultKind: "assay", cardinality: "per_run", fields: [{ key: "reference_gene", label: "Reference gene", dataType: "text", required: true }], datasets: [{ key: "cq_table", label: "Cq table", required: true, columns: [{ key: "sample_id", label: "Sample ID", dataType: "text", required: true }] }], artifacts: [{ key: "raw_export", label: "Raw export", kind: "file", required: true }], view: { preset: "qpcr" } });
    document.sections.find((section) => section.key === "result_templates")!.blocks = [{ id: "result-template-rich", type: "table", caption: resultTemplate.result_type, rows: resultTemplateFieldsToRows(resultTemplate), resultTemplate }];
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
    const documentXml = strFromU8(unzipSync(bytes)["word/document.xml"]);
    const parsed = parseProtocolDocxBytes(bytes, protocolDocxFilename(identity));
    expect(documentXml).toContain('<w:sz w:val="28"/><w:szCs w:val="28"/>');
    expect(documentXml).toContain('w:line="360" w:lineRule="auto"');
    expect(parsed.humanCode).toBe(identity.humanCode);
    expect(parsed.canonicalTitle).toBe(identity.canonicalTitle);
    expect(parsed.displayVersion).toBe("1.0");
    expect(parsed.tags).toEqual(["RNA", "qPCR"]);
    expect(parsed.steps[0]).toEqual(expect.objectContaining({ title: "Prepare reaction", description: "Mix gently and keep on ice." }));
    expect(parsed.resultTemplates[0]).toMatchObject({ result_type: "qpcr_expression", templateKey: "qpcr_expression", cardinality: "per_run", view: { preset: "qpcr" } });
    expect(parsed.resultTemplates[0].datasets?.[0]).toMatchObject({ key: "cq_table", required: true });
    expect(parsed.resultTemplates[0].artifacts?.[0]).toMatchObject({ key: "raw_export", kind: "file" });
    expect(parsed.document.sections).toHaveLength(7);
  });

  it("provides a blank import template that round-trips without fake steps or result fields", () => {
    const bytes = exportProtocolDocxTemplate();
    const parsed = parseProtocolDocxBytes(bytes, protocolDocxTemplateFilename);

    expect(parsed.canonicalTitle).toBe(protocolDocxTemplateTitle);
    expect(isUnfilledProtocolDocxTemplateTitle(parsed.canonicalTitle)).toBe(true);
    expect(parsed.englishTitle).toBeUndefined();
    expect(parsed.document.sections).toHaveLength(7);
    expect(parsed.steps).toEqual([]);
    expect(parsed.materials).toEqual([]);
    expect(parsed.resultTemplates[0]).toEqual(expect.objectContaining({ fields: [] }));
  });

  it("matches the reference protocol typography, grayscale tables, and page furniture", () => {
    const archive = unzipSync(exportProtocolDocxTemplate());
    const documentXml = strFromU8(archive["word/document.xml"]);
    const stylesXml = strFromU8(archive["word/styles.xml"]);

    expect(archive["word/header1.xml"]).toBeDefined();
    expect(archive["word/footer1.xml"]).toBeDefined();
    expect(documentXml).toContain('<w:tblW w:w="9576" w:type="dxa"/>');
    expect(documentXml).toContain('<w:tblLayout w:type="fixed"/>');
    expect(documentXml).toContain('<w:gridCol w:w="2183"/><w:gridCol w:w="7393"/>');
    expect(documentXml).toContain('<w:shd w:val="clear" w:color="auto" w:fill="D9D9D9"/>');
    expect(documentXml).toContain('<w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/>');
    expect(documentXml).toContain("<w:tblHeader/>");
    expect(documentXml).toContain("<w:cantSplit/>");
    expect(documentXml).toContain('<w:pgMar w:top="1020" w:right="1077" w:bottom="964" w:left="1077"');
    expect(stylesXml).toMatch(/w:style w:type="paragraph" w:styleId="Title"[\s\S]*?w:eastAsia="Microsoft YaHei"[\s\S]*?<w:sz w:val="24"/);
    expect(stylesXml).toContain('w:eastAsia="SimSun"');
    expect(stylesXml).toContain('<w:spacing w:after="60" w:line="240" w:lineRule="auto"/>');
    expect(stylesXml).not.toContain('w:line="300"');
  });

  it("exports warning and critical callouts in red and preserves their tone on import", () => {
    const document = createProtocolTemplateDocument();
    document.sections.find((section) => section.key === "steps")!.blocks = [
      { id: "risk-1", type: "callout", tone: "warning", text: "Keep the reaction on ice." },
      { id: "risk-2", type: "callout", tone: "critical", text: "Do not interchange enzyme mixes." },
    ];
    const identity = {
      humanCode: "PRT-100099",
      canonicalTitle: "RNA逆转录",
      availability: "active",
      reviewStage: "reviewed",
      displayVersion: "1.0",
      scope: "general",
      tags: ["RNA"],
    };

    const bytes = exportProtocolDocx(identity, document);
    const documentXml = strFromU8(unzipSync(bytes)["word/document.xml"]);
    const parsed = parseProtocolDocxBytes(bytes, protocolDocxFilename(identity));
    const callouts = parsed.document.sections
      .find((section) => section.key === "steps")!
      .blocks.filter((block) => block.type === "callout");

    expect(documentXml).toContain('w:fill="FDECEC"');
    expect(documentXml).toContain('<w:color w:val="C00000"/>');
    expect(callouts).toEqual([
      expect.objectContaining({ type: "callout", tone: "warning" }),
      expect.objectContaining({ type: "callout", tone: "critical" }),
    ]);
  });
});
