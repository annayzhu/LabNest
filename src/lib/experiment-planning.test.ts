import { describe, expect, it } from "vitest";
import { buildExperimentStepGroupTitle, buildProtocolExperimentSteps, experimentStepGroupHeading, orderedUniqueIds, parseCustomExperimentSteps } from "./experiment-planning";

describe("experiment planning", () => {
  it("preserves click order while removing duplicate ProtocolVersion ids", () => {
    expect(orderedUniqueIds(["v2", "v1", "v2", "", " v3 "])).toEqual(["v2", "v1", "v3"]);
  });

  it("turns Protocol Steps into ordered, grouped on-bench checklist snapshots", () => {
    const steps = buildProtocolExperimentSteps([
      {
        versionId: "version-b",
        humanCode: "PRT-002",
        protocolTitle: "Second protocol selected first",
        versionTitle: "Active method",
        displayVersion: "1.2",
        steps: [{ order: 2, title: "B2", description: "Keep source order value", requires_confirmation: true, allows_deviation: true }],
      },
      {
        versionId: "version-a",
        humanCode: "PRT-001",
        protocolTitle: "First protocol selected second",
        versionTitle: "Reviewed method",
        displayVersion: "1.0",
        steps: [{ order: 1, title: "A1", description: "Run after protocol B", requires_confirmation: true, allows_deviation: true }],
      },
    ]);

    expect(steps.map((step) => ({ groupKey: step.groupKey, groupOrder: step.groupOrder, order: step.order, title: step.title, description: step.description }))).toEqual([
      { groupKey: "version-b", groupOrder: 0, order: 2, title: "B2", description: "Keep source order value" },
      { groupKey: "version-a", groupOrder: 1, order: 1, title: "A1", description: "Run after protocol B" },
    ]);
    expect(steps.map((step) => step.groupTitle)).toEqual([
      "PRT-002 · Second protocol selected first · Active method · v1.2",
      "PRT-001 · First protocol selected second · Reviewed method · v1.0",
    ]);
  });

  it("omits a version title that only repeats the Protocol title and version", () => {
    expect(buildExperimentStepGroupTitle({
      humanCode: "PRT-100008",
      protocolTitle: "细胞RNA提取（Vazyme FastPure）",
      versionTitle: "细胞RNA提取（Vazyme FastPure） v0.2",
      displayVersion: "0.2",
    })).toBe("PRT-100008 · 细胞RNA提取（Vazyme FastPure） · v0.2");
  });

  it("presents legacy duplicate snapshot headings as one title plus version detail", () => {
    expect(experimentStepGroupHeading("PRT-100008 · 细胞RNA提取（Vazyme FastPure） · 细胞RNA提取（Vazyme FastPure） v0.2 · v0.2")).toEqual({
      title: "细胞RNA提取（Vazyme FastPure）",
      detail: "PRT-100008 · v0.2",
    });
    expect(experimentStepGroupHeading("PRT-002 · RNA extraction · Low-input variant · v1.2")).toEqual({
      title: "RNA extraction",
      detail: "PRT-002 · Low-input variant · v1.2",
    });
  });

  it("parses custom bench steps without inventing descriptions", () => {
    expect(parseCustomExperimentSteps("1. Seed cells | 2e5 per well\nIncubate overnight\n\n3、Image | 20× objective")).toEqual([
      { order: 1, title: "Seed cells", description: "2e5 per well", requires_confirmation: true, allows_deviation: true },
      { order: 2, title: "Incubate overnight", description: "", requires_confirmation: true, allows_deviation: true },
      { order: 3, title: "Image", description: "20× objective", requires_confirmation: true, allows_deviation: true },
    ]);
  });
});
