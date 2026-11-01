import { describe, expect, it } from "vitest";
import { translateUiText } from "./i18n";
import { applyImportEdits, parseStructuredFile } from "./structured-files";
import { createImportConfirmation, matchesImportConfirmation } from "./structured-import-confirmation";
import { editableImportFields, importFieldChoices, parseImportEdits } from "./structured-import-edits";
import { structuredModules } from "./structured-modules";

const csv = (text: string, name = "stock.csv") => new File([text], name, { type: "text/csv" });

describe("preview edits (Q216–Q220)", () => {
  it("reads edits in one order and refuses fields the preview cannot edit", () => {
    const edits = parseImportEdits(JSON.stringify({ changed: { 3: { unit: " mL ", name: "A" }, 1: { location: "" } }, removed: [2, 2], added: [{ name: "New", unit: "" }] }), "inventory");
    expect(edits).toEqual({ changed: { 1: { location: "" }, 3: { name: "A", unit: "mL" } }, removed: [2], added: [{ name: "New" }] });
    expect(JSON.stringify(edits.changed[3])).toBe('{"name":"A","unit":"mL"}');
    // A left-out row keeps no changes; document sections and JSON are not edited in the preview.
    expect(parseImportEdits({ changed: { 2: { unit: "g" } }, removed: [2], added: [] }, "inventory").changed).toEqual({});
    expect(() => parseImportEdits({ changed: { 1: { contentJson: "{}" } } }, "protocols")).toThrow("Invalid preview changes.");
    expect(() => parseImportEdits({ changed: { 1: { steps: "1. Mix" } } }, "protocols")).toThrow("Invalid preview changes.");
    expect(() => parseImportEdits({ removed: [0] }, "inventory")).toThrow("Invalid preview changes.");
    expect(parseImportEdits(null, "inventory")).toEqual({ changed: {}, removed: [], added: [] });
  });

  it("lays edits over the file's rows and keeps the file's checksum", async () => {
    const parsed = await parseStructuredFile(csv("Item name,Unit,Storage location\nTris,,Fridge 9\nNaCl,g,\nKCl,g,\n"), "inventory");
    const edited = applyImportEdits(parsed, parseImportEdits({ changed: { 1: { unit: "g", location: "" } }, removed: [2], added: [{ name: "EDTA", unit: "g", managementMode: "精确用量" }] }, "inventory"));
    expect(edited.checksum).toBe(parsed.checksum);
    expect(edited.records.map((record) => [record.name, record.unit, record.location])).toEqual([["Tris", "g", undefined], ["KCl", "g", ""], ["EDTA", "g", undefined]]);
    // A chosen name reads back to its stored code, as from the template.
    expect(edited.records[2].managementMode).toBe("precise");
    expect(edited.origins).toEqual([{ row: 1, changed: ["location", "unit"] }, { row: 3, changed: [] }, { added: 1 }]);
    expect(applyImportEdits(parsed, parseImportEdits(undefined, "inventory"))).toBe(parsed);
  });

  it("refuses edits that do not fit the file", async () => {
    const parsed = await parseStructuredFile(csv("Item name,Unit\nTris,g\n"), "inventory");
    expect(() => applyImportEdits(parsed, parseImportEdits({ removed: [1] }, "inventory"))).toThrow("Every record was removed");
    expect(() => applyImportEdits(parsed, parseImportEdits({ changed: { 4: { unit: "g" } } }, "inventory"))).toThrow("do not match this file");
    const markdown = await parseStructuredFile(new File(["---\nname: Alpha\n---\n# Alpha\n"], "project.md"), "projects");
    expect(() => applyImportEdits(markdown, parseImportEdits({ added: [{ name: "Beta" }] }, "projects"))).toThrow("only to a table file");
  });

  it("makes the edits part of the confirmation and recomputes a Protocol's decision", async () => {
    const parsed = await parseStructuredFile(new File(['[{"canonicalTitle":"QC","availability":"active"}]'], "batch.json"), "protocols");
    const edited = applyImportEdits(parsed, parseImportEdits({ changed: { 1: { availability: "draft" } } }, "protocols"));
    expect(edited.protocolDecisions?.[0]).not.toEqual(parsed.protocolDecisions?.[0]);
    const token = createImportConfirmation(edited);
    expect(matchesImportConfirmation(edited, token)).toBe(true);
    expect(matchesImportConfirmation(parsed, token)).toBe(false);
    const other = applyImportEdits(parsed, parseImportEdits({ changed: { 1: { availability: "draft", shortTitle: "Q" } } }, "protocols"));
    expect(matchesImportConfirmation(other, token)).toBe(false);
  });

  it("offers lists for fields with fixed choices and Chinese for every field name", () => {
    const status = structuredModules.reports.fields.find((field) => field.key === "status")!;
    expect(importFieldChoices("reports", status)?.map((choice) => choice.value)).toEqual(["draft", "ready_for_review", "final", "archived"]);
    const location = structuredModules.inventory.fields.find((field) => field.key === "location")!;
    expect(importFieldChoices("inventory", location, { location: ["Fridge 9"] })).toEqual([{ value: "Fridge 9", label: "Fridge 9" }]);
    expect(importFieldChoices("inventory", structuredModules.inventory.fields.find((field) => field.key === "unit")!)).toBeUndefined();
    for (const definition of Object.values(structuredModules)) {
      for (const field of editableImportFields(definition.key)) expect(translateUiText(field.label, "zh"), `${definition.key}.${field.key}`).not.toBe(field.label);
    }
  });

  it("reads the import's checks in Chinese", () => {
    expect(translateUiText("Line 3: Unit is required.", "zh")).toBe("第 3 行：请填写单位。");
    expect(translateUiText("Inventory location “冰箱 9” was not found.", "zh")).toBe("没有找到库位“冰箱 9”。");
    expect(translateUiText("Expiry date is not a valid date.", "zh")).toBe("有效期不是有效日期，请写成 YYYY-MM-DD。");
    expect(translateUiText("Import preview · 2 records", "zh")).toBe("导入预览 · 2 条");
    expect(translateUiText("Import 1 record", "zh")).toBe("导入 1 条");
    // A general pattern leaves names it does not know to other modules.
    expect(translateUiText("Something unknown is required.", "zh")).toBe("Something unknown is required.");
  });
});
