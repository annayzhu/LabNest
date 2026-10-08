import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createEmptyProtocolDocument, projectProtocolDocument } from "./protocol-document";
import {
  MAX_CONTEXT_CHARS,
  buildExtractionContext,
  buildExtractionPrompt,
  checkProposal,
  mergeExtraction,
  parseAcceptedExtractions,
  parseRawProposal,
  signProposal,
  verifyAcceptedExtraction,
} from "./protocol-extraction";

const originalKey = process.env.LABNEST_AI_ENCRYPTION_KEY;

function fixture() {
  const document = createEmptyProtocolDocument();
  const section = (key: string) => document.sections.find((item) => item.key === key)!;
  section("material").blocks = [
    { id: "materials", type: "table", rows: [["Name", "Unit"], ["Opti-MEM", "µL"], ["Lipofectamine 3000", "µL"]] },
    { id: "photo", type: "media", url: "/api/attachments/secret-image", mediaKind: "image" } as never,
  ];
  section("steps").blocks = [
    { id: "s1", type: "heading", text: "1. Seed cells" },
    { id: "s1t", type: "text", text: "Seed 2 × 10^5 cells per well in a 24-well plate." },
    { id: "s2", type: "heading", text: "2. Add transfection mix" },
    { id: "s2t", type: "text", text: "Dilute 1.5 µL Lipofectamine 3000 in 25 µL Opti-MEM per well. Do not vortex." },
  ];
  section("consumption_rules").blocks = [
    { id: "rules", type: "table", rows: [["Material", "Formula", "Unit"], ["Opti-MEM", "25 * 2", "µL"]] },
  ];
  const projection = projectProtocolDocument(document);
  return { document, projection, context: buildExtractionContext(document, projection) };
}

const modelOutput = {
  parameters: [
    { name: "well_count", label: "Wells", type: "number", default: 24, unit: "wells", evidence: "in a 24-well plate" },
    { name: "cells per well", type: "number", default: 200000, evidence: "Seed 2 × 10^5 cells per well" },
    { name: "volume", type: "number", default: "lots", evidence: "25 µL Opti-MEM per well" },
  ],
  consumptionRules: [
    { material_name: "Lipofectamine 3000", formula: "1.5 * well_count", unit: "µL", evidence: "Dilute 1.5 µL Lipofectamine 3000" },
    { material_name: "Opti-MEM", formula: "25 * well_count", unit: "µL", evidence: "25 µL Opti-MEM per well" },
    { material_name: "Trypsin", formula: "1 * well_count", unit: "mL", evidence: "Seed cells" },
    { material_name: "Lipofectamine 3000", formula: "1.5 * missing_param", unit: "µL", evidence: "Dilute 1.5 µL Lipofectamine 3000" },
  ],
  stepAttributes: [
    { order: 1, requires_confirmation: false, evidence: "Seed 2 × 10^5 cells per well" },
    { order: 9, requires_confirmation: true, evidence: "Do not vortex." },
  ],
  resultFields: [
    { template_title: "Transfection efficiency", key: "GFP positive %", label: "GFP-positive cells", type: "number", unit: "%", evidence: "Add transfection mix" },
    { template_title: "Transfection efficiency", key: "notes", label: "Notes", type: "text", evidence: "an invented sentence that is nowhere in the protocol text" },
  ],
  warnings: ["Seeding density depends on cell line."],
};

describe("protocol extraction context", () => {
  it("flattens text and tables, skips media, and reports what the importer already found", () => {
    const { context } = fixture();
    expect(context.text).toContain("| Opti-MEM | µL |");
    expect(context.text).toContain("Do not vortex.");
    expect(context.text).not.toContain("secret-image");
    expect(context.recognized.materials).toEqual(["Opti-MEM", "Lipofectamine 3000"]);
    expect(context.recognized.steps.map((step) => step.order)).toEqual([1, 2]);
    expect(context.truncated).toBe(false);
    const { system, user } = buildExtractionPrompt(context);
    expect(system).toContain("evidence");
    expect(user).toContain("Already recognized");
  });

  it("truncates long documents and says so", () => {
    const { document, projection } = fixture();
    document.sections[0].blocks = [{ id: "long", type: "text", text: "x".repeat(MAX_CONTEXT_CHARS + 50) }];
    const context = buildExtractionContext(document, projection);
    expect(context.truncated).toBe(true);
    expect(context.text.length).toBe(MAX_CONTEXT_CHARS);
  });
});

describe("parseRawProposal", () => {
  it("reads fenced JSON and fills missing arrays", () => {
    const raw = parseRawProposal("Here:\n```json\n{\"parameters\":[]}\n```");
    expect(raw).toMatchObject({ parameters: [], consumptionRules: [], stepAttributes: [], resultFields: [] });
  });

  it("rejects prose and malformed shapes", () => {
    expect(() => parseRawProposal("no json here")).toThrow(/not valid JSON/);
    expect(() => parseRawProposal('{"parameters":[{"name":"x","type":"number"}]}')).toThrow(/extraction format/);
  });
});

