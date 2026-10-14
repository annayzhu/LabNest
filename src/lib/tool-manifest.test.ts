import { describe, expect, it, vi } from "vitest";
import { labToolManifest, standaloneToolDefaultUrls } from "./tool-manifest";

describe("lab tool manifest", () => {
  it("lists the six studios plus Calculator in the requested groups", () => {
    expect(labToolManifest).toHaveLength(7);
    expect(labToolManifest.filter((tool) => tool.category === "Planning")).toHaveLength(3);
    expect(labToolManifest.filter((tool) => tool.category === "Calculators")).toHaveLength(1);
    expect(labToolManifest.filter((tool) => tool.category === "Analysis")).toHaveLength(3);
  });

  it("opens the qPCR planner at its maintained Site and leaves other bundled tools internal", () => {
    expect(Object.values(standaloneToolDefaultUrls)).toHaveLength(4);
    for (const launchUrl of Object.values(standaloneToolDefaultUrls)) {
      expect(new URL(launchUrl).protocol).toBe("https:");
    }

    const standaloneTools = labToolManifest.filter((tool) => tool.originalLaunchUrl);
    expect(standaloneTools).toHaveLength(4);
    expect(labToolManifest.find((tool) => tool.id === "qpcr-plate-layout")).toMatchObject({
      launchUrl: standaloneToolDefaultUrls.qpcrLayout,
      external: true,
    });
    expect(standaloneTools.filter((tool) => tool.id !== "qpcr-plate-layout").every((tool) => tool.launchUrl?.startsWith("/tools/") && !tool.external)).toBe(true);
  });

  it("offers the Studio migration route when unconfigured and preserves free plate planning", () => {
    expect(labToolManifest.find((tool) => tool.id === "visualization-studio")?.launchUrl).toBe("/tools/visualization");
    expect(labToolManifest.find((tool) => tool.id === "free-plate-layout")?.launchUrl).toMatch(/^\/tools\/free-plate-layout\/index\.html\?v=/);
  });

  it("connects Calculator to its internal catalog", () => {
    expect(labToolManifest.find((tool) => tool.id === "calculator")?.launchUrl).toBe("/tools/calculator");
  });
});

it("uses the configured qPCR Site for both the catalog and legacy entry", async () => {
  vi.stubEnv("QPCR_LAYOUT_TOOL_URL", "https://lab.example/qpcr/");
  vi.resetModules();
  try {
    const { labToolManifest: configured } = await import("./tool-manifest");
    expect(configured.find((tool) => tool.id === "qpcr-plate-layout")).toMatchObject({
      launchUrl: "https://lab.example/qpcr/",
      originalLaunchUrl: "https://lab.example/qpcr/",
      external: true,
    });
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
