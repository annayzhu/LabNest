import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const html = readFileSync(resolve(process.cwd(), "public/tools/free-plate-layout/index.html"), "utf8");
const script = readFileSync(resolve(process.cwd(), "public/tools/free-plate-layout/app.js"), "utf8");
describe("Free Plate unified calculation workspace", () => {
  it("keeps the four existing liquid modules and adds plate-aware modules to the same calculation card", () => {
    const liquidCard = html.match(/<section class="card liquid-card"[\s\S]*?<\/section>\s*<details/)?.[0] ?? "";

    for (const moduleId of ["basic", "transfection", "serial", "drug"]) {
      expect(liquidCard).toContain(`data-liquid-module="${moduleId}"`);
    }

    for (const calculatorId of ["seeding", "hydrogel", "kill-curve", "fold-dilution", "master-mix", "moi"]) {
      expect(liquidCard).toContain(`data-plate-calculator="${calculatorId}"`);
    }

    expect(liquidCard).not.toContain('data-plate-calculator="reagent-dosing"');
    expect(html).not.toContain("plate-calculator-card");
  });

  it("ships the plate-aware calculators inside the standalone planner", () => {
    expect(html).toContain('id="plateCalculatorHost"');
    expect(html).not.toContain('id="plateCalculatorFrame"');
    expect(script).toContain("plateCalculatorDefinitions");
    expect(script).toContain("calculateStandalonePlateCalculator");
    expect(script).not.toContain("板感知计算需要从 LabNest 的 Tools 页面打开");
    expect(script).not.toContain("plateCalculatorFrame.src");
  });

  it("uses the selected wells as locked plate context", () => {
    expect(script).toContain("standalonePlateCalculatorMarkup");
    expect(script).toContain("liquidTargetWellIds().length");
    expect(script).toContain('["wells", "孔数"');
    expect(script).toContain('["reactions", "反应数"');
    expect(script).toContain('readonly aria-readonly="true"');
  });

  it("applies standalone calculator results directly to the active plate", () => {
    expect(script).toContain("applyPlateCalculatorPayload");
    expect(script).toContain("applyStandalonePlateCalculatorResult");
    expect(script).toContain("plateMappingsForCalculator");
  });
});
