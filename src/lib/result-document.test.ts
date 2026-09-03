import { describe, expect, it } from "vitest";
import { createScientificDocument, resultSections } from "./scientific-document";
import { resultDocumentWithLegacyValues, resultLegacyValuesArePromoted, withResultLegacyPromotionMarker } from "./result-document";

describe("result document legacy value promotion", () => {
  it("promotes direct result fields into the shared rich document", () => {
    const document = resultDocumentWithLegacyValues(createScientificDocument(resultSections), {
      textValue: "Cells recovered after treatment.",
      numericValue: 1.42,
      unit: "fold",
      notes: "Confirm with an independent replicate.",
    });

    expect(document.sections.find((section) => section.key === "summary")?.blocks).toEqual([
      { id: "legacy-result-summary", type: "text", text: "Cells recovered after treatment." },
      { id: "legacy-result-primary-outcome", type: "metric", label: "Primary numeric outcome", value: "1.42", unit: "fold" },
      { id: "legacy-result-notes-heading", type: "heading", text: "Notes" },
      { id: "legacy-result-notes", type: "text", text: "Confirm with an independent replicate." },
    ]);
  });

  it("is idempotent and does not duplicate matching narrative", () => {
    const source = createScientificDocument(resultSections);
    source.sections[0].blocks.push({ id: "manual-summary", type: "text", text: "Observed response" });
    const once = resultDocumentWithLegacyValues(source, { textValue: "Observed response", numericValue: 8, unit: "%" });
    const twice = resultDocumentWithLegacyValues(once, { textValue: "Observed response", numericValue: 8, unit: "%" });

    expect(twice).toEqual(once);
    expect(twice.sections[0].blocks.filter((block) => block.type === "text" && block.text === "Observed response")).toHaveLength(1);
    expect(twice.sections[0].blocks.filter((block) => block.type === "metric")).toHaveLength(1);
  });

  it("keeps an edited promoted block authoritative by its stable id", () => {
    const document = createScientificDocument(resultSections);
    document.sections[0].blocks.push({ id: "legacy-result-summary", type: "text", text: "Edited summary" });

    const promoted = resultDocumentWithLegacyValues(document, { textValue: "Old summary" });

    expect(promoted.sections[0].blocks).toEqual([{ id: "legacy-result-summary", type: "text", text: "Edited summary" }]);
  });

  it("does not promote the historical empty-template placeholder as scientific content", () => {
    const promoted = resultDocumentWithLegacyValues(createScientificDocument(resultSections), {
      notes: "Template registered; no measurement has been entered.",
    });
    expect(promoted.sections[0].blocks).toEqual([]);
  });

  it("uses a reversible metadata marker instead of deleting historical scalar columns", () => {
    const metadata = withResultLegacyPromotionMarker({ source: "instrument" });
    expect(metadata.source).toBe("instrument");
    expect(resultLegacyValuesArePromoted(metadata)).toBe(true);
    expect(resultLegacyValuesArePromoted(null)).toBe(false);
  });
});
