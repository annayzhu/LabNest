import { describe, expect, it } from "vitest";
import { calculate, getCalculatorCatalog } from "./calculator-engine";

describe("calculator module interface", () => {
  it("publishes the complete bilingual 31-calculator catalog", () => {
    const catalog = getCalculatorCatalog();
    expect(catalog).toHaveLength(31);
    expect(catalog.filter((item) => item.category === "cell-culture")).toHaveLength(11);
    expect(catalog.filter((item) => item.category === "solutions")).toHaveLength(9);
    expect(catalog.filter((item) => item.category === "molecular-biology")).toHaveLength(7);
    expect(catalog.filter((item) => item.category === "virology-microbiology")).toHaveLength(2);
    expect(catalog.filter((item) => item.category === "general")).toHaveLength(2);
    expect(catalog.every((item) => item.name && item.nameZh && item.method && item.methodZh)).toBe(true);
  });

  it("calculates hemocytometer concentration from an independent worked example", () => {
    const result = calculate({
      calculatorId: "hemocytometer",
      inputs: { counts: "13,11,14,17", dilutionFactor: 3, viabilityPercent: 90 },
    });
    expect(result.outputMap.averageCount).toBe(13.75);
    expect(result.outputMap.concentrationCellsPerMl).toBe(412500);
    expect(result.outputMap.viableCellsPerMl).toBe(371250);
  });

  it("calculates a plate-aware seeding batch with one overage application", () => {
    const result = calculate({
      calculatorId: "seeding",
      inputs: {
        stockCellsPerMl: 1_000_000,
        wells: 24,
        plates: 2,
        cellsPerWell: 50_000,
        volumePerWellUl: 500,
        overagePercent: 10,
      },
    });
    expect(result.outputMap.totalCells).toBe(2_640_000);
    expect(result.outputMap.stockVolumeMl).toBe(2.64);
    expect(result.outputMap.finalVolumeMl).toBe(26.4);
    expect(result.outputMap.mediumVolumeMl).toBe(23.76);
  });

  it("rejects a dilution whose target exceeds the stock", () => {
    expect(() => calculate({
      calculatorId: "dilution",
      inputs: { stockConcentration: 1, targetConcentration: 2, finalVolume: 10, volumeUnit: "mL" },
    })).toThrow(/target concentration/i);
  });

  it("converts 10,000 rpm at a 10 cm radius to a known RCF", () => {
    const result = calculate({ calculatorId: "centrifuge", inputs: { mode: "rpm-to-rcf", rpm: 10_000, radiusCm: 10 } });
    expect(result.outputMap.rcf).toBeCloseTo(11180, 0);
  });

  it("converts concentration units without changing chemical identity", () => {
    const result = calculate({ calculatorId: "unit-converter", inputs: { dimension: "concentration", value: 2.5, fromUnit: "mM", toUnit: "µM" } });
    expect(result.outputMap.convertedValue).toBe(2500);
  });

  it("reports Poisson MOI probabilities without treating titer units as interchangeable", () => {
    const result = calculate({
      calculatorId: "moi",
      inputs: { cells: 1_000_000, desiredMoi: 1, titer: 100_000_000, titerUnit: "PFU/mL" },
    });
    expect(result.outputMap.virusVolumeUl).toBe(10);
    expect(result.outputMap.probabilityUninfectedPercent).toBeCloseTo(36.7879, 3);
    expect(result.outputMap.probabilityAtLeastOnePercent).toBeCloseTo(63.2121, 3);
  });

  it("fits a known four-parameter logistic curve near its true midpoint", () => {
    const result = calculate({ calculatorId: "ic50-ec50", inputs: { mode: "activation", points: "0.1,0.990099\n1,9.090909\n10,50\n100,90.909091\n1000,99.009901" } });
    expect(result.outputMap.midpoint).toBeCloseTo(10, 1);
    expect(result.outputMap.rSquared).toBeGreaterThan(0.999);
  });

  it("back-calculates a linear protein standard curve", () => {
    const result = calculate({ calculatorId: "bradford-bca", inputs: { standards: "0,0.1\n1,0.6\n2,1.1", sampleAbsorbance: 0.85, dilutionFactor: 2 } });
    expect(result.outputMap.slope).toBeCloseTo(0.5, 6);
    expect(result.outputMap.sampleConcentration).toBeCloseTo(3, 6);
  });

  it("uses the Wallace rule for short primers", () => {
    const result = calculate({ calculatorId: "tm", inputs: { sequence: "AATTGGCC", sodiumMm: 50 } });
    expect(result.outputMap.tmC).toBe(24);
    expect(result.outputMap.gcPercent).toBe(50);
  });

  it("creates an independently checkable serial-dilution table", () => {
    const result = calculate({ calculatorId: "serial-dilution", inputs: { startingConcentration: 100, dilutionFactor: 10, levels: 3, totalVolumePerLevel: 200 } });
    expect(result.table).toEqual([
      { level: 1, concentration: 100, transferVolume: 20, diluentVolume: 180 },
      { level: 2, concentration: 10, transferVolume: 20, diluentVolume: 180 },
      { level: 3, concentration: 1, transferVolume: 20, diluentVolume: 180 },
    ]);
  });

  it("keeps the quick TCID50 endpoint explicitly approximate", () => {
    const result = calculate({ calculatorId: "virus-titer", inputs: { mode: "tcid50", tcidSeries: "0.001,8,8\n0.0001,4,8\n0.00001,1,8" } });
    expect(result.outputMap.approximateTcid50Dilution).toBe(0.0001);
    expect(result.warnings.join(" ")).toMatch(/Reed–Muench|Spearman–Kärber/);
  });

  it("warns instead of producing negative base medium for an invalid freezing recipe", () => {
    const result = calculate({ calculatorId: "freezing", inputs: { totalCells: 2_000_000, cellsPerVial: 1_000_000, volumePerVialMl: 1, dmsoPercent: 60, serumPercent: 50 } });
    expect(result.warnings).toHaveLength(1);
  });

  it("runs every calculator's independently recorded example through the public interface", () => {
    for (const definition of getCalculatorCatalog()) {
      const result = calculate({ calculatorId: definition.id, inputs: definition.exampleInputs });
      expect(result.calculatorId).toBe(definition.id);
      expect(result.outputs.length).toBeGreaterThan(0);
      expect(result.methodVersion).toBeTruthy();
    }
  });

  it("matches an explicit independent numerical expectation for all 31 calculators", () => {
    const expected: Record<string, [string, number]> = {
      hemocytometer: ["concentrationCellsPerMl", 412500], seeding: ["totalCells", 1320000], hydrogel: ["totalCells", 1000000],
      split: ["postSplitConfluency", 22.5], freezing: ["vials", 10], transfection: ["dnaUg", 13.2], "kill-curve": ["highestStockAdditionUl", 0.5],
      viability: ["liveCells", 180000], od600: ["estimatedCellsPerMl", 640000000], cfu: ["cfuPerMl", 1200000000], "colony-counter": ["confirmedCount", 40],
      "reagent-dosing": ["stockVolumeUl", 10], dilution: ["stockVolume", 1], "fold-dilution": ["stockVolume", 10], "serial-dilution": ["transferVolume", 10],
      molarity: ["massG", 1.8016], "percent-solution": ["soluteAmount", 25], "media-recipe": ["scaleFactor", 2], "buffer-recipe": ["scaleFactor", 0.5],
      "ic50-ec50": ["midpoint", 10], "master-mix": ["totalMasterMixUl", 209], ligation: ["insertNg", 30], tm: ["tmC", 28.132902],
      "dna-rna-conversion": ["molecules", 1824891139393.9392], "bradford-bca": ["sampleConcentration", 1.51006], "elisa-4pl": ["sampleConcentration", 10.06935],
      "wb-loading": ["waterUl", 4], moi: ["virusVolumeUl", 10], "virus-titer": ["pfuPerMl", 200000000], "unit-converter": ["convertedValue", 1000], centrifuge: ["rcf", 11180],
    };
    for (const definition of getCalculatorCatalog()) {
      const [key, expectedValue] = expected[definition.id];
      const actual = Number(calculate({ calculatorId: definition.id, inputs: definition.exampleInputs }).outputMap[key]);
      expect(Math.abs(actual - expectedValue), `${definition.id}.${key}`).toBeLessThanOrEqual(Math.max(1e-8, Math.abs(expectedValue) * 1e-5));
    }
  });

  it("rejects an explicit invalid or boundary input for every calculator", () => {
    const invalidOverrides: Record<string, Record<string, unknown>> = {
      hemocytometer: { dilutionFactor: 0 }, seeding: { stockCellsPerMl: 0 }, hydrogel: { stockCellsPerMl: 0 }, split: { splitRatio: 0 },
      freezing: { cellsPerVial: 0 }, transfection: { wells: 0 }, "kill-curve": { points: 0 }, viability: { targetLiveCellsPerMl: 0 },
      od600: { pathLengthCm: 0 }, cfu: { dilution: 0 }, "colony-counter": { automaticCount: -1 }, "reagent-dosing": { stockConcentration: 0 },
      dilution: { stockConcentration: 0 }, "fold-dilution": { fold: 0 }, "serial-dilution": { dilutionFactor: 1 }, molarity: { molecularWeight: 0 },
      "percent-solution": { targetVolumeMl: 0 }, "media-recipe": { baseVolumeMl: 0 }, "buffer-recipe": { baseVolumeMl: 0 }, "ic50-ec50": { points: "1,1\n2,2" },
      "master-mix": { reactions: 0 }, ligation: { vectorBp: 0 }, tm: { sequence: "NNN" }, "dna-rna-conversion": { length: 0 },
      "bradford-bca": { standards: "1,0.5" }, "elisa-4pl": { standards: "1,0.1\n2,0.2" }, "wb-loading": { sampleConcentrationUgUl: 0 }, moi: { titer: 0 },
      "virus-titer": { dilution: 0 }, "unit-converter": { dimension: "mass", fromUnit: "kg", toUnit: "g" }, centrifuge: { radiusCm: 0 },
    };
    for (const definition of getCalculatorCatalog()) {
      expect(() => calculate({ calculatorId: definition.id, inputs: { ...definition.exampleInputs, ...invalidOverrides[definition.id] } }), definition.id).toThrow();
    }
  });

  it("preserves scientifically meaningful sub-micromolar-scale values", () => {
    const result = calculate({ calculatorId: "dna-rna-conversion", inputs: { type: "dsDNA", length: 500, massUg: 1, volumeUl: 20 } });
    expect(result.outputMap.moles).toBeCloseTo(3.030303e-12, 18);
  });
});
