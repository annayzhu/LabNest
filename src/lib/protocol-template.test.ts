import { describe, expect, it } from "vitest";
import { createProtocolTemplateDocument, projectProtocolDocument } from "./protocol-document";

/** A new Protocol starts in the interface language; its materials table reads the same either way. */
describe("new Protocol template", () => {
  it.each([
    ["en", "Materials", ["Name", "Amount", "Description"], "Result record"],
    ["zh", "材料", ["名称", "用量", "说明"], "结果记录"],
  ] as const)("writes the %s headings and still projects the materials table", (locale, caption, headings, resultName) => {
    const document = createProtocolTemplateDocument(locale);
    const table = document.sections.find(section => section.key === "material")!.blocks[0];
    if (table.type !== "table") throw new Error("expected the materials table");
    expect(table.caption).toBe(caption);
    expect(table.rows[0]).toEqual(headings);
    table.rows[1] = ["Proteinase K", "50 µL", "Fresh aliquot"];
    expect(projectProtocolDocument(document).materials).toEqual([expect.objectContaining({ name: "Proteinase K", notes: "50 µL · Fresh aliquot" })]);
    expect(document.sections.find(section => section.key === "result_templates")!.blocks[0]).toMatchObject({ caption: resultName });
  });

  it("keeps the Chinese template by default for the Word template download", () => {
    expect(createProtocolTemplateDocument().sections.find(section => section.key === "material")!.blocks[0]).toMatchObject({ caption: "材料" });
  });
});
