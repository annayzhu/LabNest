import { describe, expect, it } from "vitest";
import type { SampleTypeRef } from "../samples";
import { bankChanges, bankOwnedSnapshot, keepValidFields } from "./compare";
import { bankLocationOf, sampleRowFromBankRecord, withBankLocation } from "./connector";
import { afterPush, searchState, SEARCH_TIMEOUT_MS } from "./push";
import { querySummary, searchQueryFromForm } from "./query";
import { bearerToken, sameSecret, signPush } from "./signature";

const type = (id: string, key: string, label: string, fields: SampleTypeRef["fields"] = []): SampleTypeRef => ({ id, key, label, prefix: null, fields, amountUnit: "", concentrationUnit: "" });
const tissue = type("t-tissue", "sample_tissue", "Tissue", [
  { key: "site", label: "Site", kind: "text" }, { key: "pathology", label: "Pathology", kind: "text" },
  { key: "preservation", label: "Preservation", kind: "choice", options: ["Frozen", "FFPE", "RNAlater", "Fresh"] },
]);
const rna = type("t-rna", "sample_rna", "RNA", [{ key: "rin", label: "RIN", kind: "number" }]);
const other = type("t-other", "sample_other", "Other");
const types = [tissue, rna, other];
const source = "hospital-biobank";

describe("push signatures", () => {
  it("signs the raw body with the push token and compares secrets in constant time", () => {
    const body = '{"page":1}';
    expect(signPush(body, "token")).toMatch(/^sha256=[0-9a-f]{64}$/);
    expect(sameSecret(signPush(body, "token"), signPush(body, "token"))).toBe(true);
    expect(sameSecret(signPush(body, "token"), signPush(`${body} `, "token"))).toBe(false);
    expect(sameSecret("short", "a much longer secret")).toBe(false);
  });

  it("reads a bearer token", () => {
    expect(bearerToken("Bearer abc.DEF-1")).toBe("abc.DEF-1");
    expect(bearerToken("bearer   xyz ")).toBe("xyz");
    expect(bearerToken("Basic abc")).toBeUndefined();
    expect(bearerToken(null)).toBeUndefined();
  });
});

describe("pages of a search", () => {
  const start = { status: "accepted" as const, pageCount: null, pagesReceived: [], total: null };

  it("completes once every page has come, in any order, and takes a page only once", () => {
    const second = afterPush(start, { page: 2, pageCount: 2, status: "complete", total: 8 });
    expect(second).toMatchObject({ duplicate: false, status: "receiving", pagesReceived: [2], total: 8 });
    if (second.duplicate) throw new Error("unexpected");
    const first = afterPush({ ...start, ...second }, { page: 1, pageCount: 2, status: "partial" });
    expect(first).toMatchObject({ duplicate: false, status: "complete", pagesReceived: [1, 2], total: 8 });
    if (first.duplicate) throw new Error("unexpected");
    expect(afterPush({ ...start, ...first }, { page: 1, pageCount: 2, status: "partial" })).toEqual({ duplicate: true });
  });

  it("fails when a page says so, and times out a day after it was sent", () => {
    expect(afterPush(start, { page: 1, pageCount: 1, status: "failed" })).toMatchObject({ status: "failed" });
    const now = new Date("2026-10-31T12:00:00Z");
    expect(searchState({ status: "accepted", requestedAt: new Date(now.getTime() - SEARCH_TIMEOUT_MS - 1) }, now)).toBe("timed_out");
    expect(searchState({ status: "complete", requestedAt: new Date(0) }, now)).toBe("complete");
    expect(searchState({ status: "receiving", requestedAt: now }, now)).toBe("receiving");
  });
});

