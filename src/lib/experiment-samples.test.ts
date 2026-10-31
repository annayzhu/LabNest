import { describe, expect, it } from "vitest";
import { matchSampleTokens, parseGroupAssignments, parseSampleList, runSampleCount, suggestedOutputType, wellsBySample, withExperimentSamples } from "./experiment-samples";
import { createScientificDocument, experimentSections } from "./scientific-document";

const samples = [
  { id: "s1", code: "RNA-0001", name: "A549-Mock" },
  { id: "s2", code: "RNA-0002", name: "A549-siFBN2-975" },
  { id: "s3", code: "CDNA-0001", name: "A549-Mock" },
];

describe("choosing samples by a pasted list", () => {
  it("splits on lines, commas and tabs and drops repeats", () => {
    expect(parseSampleList("RNA-0001\nRNA-0002, RNA-0001\tA549-Mock；\n\n")).toEqual(["RNA-0001", "RNA-0002", "A549-Mock"]);
  });

  it("matches codes first, a name only when one sample has it, and reports the rest", () => {
    const result = matchSampleTokens(["rna-0002", "A549-Mock", "cdna-0001", "Nope"], samples);
    expect(result.matched.map((sample) => sample.id)).toEqual(["s2", "s3"]);
    expect(result.ambiguous).toEqual(["A549-Mock"]);
    expect(result.missing).toEqual(["Nope"]);
    expect(matchSampleTokens(["a549-sifbn2-975"], samples).matched.map((sample) => sample.id)).toEqual(["s2"]);
  });
});

describe("groups", () => {
  it("reads sample and group pairs from two pasted columns", () => {
    expect(parseGroupAssignments("RNA-0001\tControl\nRNA-0002,siFBN2\nlonely\n\n")).toEqual([{ sample: "RNA-0001", group: "Control" }, { sample: "RNA-0002", group: "siFBN2" }]);
  });

  it("counts a run group's samples by the sample groups' names, or all of them for one group", () => {
    const inputs = ["H1650", "H1650", "A549", null];
    expect(runSampleCount(inputs, undefined)).toBe(4);
    expect(runSampleCount(inputs, "H1650")).toBe(2);
    expect(runSampleCount(inputs, "B组")).toBeUndefined();
    expect(runSampleCount([], undefined)).toBeUndefined();
  });
});

describe("outputs", () => {
  it("suggests the output type from the experiment's titles only when one fits", () => {
    expect(suggestedOutputType(["A549 and H1650 CHMP2A KD RNA isolation"])).toBe("sample_rna");
    expect(suggestedOutputType(["A549 and H1650 CHMP2A KD RT"])).toBe("sample_cdna");
    expect(suggestedOutputType(["KYSE150转染预实验RNA提取"])).toBe("sample_rna");
    expect(suggestedOutputType(["华大全血提取方案DNA质量检测"])).toBe("sample_dna");
    expect(suggestedOutputType(["H1650 and A549 RNA isolation and RT"])).toBeUndefined();
    expect(suggestedOutputType(["PAX2 and pMD2.G plasmid transformation", null])).toBeUndefined();
  });
});

describe("plates", () => {
  it("finds each sample's wells by code, or by a name only one of them has", () => {
    const plates = [{ name: "Plate 1", wells: { A1: { sample: "A549-siFBN2-975", gene: "GAPDH" }, A2: { sample: "a549-sifbn2-975" }, B1: { sample: "A549-Mock" }, B2: { sample: "CDNA-0001" } } }];
    const wells = wellsBySample(plates, samples);
    expect(wells.get("s2")).toEqual(["A1", "A2"]);
    expect(wells.get("s3")).toEqual(["B2"]);
    expect(wells.has("s1")).toBe(false);
    expect(wellsBySample([...plates, { name: "Plate 2", wells: { C3: { sample: "RNA-0002" } } }], samples).get("s2")).toEqual(["Plate 1 A1", "Plate 1 A2", "Plate 2 C3"]);
  });
});

describe("the record", () => {
  it("puts the samples used and produced at the head of 实验设置与样本 for print and export", () => {
    const document = createScientificDocument(experimentSections);
    document.sections.find((section) => section.key === "setup")!.blocks.push({ id: "setup-1", type: "text", text: "1-4: H1650 4组" });
    const setup = withExperimentSamples(document, [
      { role: "input", code: "RNA-0001", name: "A549-Mock", type: "RNA", group: "Control", place: "RNA box 1 A1", used: "5 µL", parent: null },
      { role: "output", code: "CDNA-0001", name: "A549-Mock", type: "cDNA", group: null, place: null, used: null, parent: "RNA-0001" },
    ]).sections.find((section) => section.key === "setup")!;
    expect(setup.blocks.map((block) => block.type)).toEqual(["text", "table", "text", "table", "text"]);
    expect(setup.blocks[1]).toMatchObject({ rows: [["Code", "Name", "Type", "Group", "Place", "Used"], ["RNA-0001", "A549-Mock", "RNA", "Control", "RNA box 1 A1", "5 µL"]] });
    expect(setup.blocks[3]).toMatchObject({ rows: [["Code", "Name", "Type", "Parent sample", "Place"], ["CDNA-0001", "A549-Mock", "cDNA", "RNA-0001", ""]] });
    expect(withExperimentSamples(document, [])).toBe(document);
  });
});
