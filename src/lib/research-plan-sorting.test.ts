import { describe, expect, it } from "vitest";
import { normalizeResearchPlanSort, researchPlanOrderBy } from "./research-plan-sorting";

describe("Research Plan sorting", () => {
  it("defaults unknown values to latest update", () => {
    expect(normalizeResearchPlanSort("unknown")).toBe("updated_desc");
    expect(researchPlanOrderBy()).toEqual([{ updatedAt: "desc" }, { title: "asc" }]);
  });

  it("sorts experiment counts from high to low with a stable title tie-break", () => {
    expect(researchPlanOrderBy("experiments_desc")).toEqual([
      { experiments: { _count: "desc" } },
      { title: "asc" },
    ]);
  });

  it("supports name and lifecycle-status ordering", () => {
    expect(researchPlanOrderBy("title_asc")).toEqual([{ title: "asc" }, { code: "asc" }]);
    expect(researchPlanOrderBy("status_asc")).toEqual([{ status: "asc" }, { title: "asc" }]);
  });
});