describe("checkProposal", () => {
  it("marks each suggestion against the document and the importer's projection", () => {
    const { projection, context } = fixture();
    const { items, warnings } = checkProposal(parseRawProposal(JSON.stringify(modelOutput)), context, projection);
    const status = Object.fromEntries(items.map((item) => [item.id, item.status]));
    expect(status).toEqual({
      "parameter-1": "ok",
      "parameter-2": "invalid", // not a formula identifier
      "parameter-3": "invalid", // non-numeric default
      "consumption-1": "ok",
      "consumption-2": "duplicate", // importer already has an Opti-MEM rule
      "consumption-3": "unmatched", // Trypsin is not in the document
      "consumption-4": "invalid", // unknown parameter in formula
      "step-1": "ok",
      "step-2": "invalid", // step 9 does not exist
      "result-1": "ok",
      "result-2": "unmatched", // evidence not in the document
    });
    expect(items.find((item) => item.id === "result-1")?.value).toMatchObject({ key: "gfp_positive" });
    expect(warnings).toEqual(["Seeding density depends on cell line."]);
  });
});

describe("signing and merge", () => {
  beforeEach(() => {
    process.env.LABNEST_AI_ENCRYPTION_KEY = "extraction-test-key";
  });
  afterEach(() => {
    if (originalKey === undefined) delete process.env.LABNEST_AI_ENCRYPTION_KEY;
    else process.env.LABNEST_AI_ENCRYPTION_KEY = originalKey;
  });

  function signed() {
    const { projection, context } = fixture();
    const { items, warnings } = checkProposal(parseRawProposal(JSON.stringify(modelOutput)), context, projection);
    return { projection, ...signProposal({ checksum: "abc", rowIndex: 0, provider: "Test", model: "m", items, warnings, truncated: false }) };
  }

  it("accepts only the selected items of an authentic proposal", () => {
    const { proposal, token } = signed();
    const round = parseAcceptedExtractions(JSON.stringify([{ proposal, token, acceptedIds: ["parameter-1", "consumption-1"] }]));
    const items = verifyAcceptedExtraction(round[0], "abc", 0);
    expect(items.map((item) => item.id)).toEqual(["parameter-1", "consumption-1"]);
  });

  it("rejects tampering, another file, expiry, and invalid selections", () => {
    const { proposal, token } = signed();
    const tampered = structuredClone(proposal);
    (tampered.items[0].value as { default?: number }).default = 9999;
    expect(() => verifyAcceptedExtraction({ proposal: tampered, token, acceptedIds: ["parameter-1"] }, "abc", 0)).toThrow(/changed after it was checked/);
    expect(() => verifyAcceptedExtraction({ proposal, token, acceptedIds: [] }, "other", 0)).toThrow(/different file/);
    expect(() => verifyAcceptedExtraction({ proposal, token, acceptedIds: [] }, "abc", 0, proposal.expiresAt + 1)).toThrow(/expired/);
    expect(() => verifyAcceptedExtraction({ proposal, token, acceptedIds: ["parameter-2"] }, "abc", 0)).toThrow(/invalid AI item/);
    expect(() => parseAcceptedExtractions("{not json")).toThrow(/malformed/);
    expect(parseAcceptedExtractions(JSON.stringify([{ proposal, token, acceptedIds: [] }]))).toEqual([]);
  });

  it("merges parameters, rules, step flags, and result fields over the heuristic projection", () => {
    const { proposal, projection } = signed();
    const pick = (...ids: string[]) => proposal.items.filter((item) => ids.includes(item.id));
    const merged = mergeExtraction(projection, pick("parameter-1", "consumption-1", "consumption-2", "step-1", "result-1"));

    expect(merged.parameters).toEqual([{ name: "well_count", type: "number", default: 24, unit: "wells" }]);
    expect(merged.consumptionRules).toEqual([
      { material_name: "Opti-MEM", formula: "25 * well_count", unit: "µL" },
      { material_name: "Lipofectamine 3000", formula: "1.5 * well_count", unit: "µL" },
    ]);
    expect(merged.steps.find((step) => step.order === 1)?.requires_confirmation).toBe(false);
    expect(projection.steps.find((step) => step.order === 1)?.requires_confirmation).toBe(true);
    const template = merged.resultTemplates.at(-1)!;
    expect(template.title).toBe("Transfection efficiency");
    expect(template.fields.map((field) => field.key)).toEqual(["gfp_positive"]);
    expect(merged.counts).toEqual({ parameters: 1, consumptionRules: 2, stepAttributes: 1, resultFields: 1 });
  });
});
