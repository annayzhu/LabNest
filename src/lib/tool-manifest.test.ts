import { describe, expect, it } from "vitest";
import { labToolManifest, standaloneToolDefaultUrls } from "./tool-manifest";

describe("lab tool manifest", () => {
  it("lists the six studios plus Calculator in the requested groups", () => {
    expect(labToolManifest).toHaveLength(7);
    expect(labToolManifest.filter((tool) => tool.category === "Planning")).toHaveLength(3);
    expect(labToolManifest.filter((tool) => tool.category === "Calculators")).toHaveLength(1);
    expect(labToolManifest.filter((tool) => tool.category === "Analysis")).toHaveLength(3);
  });

  it("connects every standalone tool to a managed HTTPS release", () => {
    expect(Object.values(standaloneToolDefaultUrls)).toHaveLength(4);
    for (const launchUrl of Object.values(standaloneToolDefaultUrls)) {
      expect(new URL(launchUrl).protocol).toBe("https:");
    }

    const standaloneTools = labToolManifest.filter((tool) => tool.external);
    expect(standaloneTools).toHaveLength(4);
    expect(standaloneTools.every((tool) => Boolean(tool.launchUrl))).toBe(true);
  });

  it("keeps both visualization and free plate planning inside LabNest", () => {
    expect(labToolManifest.find((tool) => tool.id === "visualization-studio")?.launchUrl).toBe("/tools/visualization");
    expect(labToolManifest.find((tool) => tool.id === "free-plate-layout")?.launchUrl).toBe("/tools/free-plate-layout/index.html?v=20260826-2");
  });

  it("connects Calculator to its internal catalog", () => {
    expect(labToolManifest.find((tool) => tool.id === "calculator")?.launchUrl).toBe("/tools/calculator");
  });
});
