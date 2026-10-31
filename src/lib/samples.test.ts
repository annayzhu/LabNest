import { describe, expect, it } from "vitest";
import {
  ancestorsOf, boxPositions, checkSampleRows, deductAmount, freePositions, mapSampleHeaders, normalizePosition, parseQuantityText,
  nameSeries, parseSampleDate, positionProblem, positionRanges, sampleCode, sampleCodeNumber, sampleDeleteBlockers, samplePrefix, sampleRowsFromCells,
  samplesByBox, type SampleBatchContext, type SampleTypeRef,
} from "./samples";

const rna: SampleTypeRef = {
  id: "t-rna", key: "sample_rna", label: "RNA", prefix: "RNA", amountUnit: "µL", concentrationUnit: "ng/µL",
  fields: [{ key: "a260_a280", label: "A260/A280", kind: "number" }, { key: "rin", label: "RIN", kind: "number" }],
};
const tissue: SampleTypeRef = {
  id: "t-tissue", key: "sample_tissue", label: "Tissue", prefix: "TIS", amountUnit: "mg", concentrationUnit: "",
  fields: [{ key: "preservation", label: "Preservation", kind: "choice", options: ["Frozen", "FFPE"] }],
};
const context = (overrides: Partial<SampleBatchContext> = {}): SampleBatchContext => ({
  types: new Map([[rna.id, rna], [tissue.id, tissue]]),
  existingCodes: new Set(["RNA-0001"]),
  parents: new Map([["TIS-0001", { id: "s-tis", code: "TIS-0001", origin: "Patient P-01", status: "available" }]]),
  locations: new Map([["box-rna", { id: "box-rna", label: "RNA box 1", geometry: { rows: 9, columns: 9 } }], ["shelf", { id: "shelf", label: "Shelf 2", geometry: null }]]),
  occupied: new Map([["box-rna", new Set(["A1"])]]),
  ...overrides,
});

describe("codes", () => {
  it("makes codes from a cleaned prefix and a padded running number", () => {
    expect(samplePrefix(" cdna ")).toBe("CDNA");
    expect(samplePrefix("组织")).toBe("SMP");
    expect(sampleCode("RNA", 12)).toBe("RNA-0012");
    expect(sampleCode("RNA", 12345)).toBe("RNA-12345");
    expect(sampleCodeNumber("RNA", "RNA-0012")).toBe(12);
    expect(sampleCodeNumber("RNA", "CDNA-0012")).toBeUndefined();
    expect(nameSeries({ prefix: "P2026-", start: 8, width: 3, count: 3, suffix: "-T" })).toEqual(["P2026-008-T", "P2026-009-T", "P2026-010-T"]);
  });
});

describe("positions", () => {
  it("reads A1-style positions and keeps other text as typed", () => {
    expect(normalizePosition(" a01 ")).toBe("A1");
    expect(normalizePosition("B-12")).toBe("B12");
    expect(normalizePosition("第3格")).toBe("第3格");
    expect(normalizePosition("")).toBe("");
  });

  it("checks a position against its box and accepts anything without a grid", () => {
    const box = { rows: 9, columns: 9 };
    expect(positionProblem("I9", box)).toBeUndefined();
    expect(positionProblem("J1", box)).toMatch(/outside the 9 × 9 box/);
    expect(positionProblem("A10", box)).toMatch(/outside/);
    expect(positionProblem("top shelf", box)).toMatch(/not a position like A1/);
    expect(positionProblem("top shelf", null)).toBeUndefined();
  });

  it("fills free positions row by row from a start, skipping taken ones", () => {
    expect(boxPositions({ rows: 2, columns: 3 })).toEqual(["A1", "A2", "A3", "B1", "B2", "B3"]);
    expect(freePositions({ rows: 2, columns: 3 }, ["A2", "B1"], "A1")).toEqual(["A1", "A3", "B2", "B3"]);
    expect(freePositions({ rows: 2, columns: 3 }, [], "a03")).toEqual(["A3", "B1", "B2", "B3"]);
  });

  it("joins runs along a row for the bench", () => {
    expect(positionRanges(["A3", "A1", "A2", "B5", "A8", "B6", "C1"])).toBe("A1–A3, A8, B5–B6, C1");
    expect(positionRanges(["A9", "B1"])).toBe("A9, B1");
  });
});

