import { describe, expect, it } from "vitest";
import { filterProtocolPickerOptions, type ResearchPlanProtocolOption } from "../lib/research-plan-protocol-picker";

const protocols: ResearchPlanProtocolOption[] = [
  { id: "p1", humanCode: "PRT-000001", title: "RNA extraction", scope: "general", projectId: null },
  { id: "p2", humanCode: "PRT-000002", title: "Western blot", scope: "project", projectId: "project-1" },
  { id: "p3", humanCode: null, title: "Live-cell imaging", scope: "general", projectId: null },
];

describe("Research Plan Protocol picker", () => {
  it("finds Protocol library options by code, title, or scope", () => {
    expect(filterProtocolPickerOptions(protocols, [], "000002").map((item) => item.id)).toEqual(["p2"]);
    expect(filterProtocolPickerOptions(protocols, [], "imaging").map((item) => item.id)).toEqual(["p3"]);
    expect(filterProtocolPickerOptions(protocols, [], "GENERAL").map((item) => item.id)).toEqual(["p1", "p3"]);
  });

  it("keeps already selected Protocols out of the library dropdown", () => {
    expect(filterProtocolPickerOptions(protocols, ["p1", "p3"], "").map((item) => item.id)).toEqual(["p2"]);
  });
});
