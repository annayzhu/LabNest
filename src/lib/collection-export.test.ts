import { describe, expect, it } from "vitest";
import { allCollectionExportHref, selectedCollectionExportHref } from "./collection-export";

describe("collection export links", () => {
  it("forwards unique selected record IDs", () => {
    expect(selectedCollectionExportHref("/results/export", ["r 1", "r2", "r2", ""])).toBe(
      "/results/export?exportScope=selected&id=r+1&id=r2",
    );
  });

  it("builds an explicit all-record scope", () => {
    expect(allCollectionExportHref("/projects/export")).toBe("/projects/export?exportScope=all");
  });
});
