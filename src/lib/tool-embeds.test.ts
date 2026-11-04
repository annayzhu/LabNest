import { describe, expect, it } from "vitest";
import { labToolManifest } from "./tool-manifest";
import { mergedCatalogTools, toolEmbeds } from "./tool-embeds";

describe("tools in the / menu", () => {
  it("covers the catalog, with the free planner reached through Plate layout", () => {
    expect([...toolEmbeds.map((tool) => tool.id), ...mergedCatalogTools].sort()).toEqual(labToolManifest.map((tool) => tool.id).sort());
  });
});