describe("the search form", () => {
  it("turns the form into a contract query with name = value lines", () => {
    const query = searchQueryFromForm({ text: " ESCC ", sampleTypes: ["sample_tissue"], collectedFrom: "2024-01-01", attributes: "病理 = 鳞癌\nstage：IIIA\n\n" });
    expect(query).toEqual({ text: "ESCC", sampleTypes: ["sample_tissue"], collectedFrom: "2024-01-01", attributes: { 病理: "鳞癌", stage: "IIIA" } });
    expect(querySummary(query, (key) => (key === "sample_tissue" ? "组织" : key))).toBe("ESCC · 组织 · 2024-01-01 – … · 病理 = 鳞癌 · stage = IIIA");
  });

  it("needs a condition, readable extra lines and dates in order", () => {
    expect(() => searchQueryFromForm({ text: " " })).toThrow("A search needs at least one condition.");
    expect(() => searchQueryFromForm({ attributes: "no value here" })).toThrow("name = value");
    expect(() => searchQueryFromForm({ collectedFrom: "2025-01-02", collectedTo: "2025-01-01" })).toThrow("after the last");
  });
});

describe("bank records as samples", () => {
  it("uses remembered type words, matches fields by Chinese names and keeps the location first in notes", () => {
    const record = { source, externalId: "BB-2", name: "P002-T", sampleType: "FFPE-block", location: "3号冰箱 / A6", attributes: { 部位: "食管下段", 病理类型: "鳞癌", block: "B12" } };
    expect(sampleRowFromBankRecord(record, types).typeMatched).toBe(false);
    const mapped = sampleRowFromBankRecord(record, types, new Map([["FFPE-BLOCK", "t-tissue"]]));
    expect(mapped).toMatchObject({ typeMatched: true, warnings: [], row: { typeId: "t-tissue", fields: { site: "食管下段", pathology: "鳞癌" }, notes: "样本库位置：3号冰箱 / A6\nblock: B12" } });
  });

  it("moves a field value the type cannot take into notes", () => {
    const { row } = sampleRowFromBankRecord({ source, externalId: "BB-3", name: "P004-RNA", sampleType: "RNA", attributes: { rin: "n/a" } }, types);
    expect(keepValidFields(rna, row)).toMatchObject({ fields: {}, notes: "RIN: n/a" });
    const { row: good } = sampleRowFromBankRecord({ source, externalId: "BB-4", name: "P005-RNA", sampleType: "RNA", attributes: { rin: "8.1" } }, types);
    expect(keepValidFields(rna, good)).toBe(good);
  });

  it("replaces only the location line of notes", () => {
    expect(withBankLocation("样本库位置：旧\n自己的备注", "新")).toBe("样本库位置：新\n自己的备注");
    expect(withBankLocation("自己的备注", undefined)).toBe("自己的备注");
    expect(withBankLocation(null, undefined)).toBeNull();
    expect(bankLocationOf("自己的备注\n样本库位置：3号冰箱")).toBe("3号冰箱");
  });
});

describe("what the bank would change", () => {
  const record = { source, externalId: "BB-1", name: "P001-T", sampleType: "Tissue", origin: "P001", collectedAt: "2024-05-12", location: "3号冰箱", attributes: { stage: "IIIA", site: "食管中段" } };
  const { row } = sampleRowFromBankRecord(record, types);
  const stored = { name: "P001-T", typeId: "t-tissue", origin: "P001", collectedAt: new Date("2024-05-12T00:00:00Z"), biosafetyLevel: null, fieldValues: { site: "食管中段", own: "kept" }, notes: "样本库位置：3号冰箱\nstage: IIIA\nLabNest 的备注" };

  it("finds nothing when the bank-owned values agree", () => {
    expect(bankChanges(stored, row)).toEqual([]);
  });

  it("lists the bank-owned values that differ, and nothing LabNest owns", () => {
    const { row: corrected } = sampleRowFromBankRecord({ ...record, name: "P001-T（复核）", location: "4号冰箱", attributes: { site: "食管上段" }, amount: { value: 45, unit: "mg" } }, types);
    expect(bankChanges(stored, corrected)).toEqual([
      { field: "name", from: "P001-T", to: "P001-T（复核）" },
      { field: "field:site", from: "食管中段", to: "食管上段" },
      { field: "location", from: "3号冰箱", to: "4号冰箱" },
    ]);
    expect(bankOwnedSnapshot(stored)).toEqual({ name: "P001-T", typeId: "t-tissue", origin: "P001", collectedAt: "2024-05-12", biosafetyLevel: null, fieldValues: { site: "食管中段", own: "kept" }, notes: stored.notes });
  });
});
