import { describe, expect, it } from "vitest";
import { documentFitScale, insertActionIdsForProfile } from "./document-editor-workbench";

describe("document editor workbench", () => {
  it("keeps result evidence inserts complete", () => {
    expect(insertActionIdsForProfile("scientific-result")).toEqual([
      "table", "metric", "callout", "media", "dataset",
    ]);
  });

  it("lets Fit differ from 100% on a panel wider than A4", () => {
    expect(documentFitScale(990, 794)).toBeCloseTo(1.24, 2);
    expect(documentFitScale(640, 794)).toBeCloseTo(0.8, 2);
  });

  it("keeps Fit within a usable inspection range", () => {
    expect(documentFitScale(200, 794)).toBe(0.4);
    expect(documentFitScale(2000, 794)).toBe(1.5);
  });
});
