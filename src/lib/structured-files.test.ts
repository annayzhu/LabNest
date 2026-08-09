import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { normalizeProtocolDocument } from "./protocol-document";
import { buildStructuredTemplate, parseStructuredFile } from "./structured-files";
import { structuredModules } from "./structured-modules";

function fileFromBody(body: string | Uint8Array | ArrayBuffer, filename: string, type: string) {
  const part = typeof body === "string" ? body : body instanceof Uint8Array
    ? body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer
    : body;
  return new File([part], filename, { type });
}

describe("structured import files", () => {
  it("maps CSV aliases onto the Project contract", async () => {
    const file = new File([
      "项目名称,研究目的,项目状态,标签\nCHMP2A validation,Validate the candidate mechanism,active,CHMP2A;ESCC\n",
    ], "projects.csv", { type: "text/csv" });

    const parsed = await parseStructuredFile(file, "projects");

    expect(parsed.records).toEqual([expect.objectContaining({
      name: "CHMP2A validation",
      description: "Validate the candidate mechanism",
      status: "active",
      tags: "CHMP2A;ESCC",
    })]);
    expect(parsed.mapping.every((item) => item.target)).toBe(true);
  });

  it("adds controlled Project status choices to the XLSX import template", async () => {
    const template = await buildStructuredTemplate("projects", "xlsx");
    const bytes = template.body instanceof ArrayBuffer
      ? new Uint8Array(template.body)
      : template.body instanceof Uint8Array
        ? template.body
        : new TextEncoder().encode(template.body);
    const files = unzipSync(bytes);
    const importSheet = strFromU8(files["xl/worksheets/sheet1.xml"]!);
    const sharedStrings = strFromU8(files["xl/sharedStrings.xml"]!);

    expect(importSheet).toContain('type="list"');
    expect(importSheet).toContain('sqref="C2:C501"');
    expect(importSheet).toContain("active,paused,completed,archived");
    expect(sharedStrings).toContain("Replace with Project name");
    expect(sharedStrings).toContain("only accepts:");
  });

  it("adds controlled execution and record status choices to the Experiment XLSX template", async () => {
    const template = await buildStructuredTemplate("experiments", "xlsx");
    const bytes = template.body instanceof ArrayBuffer
      ? new Uint8Array(template.body)
      : template.body instanceof Uint8Array
        ? template.body
        : new TextEncoder().encode(template.body);
    const files = unzipSync(bytes);
    const importSheet = strFromU8(files["xl/worksheets/sheet1.xml"]!);
    const sharedStrings = strFromU8(files["xl/sharedStrings.xml"]!);

    expect(importSheet).toContain('<dataValidations count="2">');
    expect(importSheet).toContain('sqref="F2:F501"');
    expect(importSheet).toContain('sqref="G2:G501"');
    expect(importSheet).toContain("planned,running,completed,failed,archived");
    expect(importSheet).toContain("draft,recorded,submitted,reviewed");
    expect(sharedStrings).toContain("Execution status (status) only accepts:");
    expect(sharedStrings).toContain("Record status (recordStatus) only accepts:");
  });

  it("turns the Protocol Markdown template into the fixed seven-section document", async () => {
    const markdown = `---
canonicalTitle: RNA extraction
availability: draft
reviewStage: draft
displayVersion: 0.1
tags: [RNA, extraction]
---

# Description
Extract total RNA from cultured cells.

# Purpose
Produce RNA for reverse transcription.

# Background
Keep samples RNase-free.

# Material
| Name | Unit | Role | Notes |
| --- | --- | --- | --- |
| Lysis buffer | mL | lysis | cold |

# Steps
1. Add lysis buffer.
2. Purify RNA.

# Result Templates
| Field | Type | Unit | Required |
| --- | --- | --- | --- |
| RNA concentration | number | ng/µL | Yes |

# Consumption Rules
| Material | Formula | Unit |
| --- | --- | --- |
| Lysis buffer | samples * 0.35 | mL |
`;
    const parsed = await parseStructuredFile(new File([markdown], "protocol.md", { type: "text/markdown" }), "protocols");
    const document = normalizeProtocolDocument(parsed.records[0]?.contentJson);

    expect(parsed.records[0]?.canonicalTitle).toBe("RNA extraction");
    expect(document?.sections).toHaveLength(7);
    expect(document?.sections.find((section) => section.key === "material")?.blocks[0]).toEqual(expect.objectContaining({ type: "table" }));
    expect(document?.sections.find((section) => section.key === "steps")?.blocks[0]).toEqual(expect.objectContaining({ type: "rich_text" }));
  });

  it("generates a Research Plan DOCX template that the same importer can read", async () => {
    const template = await buildStructuredTemplate("research-plans", "docx");
    const parsed = await parseStructuredFile(fileFromBody(template.body, template.filename, template.contentType), "research-plans");
    const bytes = template.body instanceof Uint8Array
      ? template.body
      : new Uint8Array(template.body as ArrayBuffer);
    const documentXml = strFromU8(unzipSync(bytes)["word/document.xml"]!);

    expect(parsed.records).toHaveLength(1);
    expect(parsed.records[0]?.title).toBe("Replace with Research Plan title");
    expect(parsed.records[0]?.code).toBe("RP-001");
    expect(documentXml).toContain("Material &amp; methods");
    expect(documentXml).not.toContain("Variables &amp; controls");
    expect(documentXml).not.toContain("Protocol codes");
    expect(documentXml).not.toContain("Primary Protocol code");
  });

  it("maps the current Research Plan Material & methods heading onto its structured field", async () => {
    const markdown = `---
project: ZHY project
title: Matrix optimization
status: draft
---

# Material & methods

Seed cells in a six-well plate and retain matched vehicle controls.
`;
    const parsed = await parseStructuredFile(new File([markdown], "research-plan.md", { type: "text/markdown" }), "research-plans");

    expect(parsed.records[0]?.materialMethods).toBe("Seed cells in a six-well plate and retain matched vehicle controls.");
  });

  it("keeps legacy Research Plan Variables & controls imports readable", async () => {
    const markdown = `---
project: ZHY project
title: Legacy matrix optimization
---

# Variables & controls

Treatment dose and vehicle control.
`;
    const parsed = await parseStructuredFile(new File([markdown], "legacy-research-plan.md", { type: "text/markdown" }), "research-plans");

    expect(parsed.records[0]?.materialMethods).toBe("Treatment dose and vehicle control.");
  });

  it("applies the Research Plan typography, risk color, and three-line table contract", async () => {
    const template = await buildStructuredTemplate("research-plans", "docx");
    const bytes = template.body instanceof Uint8Array
      ? template.body
      : new Uint8Array(template.body as ArrayBuffer);
    const files = unzipSync(bytes);
    const documentXml = strFromU8(files["word/document.xml"]!);
    const stylesXml = strFromU8(files["word/styles.xml"]!);

    expect(stylesXml).toContain('w:eastAsia="微软雅黑"');
    expect(stylesXml).toContain('w:eastAsia="宋体"');
    expect(stylesXml).toContain('w:ascii="Times New Roman"');
    expect(stylesXml).toMatch(/w:styleId="Title"[\s\S]*?<w:sz w:val="24"\/>/);
    expect(stylesXml).toMatch(/w:styleId="Normal"[\s\S]*?<w:sz w:val="20"\/>/);
    expect(stylesXml).toContain('<w:color w:val="595959"/>');
    expect(stylesXml).toContain('w:styleId="CriticalAction"');
    expect(stylesXml).toContain('w:styleId="RiskWarning"');
    expect(stylesXml).toContain('<w:color w:val="C00000"/>');
    expect(documentXml).toContain('w:line="240" w:lineRule="auto"');
    expect(documentXml).toContain('<w:left w:val="nil"/>');
    expect(documentXml).toContain('<w:right w:val="nil"/>');
    expect(documentXml).toContain('<w:insideV w:val="nil"/>');
    expect(documentXml).toContain('w:fill="D9EAF7"');
    expect(documentXml).toContain('w:fill="FFFFFF"');
    expect(documentXml).toContain('w:fill="EAF3F8"');
  });

  it("separates Chinese and English title text into explicit Word font runs", async () => {
    const titleField = structuredModules["research-plans"].fields.find((field) => field.key === "title")!;
    const originalExample = titleField.example;
    titleField.example = "研究方案标题 Research Plan Title";
    try {
      const template = await buildStructuredTemplate("research-plans", "docx");
      const bytes = template.body instanceof Uint8Array
        ? template.body
        : new Uint8Array(template.body as ArrayBuffer);
      const documentXml = strFromU8(unzipSync(bytes)["word/document.xml"]!);

      expect(documentXml).toContain('w:ascii="微软雅黑" w:hAnsi="微软雅黑" w:cs="微软雅黑" w:eastAsia="微软雅黑" w:hint="eastAsia"');
      expect(documentXml).toContain('<w:t xml:space="preserve">研究方案标题</w:t>');
      expect(documentXml).toContain('w:ascii="Times New Roman" w:hAnsi="Times New Roman"');
      expect(documentXml).toContain('<w:t xml:space="preserve"> Research Plan Title</w:t>');
    } finally {
      titleField.example = originalExample;
    }
  });

  it("accepts the versioned JSON envelope used by LabNest exports", async () => {
    const payload = JSON.stringify({
      schemaVersion: "labnest.structured-export/v1",
      module: "reports",
      records: [{ project: "ESCC", title: "Weekly report", status: "draft", executiveSummary: "Current evidence." }],
    });
    const parsed = await parseStructuredFile(new File([payload], "reports.json", { type: "application/json" }), "reports");

    expect(parsed.records[0]).toEqual(expect.objectContaining({ project: "ESCC", title: "Weekly report", executiveSummary: "Current evidence." }));
  });

  it("round-trips multiple Markdown records separated by the LabNest boundary", async () => {
    const markdown = `---
schema: labnest/projects@1
name: Project A
status: active
---

# Description

First project.

<!-- LabNest record boundary -->

---
schema: labnest/projects@1
name: Project B
status: paused
---

# Description

Second project.`;
    const parsed = await parseStructuredFile(new File([markdown], "projects.md", { type: "text/markdown" }), "projects");

    expect(parsed.records).toHaveLength(2);
    expect(parsed.records.map((record) => record.name)).toEqual(["Project A", "Project B"]);
  });

  it("keeps internal DOCX warnings out of the user field-mapping table", async () => {
    const template = await buildStructuredTemplate("protocols", "docx");
    const parsed = await parseStructuredFile(fileFromBody(template.body, template.filename, template.contentType), "protocols");

    expect(parsed.mapping.some((item) => item.source.startsWith("__"))).toBe(false);
  });
});
