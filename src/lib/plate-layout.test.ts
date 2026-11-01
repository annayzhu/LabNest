import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  clearPlateWells, fillPlateInOrder, newPlateLayout, plateLayoutFromMarkdown, plateLayoutPlainText, plateLayoutsFromPlannerBackup, plateLayoutsToPlannerBackup,
  plateLayoutTableRows, plateLayoutToMarkdown, plateLegend, plateSampleIds, plateWellIds, plateWellRange, plateWellsInRect, platesAsText, resizePlateLayout, setPlateValue,
} from "./plate-layout";

const plate = () => newPlateLayout({ id: "plate-1", name: "qPCR 板 1", plateSize: 96, fieldNames: ["样本", "处理"] });
let ids = 0;
const nextId = () => `plate-${++ids}`;

describe("plate wells", () => {
  it("orders wells along rows (Z) or down columns (N)", () => {
    expect(plateWellIds(6, "Z")).toEqual(["A1", "A2", "A3", "B1", "B2", "B3"]);
    expect(plateWellIds(6, "N")).toEqual(["A1", "B1", "A2", "B2", "A3", "B3"]);
    expect(plateWellIds(384)).toHaveLength(384);
    expect(plateWellIds(48).at(-1)).toBe("F8");
  });

  it("selects a dragged rectangle and a shift range in plate order", () => {
    expect(plateWellsInRect("C3", "B2")).toEqual(["B2", "B3", "C2", "C3"]);
    expect(plateWellRange(96, "A11", "B2")).toEqual(["A11", "A12", "B1", "B2"]);
  });

  it("fills chosen wells in turn with replicates and counts what does not fit", () => {
    const wells = plateWellsInRect("A1", "B3");
    const { layout, filled, leftover } = fillPlateInOrder(plate(), wells, "sample", ["NC", { sampleId: "smp_2", label: "RNA-0002 siRNA-1" }, "siRNA-2"], { order: "N", replicates: 2 });
    expect([filled, leftover]).toEqual([6, 0]);
    expect(Object.fromEntries(Object.entries(layout.wells).map(([id, values]) => [id, values.sample]))).toEqual({
      A1: "NC", B1: "NC", A2: { sampleId: "smp_2", label: "RNA-0002 siRNA-1" }, B2: { sampleId: "smp_2", label: "RNA-0002 siRNA-1" }, A3: "siRNA-2", B3: "siRNA-2",
    });
    expect(fillPlateInOrder(plate(), ["A1", "A2"], "sample", ["a", "b"], { order: "Z", replicates: 3 })).toMatchObject({ filled: 2, leftover: 4 });
    expect(plateSampleIds(layout)).toEqual(["smp_2"]);
  });

  it("sets, clears and colours values; an empty value removes the parameter from the well", () => {
    let layout = setPlateValue(plate(), ["A1", "A2", "A3"], "sample", "NC");
    layout = setPlateValue(layout, ["A3"], "sample", "Blank");
    layout = setPlateValue(layout, ["A2"], "treatment", "siRNA");
    expect(plateLegend(layout)).toEqual([{ key: "text:NC", label: "NC", tone: 0, count: 2 }, { key: "text:Blank", label: "Blank", tone: 1, count: 1 }]);
    layout = setPlateValue(layout, ["A1"], "sample", "  ");
    expect(layout.wells.A1).toBeUndefined();
    expect(clearPlateWells(layout, ["A2"]).wells).toEqual({ A3: { sample: "Blank" } });
  });

  it("keeps the wells a smaller plate still has", () => {
    const layout = setPlateValue(setPlateValue(plate(), ["A1"], "sample", "x"), ["H12"], "sample", "y");
    const resized = resizePlateLayout(layout, 24);
    expect(resized.dropped).toBe(1);
    expect(Object.keys(resized.layout.wells)).toEqual(["A1"]);
  });
});

