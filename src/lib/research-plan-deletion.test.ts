import { describe, expect, it } from "vitest";
import { researchPlanDeleteBlockers } from "./research-plan-deletion";

const emptyCounts = { entries: 0, experiments: 0, results: 0, reports: 0, reportSourceReferences: 0 };

describe("Research Plan deletion policy", () => {
  it("allows an unreferenced Draft to be moved to the Recycle Bin", () => {
    expect(researchPlanDeleteBlockers("draft", emptyCounts)).toEqual([]);
  });

  it("blocks non-Draft and referenced plans with specific reasons", () => {
    expect(researchPlanDeleteBlockers("active", { ...emptyCounts, experiments: 2, reportSourceReferences: 1 })).toEqual([
      "status is active; only Draft plans can be moved to the Recycle Bin",
      "2 Experiments",
      "1 Report source reference",
    ]);
  });
});
