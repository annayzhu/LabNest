import { describe, expect, it, vi } from "vitest";
import { labToolManifest } from "./tool-manifest";

describe("lab tool manifest", () => {
  it("lists the six studios plus Calculator in the requested groups", () => {
    expect(labToolManifest).toHaveLength(7);
    expect(labToolManifest.filter((tool) => tool.category === "Planning")).toHaveLength(3);
    expect(labToolManifest.filter((tool) => tool.category === "Calculators")).toHaveLength(1);
    expect(labToolManifest.filter((tool) => tool.category === "Analysis")).toHaveLength(3);
  });

  it("opens all six bundled tools in the current LabNest deployment", () => {
    const bundledTools = labToolManifest.filter((tool) => tool.id !== "visualization-studio");
    expect(bundledTools).toHaveLength(6);
    for (const tool of bundledTools) {
      expect(tool.launchUrl).toMatch(/^\/tools\//);
      expect(tool.external).toBe(false);
    }
    expect(bundledTools.find((tool) => tool.id === "qpcr-plate-layout")?.launchUrl).toBe("/tools/qpcr-plate-layout");
  });

  it("offers the Studio migration route when unconfigured and preserves free plate planning", () => {
    expect(labToolManifest.find((tool) => tool.id === "visualization-studio")?.launchUrl).toBe("/tools/visualization");
    expect(labToolManifest.find((tool) => tool.id === "free-plate-layout")?.launchUrl).toMatch(/^\/tools\/free-plate-layout\/index\.html\?v=/);
  });

  it("connects Calculator to its internal catalog", () => {
    expect(labToolManifest.find((tool) => tool.id === "calculator")?.launchUrl).toBe("/tools/calculator");
  });
});

it("does not redirect bundled tools when legacy external URL overrides are present", async () => {
  for (const name of ["QPCR_LAYOUT_TOOL_URL", "CNV_LAYOUT_TOOL_URL", "QPCR_ANALYSIS_TOOL_URL", "CNV_ANALYSIS_TOOL_URL"]) {
    vi.stubEnv(name, "https://lab.example/legacy/");
  }
  vi.resetModules();
  try {
    const { labToolManifest: configured } = await import("./tool-manifest");
    expect(configured).toEqual(labToolManifest);
  } finally {
    vi.unstubAllEnvs();
    vi.resetModules();
  }
});

it('opens only Studio externally when its independent endpoint is configured',async()=>{
 vi.stubEnv('VISUALIZATION_STUDIO_URL','https://lab.example/studio/');vi.resetModules();
 try {const {labToolManifest:configured}=await import('./tool-manifest');expect(configured.find(tool=>tool.id==='visualization-studio')).toMatchObject({launchUrl:'https://lab.example/studio/',external:true});expect(configured.filter(tool=>tool.id!=='visualization-studio')).toEqual(labToolManifest.filter(tool=>tool.id!=='visualization-studio'));}
 finally {vi.unstubAllEnvs();vi.resetModules();}
});
