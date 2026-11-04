import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { calculate } from "./calculator-engine";

/**
 * Reaction mixes are calculated in several places (Q402): this calculator, the free plate planner and the qPCR planner.
 * They stay separate for now, so the same system must give the same volumes everywhere. The qPCR planner's own test
 * (`tests/workflow-output.test.ts` in its repository) checks these numbers too.
 */
const SYSTEM = { reactions: 24, overagePercent: 12, finalVolume: 10, rows: [{ name: "Mix", volume: "5", premix: true }, { name: "F", volume: "0.2", premix: true }, { name: "R", volume: "0.2", premix: true }, { name: "Template", volume: "1", premix: false }] };
const EXPECTED = { Mix: 134.4, F: 5.376, R: 5.376, Water: 96.768 };

describe("the same reaction mix in each calculation", () => {
  it("LabNest calculator", () => {
    const result = calculate({ calculatorId: "master-mix", inputs: { overagePercent: SYSTEM.overagePercent, reactionVolumeUl: SYSTEM.finalVolume, groups: [{ name: "GENE", reactions: String(SYSTEM.reactions), rows: [...SYSTEM.rows, { name: "Water", volume: "3.6", premix: true }] }] } });
    const batch = Object.fromEntries((result.table ?? []).map((row) => [row.component, row.batchUl]));
    for (const [name, volume] of Object.entries(EXPECTED)) expect(batch[name]).toBeCloseTo(volume, 6);
  });

  it("free plate planner", () => {
    const core = createRequire(import.meta.url)(resolve("public/tools/free-plate-layout/preparation-core.js"));
    const wells = Array.from({ length: SYSTEM.reactions }, (_, index) => ({ id: `W${index}`, sample: `S${index}` }));
    const result = core.calculate("reaction", { finalVolume: SYSTEM.finalVolume, overagePercent: SYSTEM.overagePercent, diluent: "Water", rows: SYSTEM.rows }, { plateId: "p", plateName: "p", wells });
    const batch = Object.fromEntries(result.groups[0].components.map((component: { name: string; preparedVolumeUL: number | null }) => [component.name, component.preparedVolumeUL]));
    for (const [name, volume] of Object.entries(EXPECTED)) expect(batch[name]).toBeCloseTo(volume, 6);
  });
});
