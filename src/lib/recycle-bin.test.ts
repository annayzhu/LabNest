import { describe, expect, it } from "vitest";
import { recycleBinHref, recycleBinTypeLabel } from "./recycle-bin-meta";

describe("recycle bin routing", () => {
  it("routes every primary record type back to its detail page", () => {
    expect(recycleBinHref("project", "p1")).toBe("/projects/p1");
    expect(recycleBinHref("research_plan", "rp1")).toBe("/research-plans/rp1");
    expect(recycleBinHref("protocol", "pr1")).toBe("/protocols/pr1");
    expect(recycleBinHref("experiment", "e1")).toBe("/experiments/e1");
    expect(recycleBinHref("result", "r1")).toBe("/results/r1");
    expect(recycleBinHref("report", "x1")).toBe("/reports/x1");
    expect(recycleBinHref("entry", "n1")).toBe("/entries/n1");
  });

  it("provides readable labels and a safe fallback", () => {
    expect(recycleBinTypeLabel("research_plan")).toBe("Research Plan");
    expect(recycleBinHref("unknown", "x")).toBe("/trash");
  });
});
