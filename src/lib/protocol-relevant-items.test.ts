import { describe, expect, it } from "vitest";
import { buildProtocolRelevantCatalog, filterRelevantItemCatalog, normalizeManualRelevantLinks } from "./protocol-relevant-items";

describe("Protocol relevant item helpers", () => {
  const catalog = [
    { id: "rp-1", type: "research_plan" as const, label: "RP-001 · RNA extraction", meta: "ZHY project" },
    { id: "exp-1", type: "experiment" as const, label: "EXP-001 · FastPure run", meta: "Completed" },
    { id: "result-1", type: "result" as const, label: "RNA QC", meta: "Draft" },
  ];

  it("searches labels and metadata without rendering the complete catalog", () => {
    expect(filterRelevantItemCatalog(catalog, "zhy", "all").map((item) => item.id)).toEqual(["rp-1"]);
    expect(filterRelevantItemCatalog(catalog, "", "experiment").map((item) => item.id)).toEqual(["exp-1"]);
  });

  it("deduplicates and constrains user-managed relation payloads", () => {
    expect(normalizeManualRelevantLinks([
      { type: "experiment", id: "exp-1" },
      { type: "experiment", id: "exp-1" },
      { type: "version", id: "version-1" },
    ])).toEqual([{ type: "experiment", id: "exp-1" }]);
  });

  it("builds one shared catalog shape for create and edit pages", () => {
    expect(buildProtocolRelevantCatalog({
      projects: [{ id: "p1", name: "RNA Project" }],
      attachments: [{ id: "a1", originalFilename: "raw.csv", mimeType: "text/csv", size: 2048 }],
    })).toEqual([
      expect.objectContaining({ id: "p1", type: "project", label: "RNA Project" }),
      expect.objectContaining({ id: "a1", type: "attachment", meta: "text/csv · 2 KB" }),
    ]);
  });
});
