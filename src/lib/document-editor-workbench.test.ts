import { describe, expect, it } from "vitest";
import {
  DOCUMENT_ZOOM_MAX,
  DOCUMENT_ZOOM_MIN,
  documentFitScale,
  insertActionIdsForProfile,
  normalizeDocumentZoom,
} from "./document-editor-workbench";

describe("document editor workbench", () => {
  it("keeps result evidence inserts complete", () => {
    expect(insertActionIdsForProfile("scientific-result")).toEqual([
      "table", "metric", "callout", "media", "dataset",
    ]);
  });

  it("normalizes user zoom to the supported 80–160 percent range", () => {
    expect(DOCUMENT_ZOOM_MIN).toBe(80);
    expect(DOCUMENT_ZOOM_MAX).toBe(160);
    expect(normalizeDocumentZoom("137")).toBe(137);
    expect(normalizeDocumentZoom(42)).toBe(80);
    expect(normalizeDocumentZoom(220)).toBe(160);
    expect(normalizeDocumentZoom("not-a-number", 115)).toBe(115);
  });

  it("calculates Fit from stable viewport geometry", () => {
    expect(documentFitScale(990, 794, 24)).toBeCloseTo(1.2166, 3);
    expect(documentFitScale(640, 794, 24)).toBe(0.8);
    expect(documentFitScale(2000, 794, 24)).toBe(1.6);
    expect(documentFitScale(990, 794, 24)).toBe(documentFitScale(990, 794, 24));
  });
});