describe("plates in documents", () => {
  it("round-trips through one Markdown line no Markdown reader touches", () => {
    const layout = setPlateValue(plate(), ["A1"], "sample", "a*b~~c (d) [e] <!-- f --> 100%");
    const line = plateLayoutToMarkdown(layout);
    expect(line).toMatch(/^<!--labnest-plate:[A-Za-z0-9%._-]+-->$/);
    expect(plateLayoutFromMarkdown(line)).toEqual(layout);
    expect(plateLayoutFromMarkdown("<!--labnest-plate:%7B%7D-->")).toBeUndefined();
  });

  it("reads as its name, size and values", () => {
    const layout = setPlateValue(setPlateValue(plate(), ["A1", "A2"], "sample", { sampleId: "s1", label: "RNA-0001 NC" }), ["A1"], "treatment", "siRNA");
    expect(plateLayoutPlainText(layout)).toBe("板布局：qPCR 板 1（96 孔） RNA-0001 NC siRNA");
    expect(platesAsText(`前\n${plateLayoutToMarkdown(layout)}\n后`)).toBe("前\n板布局：qPCR 板 1（96 孔） RNA-0001 NC siRNA\n后");
    const rows = plateLayoutTableRows(layout);
    expect(rows).toHaveLength(9);
    expect(rows[1].slice(0, 3)).toEqual(["A", "RNA-0001 NC", "RNA-0001 NC"]);
  });
});

describe("free plate planner backups", () => {
  // The planner's own project code, as released into public/tools.
  const workspaceCore = createRequire(import.meta.url)(path.resolve("public/tools/free-plate-layout/workspace-core.js")) as { normalizeWorkspace: (raw: unknown) => { plates: Array<{ name: string; plateSize: number; plates: Record<string, Record<string, { params: Record<string, unknown> }>>; colorDimension: string; dimensions: Array<{ id: string; type: string; unit: string }> }> } };

  it("imports version 2 projects and the single-plate shape before them", () => {
    const backup = { version: 2, plates: [
      { id: "p1", name: "Plate A", plateSize: 96, colorDimension: "treatment", dimensions: [{ id: "sample", name: "样本" }, { id: "treatment", name: "处理" }, { id: "dose", name: "剂量", unit: "µM" }],
        plates: { 96: { A1: { params: { sample: "NC", treatment: "DMSO", dose: 0 } }, B2: { params: { sample: "", treatment: "Drug" } } } } },
      { id: "p2", name: "Bad", plateSize: 7, plates: {} },
    ] };
    const [layout] = plateLayoutsFromPlannerBackup(backup, nextId);
    expect(layout).toMatchObject({ name: "Plate A", plateSize: 96, colorField: "treatment", wells: { A1: { sample: "NC", treatment: "DMSO", dose: "0" }, B2: { treatment: "Drug" } } });
    expect(layout.fields.map((field) => field.id)).toEqual(["sample", "treatment", "dose"]);
    expect(plateLayoutsFromPlannerBackup(backup, nextId)).toHaveLength(1);
    const legacy = plateLayoutsFromPlannerBackup({ name: "Old", plateSize: 24, dimensions: [{ id: "sample", name: "Sample" }], plates: { 24: { C4: { params: { sample: "x" } } } } }, nextId);
    expect(legacy[0]).toMatchObject({ name: "Old", plateSize: 24, wells: { C4: { sample: "x" } } });
  });

  it("writes a project the planner restores with the same wells", () => {
    let layout = setPlateValue(plate(), ["A1", "A2"], "sample", { sampleId: "s1", label: "RNA-0001 NC" });
    layout = { ...layout, fields: [...layout.fields, { id: "dose", name: "剂量", unit: "µM" }] };
    layout = setPlateValue(layout, ["A1"], "dose", "2.5");
    const restored = workspaceCore.normalizeWorkspace(plateLayoutsToPlannerBackup([layout, { ...plate(), id: "p48", plateSize: 48 }], "EXP-007"));
    expect(restored.plates).toHaveLength(1);
    expect(restored.plates[0]).toMatchObject({ name: "qPCR 板 1", plateSize: 96, colorDimension: "sample" });
    expect(restored.plates[0].plates[96]).toEqual({ A1: { params: { sample: "RNA-0001 NC", dose: 2.5 } }, A2: { params: { sample: "RNA-0001 NC" } } });
    expect(restored.plates[0].dimensions.find((dimension) => dimension.id === "dose")).toMatchObject({ type: "number", unit: "µM" });
    expect(plateLayoutsFromPlannerBackup(restored, nextId)[0].wells.A1).toEqual({ sample: "RNA-0001 NC", dose: "2.5" });
  });
});
