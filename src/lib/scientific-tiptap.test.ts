import { describe, expect, it } from "vitest";
import { scientificDocumentToTiptap, tiptapToScientificDocument } from "@/lib/scientific-tiptap";
import type { ScientificDocument } from "@/lib/scientific-document";

describe("scientific Tiptap compatibility boundary", () => {
  it("round-trips narrative formatting and scientific widgets", () => {
    const document: ScientificDocument = {
      schemaVersion: 1,
      sections: [{
        key: "analysis",
        title: "Analysis",
        blocks: [
          { id: "heading-1", type: "heading", text: "Primary analysis" },
          { id: "text-1", type: "text", text: "<!--labnest-line-height:2-->**Signal** with <mark data-labnest-color=\"risk\"><span data-labnest-size=\"12\">++underlining++</span></mark>\n- first\n- second" },
          { id: "check-1", type: "checklist", items: ["Confirm QC", "Review outlier"] },
          { id: "table-1", type: "table", caption: "Measurements", rows: [["Sample", "Value"], ["A", "1.2"]], columnWidths: [160, 100], cellFontSizesPt: [[10, 10], [9, 9]], cellColors: [[null, null], [null, "risk"]] },
          { id: "metric-1", type: "metric", label: "Mean", value: "1.2", unit: "ng/µL" },
        ],
      }],
    };

    const roundTrip = tiptapToScientificDocument(scientificDocumentToTiptap(document), document);
    expect(roundTrip).toEqual(document);
  });

  it("preserves hidden sections outside the editor", () => {
    const document: ScientificDocument = {
      schemaVersion: 1,
      sections: [
        { key: "summary", title: "Summary", blocks: [{ id: "summary-1", type: "text", text: "Visible" }] },
        { key: "data", title: "Data", blocks: [{ id: "data-1", type: "text", text: "Hidden" }] },
      ],
    };
    const json = scientificDocumentToTiptap(document, ["data"]);
    expect(tiptapToScientificDocument(json, document)).toEqual(document);
  });

  it("does not persist the editor placeholder as an empty block", () => {
    const document: ScientificDocument = { schemaVersion: 1, sections: [{ key: "summary", title: "Summary", blocks: [] }] };
    expect(tiptapToScientificDocument(scientificDocumentToTiptap(document), document)).toEqual(document);
  });
});