describe("amounts", () => {
  it("reads a number with or without its unit", () => {
    expect(parseQuantityText("50 µL")).toEqual({ value: 50, unit: "µL" });
    expect(parseQuantityText("199.6ng/ul")).toEqual({ value: 199.6, unit: "ng/µL" });
    expect(parseQuantityText("12")).toEqual({ value: 12, unit: "" });
    expect(parseQuantityText("n/a")).toBeNull();
  });

  it("subtracts a use in the sample's unit and only when the units compare", () => {
    expect(deductAmount({ amount: 30, amountUnit: "µL" }, { value: 5, unit: "µL" })).toEqual({ deducted: 5, remaining: 25 });
    expect(deductAmount({ amount: 1, amountUnit: "mL" }, { value: 250, unit: "µL" })).toEqual({ deducted: 0.25, remaining: 0.75 });
    expect(deductAmount({ amount: 3, amountUnit: "µL" }, { value: 5, unit: "µL" })).toEqual({ deducted: 5, remaining: 0 });
    expect(deductAmount({ amount: 30, amountUnit: "µL" }, { value: 1, unit: "µg" })).toBeNull();
    expect(deductAmount({ amount: null, amountUnit: null }, { value: 1, unit: "µL" })).toBeNull();
  });
});

describe("checking a batch", () => {
  it("accepts complete rows, inherits the parent's origin and fills units from the type", () => {
    const result = checkSampleRows([
      { name: "A549-Mock", typeId: "t-rna", parentCode: "tis-0001", locationId: "box-rna", position: "a2", amount: "50", concentration: "199.6", fields: { a260_a280: "2.1" } },
      { code: "TIS-0100", name: "P-02 tumour", typeId: "t-tissue", origin: "Patient P-02", locationId: "shelf", position: "第3格", collectedAt: "2026/10/31", biosafetyLevel: "bsl 2", fields: { preservation: "FFPE" } },
    ], context());
    expect(result.ok).toBe(true);
    expect(result.rows[0].value).toMatchObject({ origin: "Patient P-01", parentId: "s-tis", position: "A2", amount: 50, amountUnit: "µL", concentration: 199.6, concentrationUnit: "ng/µL", fieldValues: { a260_a280: "2.1" } });
    expect(result.rows[0].value).not.toHaveProperty("code");
    expect(result.rows[1].value).toMatchObject({ code: "TIS-0100", position: "第3格", biosafetyLevel: "BSL-2", collectedAt: new Date("2026-10-31T00:00:00Z") });
  });

  it("names every problem of every row: codes, places, parents, numbers and fields", () => {
    const result = checkSampleRows([
      { code: "rna-0001", name: "", typeId: "t-rna", locationId: "box-rna", position: "A1" },
      { code: "X-1", name: "a", typeId: "unknown:Saliva", position: "B1" },
      { code: "x-1", name: "b", typeId: "t-rna", locationId: "box-rna", position: "B1", parentCode: "TIS-9999", amount: "-2" },
      { name: "c", typeId: "t-rna", locationId: "box-rna", position: "b01", concentration: "12", concentrationUnit: "", fields: { rin: "high" } },
      { name: "d", typeId: "t-tissue", locationId: "unknown:Freezer 9", amount: "3", amountUnit: "", collectedAt: "2026-02-30", biosafetyLevel: "BSL-4", fields: { preservation: "Dried" } },
    ], context());
    expect(result.ok).toBe(false);
    expect(result.rows[0].problems).toEqual(["Name is required.", "Code rna-0001 is already used.", "RNA box 1 A1 already holds a sample."]);
    expect(result.rows[1].problems).toEqual(["Sample type Saliva was not found.", "Choose a box for the position."]);
    expect(result.rows[2].problems).toEqual(["Code x-1 repeats row 2.", "Parent sample TIS-9999 was not found.", "Amount must be a number of 0 or more."]);
    expect(result.rows[3].problems).toEqual(["RNA box 1 B1 repeats row 3.", "RIN must be a number."]);
    expect(result.rows[4].problems).toEqual(["Box Freezer 9 was not found.", "Date must be like 2026-10-31.", "Biosafety level must be BSL-1, BSL-2 or BSL-3.", "Choose one of the options for Preservation."]);
  });

  it("holds at most 500 samples and nothing in an empty batch", () => {
    const rows = Array.from({ length: 501 }, (_, index) => ({ name: `S${index}`, typeId: "t-rna" }));
    expect(checkSampleRows(rows, context()).ok).toBe(false);
    expect(checkSampleRows(rows.slice(0, 500), context()).ok).toBe(true);
    expect(checkSampleRows([], context()).ok).toBe(false);
  });

  it("reads real days only", () => {
    expect(parseSampleDate("2026.1.5")).toEqual(new Date("2026-01-05T00:00:00Z"));
    expect(parseSampleDate("2026-02-29")).toBeNull();
    expect(parseSampleDate("31/10/2026")).toBeNull();
  });
});

