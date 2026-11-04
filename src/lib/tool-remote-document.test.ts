import { describe, expect, it } from "vitest";
import { savedRecordDocument } from "./tool-remote-document";
import { resultSections } from "./scientific-document";
import { withResultLegacyPromotionMarker } from "./result-document";

describe("the saved record a tool save merges with", () => {
  it("has every section the form shows, even when the record holds none", () => {
    expect(savedRecordDocument("result", { contentJson: {}, metadataJson: withResultLegacyPromotionMarker({}) }).sections.map((section) => section.key)).toEqual(resultSections.map((section) => section.key));
  });
  it("keeps an older result's values until they are promoted", () => {
    const text = (metadataJson: unknown) => JSON.stringify(savedRecordDocument("result", { contentJson: {}, metadataJson, textValue: "viability 83%", notes: null, unit: null, numericValue: null }));
    expect(text({})).toContain("viability 83%");
    expect(text(withResultLegacyPromotionMarker({}))).not.toContain("viability 83%");
  });
});
