import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { SampleTypeRef } from "../samples";
import { newSampleBankSearch, parseResultPush, sampleRowFromBankRecord } from "./connector";
import { SAMPLE_BANK_CONTRACT, sampleBankRecordSchema, sampleBankSchemas } from "./contract";

const contractDoc = readFileSync(fileURLToPath(new URL("../../../docs/modules/samples/20261031/SAMPLE-BANK-CONTRACT.md", import.meta.url)), "utf8");
const examples = [...contractDoc.matchAll(/<!-- schema: (\w+) -->\s*```json\n([\s\S]*?)```/g)].map((match) => ({ schema: match[1] as keyof typeof sampleBankSchemas, body: JSON.parse(match[2]) as unknown }));

const types: SampleTypeRef[] = [
  { id: "t-tissue", key: "sample_tissue", label: "Tissue", prefix: "TIS", amountUnit: "mg", concentrationUnit: "", fields: [{ key: "site", label: "Site", kind: "text" }, { key: "pathology", label: "Pathology", kind: "text" }] },
  { id: "t-rna", key: "sample_rna", label: "RNA", prefix: "RNA", amountUnit: "µL", concentrationUnit: "ng/µL", fields: [{ key: "rin", label: "RIN", kind: "number" }] },
  { id: "t-other", key: "sample_other", label: "Other", prefix: "SMP", amountUnit: "", concentrationUnit: "", fields: [] },
];

describe("the written contract", () => {
  it("has examples of every message, and each one passes the schema named above it", () => {
    expect(new Set(examples.map((example) => example.schema))).toEqual(new Set(["searchRequest", "searchAck", "resultPush", "pushReceipt", "error"]));
    for (const example of examples) expect(sampleBankSchemas[example.schema].safeParse(example.body).error?.issues ?? []).toEqual([]);
  });

  it("refuses pushes that break the contract", () => {
    const push = examples.find((example) => example.schema === "resultPush")!.body as { records: unknown[] };
    expect(() => parseResultPush({ ...push, contract: "other/v2" })).toThrow(/contract/);
    expect(() => parseResultPush({ ...push, page: 3, pageCount: 2 })).toThrow(/page cannot be above pageCount/);
    expect(() => parseResultPush({ ...push, status: "failed" })).toThrow(/A failed push says why/);
    expect(() => parseResultPush({ ...push, records: [push.records[0], push.records[0]] })).toThrow(/each sample once/);
    expect(() => parseResultPush({ ...push, records: Array.from({ length: 501 }, (_, index) => ({ ...(push.records[0] as object), externalId: `BB-${index}` })) })).toThrow(/at most 500/);
    expect(sampleBankRecordSchema.safeParse({ source: "Hospital Bank", externalId: "1", name: "x", sampleType: "RNA" }).success).toBe(false);
  });
});

describe("the connector seam", () => {
  it("makes searches with a fresh request ID", () => {
    const search = newSampleBankSearch({ text: "ESCC" }, { callbackUrl: "https://labnest.lab.local/api/sample-bank/results", now: new Date("2026-10-31T00:00:00Z") });
    expect(search).toMatchObject({ contract: SAMPLE_BANK_CONTRACT, requestedAt: "2026-10-31T00:00:00.000Z", limit: 500, query: { text: "ESCC" } });
    expect(search.requestId).toMatch(/^sbr_[\w-]{8,}$/);
    expect(newSampleBankSearch({ text: "ESCC" }, { callbackUrl: "https://x.local/cb" }).requestId).not.toBe(search.requestId);
    expect(() => newSampleBankSearch({}, { callbackUrl: "https://x.local/cb" })).toThrow(/at least one condition/);
  });

  it("turns a bank record into a sample row keyed by source and external ID", () => {
    const push = parseResultPush(examples.find((example) => example.schema === "resultPush" && (example.body as { status: string }).status === "complete")!.body);
    const [tissue, rna] = push.records.map((record) => sampleRowFromBankRecord(record, types));
    expect(tissue.warnings).toEqual([]);
    expect(tissue.row).toMatchObject({ name: "P001-T", typeId: "t-tissue", origin: "P001", collectedAt: "2024-05-12", amount: "50", amountUnit: "mg", biosafetyLevel: "BSL-2", externalSource: "hospital-biobank", externalId: "BB-2024-000123", fields: { site: "食管中段", pathology: "鳞癌" } });
    expect(tissue.row.notes).toBe("样本库位置：3号冰箱 / B架 / 12盒 / A5\nstage: IIIA");
    expect(rna.row).toMatchObject({ typeId: "t-rna", concentration: "412.5", concentrationUnit: "ng/µL", parentExternalId: "BB-2024-000123", fields: { rin: "8.1" } });
    const saliva = sampleRowFromBankRecord({ source: "hospital-biobank", externalId: "BB-9", name: "S9", sampleType: "Saliva" }, types);
    expect(saliva.row.typeId).toBe("t-other");
    expect(saliva.warnings).toEqual(["Sample type Saliva has no match; it is kept as Other."]);
  });
});
