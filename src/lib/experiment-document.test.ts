import { describe, expect, it } from "vitest";
import {
  appendExperimentObservation,
  experimentDocumentFromNarrative,
  experimentNarrativeFromDocument,
  experimentSearchText,
} from "./experiment-document";
import { createScientificDocument, experimentSections } from "./scientific-document";

describe("Experiment structured document", () => {
  it("indexes every supported block type without making the mirror authoritative", () => {
    const document = createScientificDocument(experimentSections);
    document.sections[0]!.blocks.push({ id: "text", type: "text", text: "Serum starvation rationale" });
    document.sections[1]!.blocks.push({ id: "table", type: "table", rows: [["Sample", "Dose"], ["A549", "10 nM"]] });
    document.sections[2]!.blocks.push({ id: "checklist", type: "checklist", items: ["Wash cells", "Add reagent"] });
    document.sections[3]!.blocks.push({ id: "media", type: "media", mediaType: "image", url: "/api/attachments/image", caption: "Confluence before treatment" });
    document.sections[4]!.blocks.push({ id: "warning", type: "callout", tone: "warning", text: "Incubator recovery was delayed" });
    document.sections[5]!.blocks.push({ id: "metric", type: "metric", label: "Viability", value: "92", unit: "%" });

    const text = experimentSearchText("Confirm treatment response", document);

    expect(text).toContain("Confirm treatment response");
    expect(text).toContain("Serum starvation rationale");
    expect(text).toContain("A549");
    expect(text).toContain("Wash cells");
    expect(text).toContain("Confluence before treatment");
    expect(text).toContain("Incubator recovery was delayed");
    expect(text).toContain("Viability: 92 %");
  });

  it("appends run notes while preserving migrated and previously authored blocks", () => {
    const original = createScientificDocument(experimentSections);
    original.sections[3]!.blocks.push({ id: "observations-legacy", type: "text", text: "Legacy observation" });

    const next = appendExperimentObservation(original, {
      id: "run-note-1",
      text: "  Cells remained attached after washing.  ",
      recordedAt: new Date("2026-08-10T01:02:03.000Z"),
    });

    expect(next.sections[3]!.blocks).toEqual([
      { id: "observations-legacy", type: "text", text: "Legacy observation" },
      { id: "run-note-1", type: "text", text: "[2026-08-10T01:02:03.000Z]\nCells remained attached after washing." },
    ]);
    expect(original.sections[3]!.blocks).toHaveLength(1);
  });

  it("round-trips portable narrative fields and keeps summary and conclusion distinct", () => {
    const document = experimentDocumentFromNarrative({
      background: "Biological rationale",
      materials: "A549 cells and vehicle control",
      steps: "Wash, treat, incubate",
      observations: "No visible detachment",
      deviations: "Incubation extended by five minutes",
      resultSummary: "Signal increased",
      conclusion: "Repeat with an independent batch",
    });

    expect(document.sections.find((section) => section.key === "conclusion")?.blocks).toHaveLength(2);
    expect(experimentNarrativeFromDocument(document)).toEqual({
      background: "Biological rationale",
      materials: "A549 cells and vehicle control",
      steps: "Wash, treat, incubate",
      observations: "No visible detachment",
      deviations: "Incubation extended by five minutes",
      conclusion: "Signal increased\nRepeat with an independent batch",
    });
  });
});
