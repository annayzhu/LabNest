import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const html = readFileSync(resolve(process.cwd(), "public/tools/free-plate-layout/index.html"), "utf8");
const script = readFileSync(resolve(process.cwd(), "public/tools/free-plate-layout/app.js"), "utf8");
const calculatorPage = readFileSync(resolve(process.cwd(), "src/app/tools/calculator/[calculatorId]/page.tsx"), "utf8");
const calculatorWorkspace = readFileSync(resolve(process.cwd(), "src/components/calculators/CalculatorWorkspace.tsx"), "utf8");

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

  it("opens new plate-aware calculators inside the existing drawer rather than a popup", () => {
    expect(script).not.toContain("window.open(`/tools/calculator/");
    expect(html).toContain('id="plateCalculatorFrame"');
    expect(script).toContain("plateCalculatorFrame.src");
    expect(calculatorPage).toContain('query.embed === "plate"');
  });

  it("keeps the embedded calculator language aligned with Free Plate", () => {
    expect(script).toContain('locale: language');
    expect(calculatorPage).toContain("embeddedLocale");
  });

  it("returns calculator results to the containing plate window", () => {
    expect(calculatorWorkspace).toContain("window.parent.postMessage");
    expect(script).toContain('event.data?.type !== "labnest:calculator-result"');
  });
});