describe("pasted tables", () => {
  it("maps the lab's RNA QC and storage form (EXP-001) onto sample columns and type fields", () => {
    const headers = ["Sample ID", "Concentration (ng/µL)", "Elution volume", "A260/A280", "rin", "Location | Box", "Location | Well", "Location | Freezer"];
    const columns = mapSampleHeaders(headers, rna.fields);
    expect(columns).toEqual(["name", "concentration", "amount", "field:a260_a280", "field:rin", "box", "position", ""]);
    const rows = sampleRowsFromCells([
      ["A549-Mock", "199.636 ng/µL", "50 µL", "2.098", "9.1", "RNA", "A1", "-20 ℃"],
      ["", "", "", "", "", "", "", ""],
      ["A549-NC-FAM", "24.1", "50", "1.9", "", "Unknown box", "A2", ""],
    ], columns, { typeId: () => undefined, locationId: (text) => (text === "RNA" ? "box-rna" : undefined) });
    expect(rows).toEqual([
      { name: "A549-Mock", concentration: "199.636", concentrationUnit: "ng/µL", amount: "50", amountUnit: "µL", locationId: "box-rna", position: "A1", fields: { a260_a280: "2.098", rin: "9.1" } },
      { name: "A549-NC-FAM", concentration: "24.1", amount: "50", locationId: "unknown:Unknown box", position: "A2", fields: { a260_a280: "1.9" } },
    ]);
  });

  it("reads back the import template's bilingual headers", () => {
    const template = ["Name (名称)", "Code (编号)", "Type (类型)", "Origin (来源)", "Parent sample (母样本)", "Box (盒子)", "Position (位置)", "Amount (体积)", "Amount unit (体积单位)", "Concentration (浓度)", "Concentration unit (浓度单位)", "Date (日期)", "Biosafety level (生物安全等级)", "Notes (备注)"];
    expect(mapSampleHeaders(template)).toEqual(["name", "code", "type", "origin", "parent", "box", "position", "amount", "amountUnit", "concentration", "concentrationUnit", "collectedAt", "biosafetyLevel", "notes"]);
    expect(mapSampleHeaders(["code", "name", "type", "box", "amountUnit", "concentrationUnit", "biosafetyLevel", "externalId"])).toEqual(["code", "name", "type", "box", "amountUnit", "concentrationUnit", "biosafetyLevel", ""]);
  });

  it("uses each column once and matches Chinese headers", () => {
    expect(mapSampleHeaders(["编号", "样本名", "名称", "母样本", "孔位", "备注"])).toEqual(["code", "name", "", "parent", "position", "notes"]);
  });
});

describe("lineage and deletion", () => {
  it("walks up to the root and stops on a loop", () => {
    const byId = new Map([
      ["a", { id: "a", parentId: null }], ["b", { id: "b", parentId: "a" }], ["c", { id: "c", parentId: "b" }],
      ["x", { id: "x", parentId: "y" }], ["y", { id: "y", parentId: "x" }],
    ]);
    expect(ancestorsOf(byId.get("c")!, byId).map((sample) => sample.id)).toEqual(["b", "a"]);
    expect(ancestorsOf(byId.get("x")!, byId).map((sample) => sample.id)).toEqual(["y"]);
  });

  it("keeps samples that have children or were in an experiment", () => {
    expect(sampleDeleteBlockers({ children: 0, experiments: 0 })).toEqual([]);
    expect(sampleDeleteBlockers({ children: 2, experiments: 1 })).toEqual(["2 derived samples", "1 experiment"]);
  });

  it("lists the boxes to take samples from", () => {
    expect(samplesByBox([
      { locationLabel: "RNA box 1", position: "A2" }, { locationLabel: "RNA box 1", position: "A1" }, { locationLabel: "Shelf 2", position: null }, { locationLabel: null, position: null },
    ])).toEqual({ boxes: [{ label: "RNA box 1", count: 2, positions: "A1–A2" }, { label: "Shelf 2", count: 1, positions: "" }], unplaced: 1 });
  });
});
