import { describe, expect, it } from "vitest";
import { labToolManifest, standaloneToolDefaultUrls } from "./tool-manifest";

describe("lab tool manifest", () => {
  it("connects every standalone tool to a managed HTTPS release", () => {
    expect(Object.values(standaloneToolDefaultUrls)).toHaveLength(4);
    for (const launchUrl of Object.values(standaloneToolDefaultUrls)) {
      expect(new URL(launchUrl).protocol).toBe("https:");
    }

    const standaloneTools = labToolManifest.filter((tool) => tool.external);
    expect(standaloneTools).toHaveLength(4);
    expect(standaloneTools.every((tool) => Boolean(tool.launchUrl))).toBe(true);
  });
});
