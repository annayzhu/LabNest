import { describe, expect, it } from "vitest";
import { scientificDocumentOutline, scientificSectionAnchorId } from "./document-outline";

describe("scientific document outline", () => {
  it("builds stable anchors for visible document sections", () => {
    const document = {
      schemaVersion: 1 as const,
      sections: [
        { key: "summary", title: "Summary", blocks: [] },
        { key: "quality limitations", title: "Quality & limitations", blocks: [] },
      ],
    };

    expect(scientificDocumentOutline(document)).toEqual([
      { id: "scientific-section-summary", label: "Summary" },
      { id: "scientific-section-quality%20limitations", label: "Quality & limitations" },
    ]);
  });

  it("omits sections hidden by the editor", () => {
    const document = {
      schemaVersion: 1 as const,
      sections: [
        { key: "summary", title: "Summary", blocks: [] },
        { key: "internal", title: "Internal notes", blocks: [] },
      ],
    };

    expect(scientificDocumentOutline(document, ["internal"])).toEqual([
      { id: scientificSectionAnchorId("summary"), label: "Summary" },
    ]);
  });
});
