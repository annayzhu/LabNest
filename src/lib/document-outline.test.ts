import { describe, expect, it } from "vitest";
import { readingSectionIndex, scientificDocumentOutline, scientificSectionAnchorId } from "./document-outline";

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

describe("which outline item is highlighted while reading", () => {
  // Section tops relative to a 1000px viewport; the reading line sits at 220px.
  it("is the last section whose heading has passed the reading line", () => {
    expect(readingSectionIndex([-900, -120, 180, 640], 220, 1000, false)).toBe(2);
    expect(readingSectionIndex([300, 900], 220, 1000, false)).toBe(0);
  });

  it("is the last section in view once the page cannot scroll further, even if its heading never reaches the line", () => {
    expect(readingSectionIndex([-1400, -300, 520, 860], 220, 1000, true)).toBe(3);
    expect(readingSectionIndex([-1400, -300, 520, 1200], 220, 1000, true)).toBe(2);
  });
});
