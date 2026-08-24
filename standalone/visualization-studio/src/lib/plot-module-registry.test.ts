import { describe, expect, it } from "vitest";
import {
  createPlotModuleRegistry,
  type PlotModuleSeed,
} from "./plot-module-registry";
import {
  getPlotModule,
  inferPlotMapping,
  plotModuleRegistry,
  type PlotDefinition,
  type PlotGuidance,
} from "./visualization-studio";

const guidance: PlotGuidance = {
  definition: "A deliberately small test definition with enough detail.",
  suitableData: "Categorical labels and numeric values.",
  answers: "Whether groups differ in their displayed values.",
  references: [{ citation: "Test et al., 2026. Registry contract.", href: "https://doi.org/10.1000/registry" }],
};

function seed(id: string, overrides: Partial<PlotModuleSeed> = {}): PlotModuleSeed {
  const definition: PlotDefinition = {
    id: id as PlotDefinition["id"],
    name: id,
    family: "Test",
    summary: "Registry contract test.",
    inputHint: "One row per observation.",
    roles: [],
    defaultMapping: {},
    sampleData: "label\tvalue\nA\t1",
  };
  return {
    definition,
    guidance,
    renderer: "standard",
    capabilities: { dataShape: "long", settingKeys: [] },
    ...overrides,
  };
}

describe("plot-module registry interface", () => {
  it("normalizes a module behind one immutable public record", () => {
    const registry = createPlotModuleRegistry([seed("bar")]);
    const plotModule = registry.get("bar");

    expect(registry.list()).toEqual([plotModule]);
    expect(plotModule.definition.id).toBe("bar");
    expect(plotModule.guidance).toEqual(guidance);
    expect(plotModule.renderer).toBe("standard");
    expect(plotModule.capabilities.settingKeys).toEqual([]);
    expect(plotModule.examples).toEqual([
      {
        label: "Example 1",
        description: "Default input template for this plot type.",
        data: "label\tvalue\nA\t1",
        mapping: {},
      },
    ]);
    expect(Object.isFrozen(plotModule)).toBe(true);
    expect(Object.isFrozen(registry.list())).toBe(true);
  });

  it("rejects duplicate identifiers and incomplete registrations", () => {
    expect(() => createPlotModuleRegistry([seed("bar"), seed("bar")])).toThrow(/duplicate.*bar/i);
    expect(() => createPlotModuleRegistry([seed("bar", { guidance: undefined as never })])).toThrow(/bar.*guidance\.definition/i);
    expect(() => createPlotModuleRegistry([seed("bar", { renderer: undefined as never })])).toThrow(/bar.*renderer/i);
    expect(() => createPlotModuleRegistry([seed("bar", { definition: { ...seed("bar").definition, summary: "" } })])).toThrow(/bar.*definition\.summary/i);
    expect(() => createPlotModuleRegistry([seed("bar", { capabilities: { dataShape: "long", settingKeys: undefined as never } })])).toThrow(/bar.*setting keys/i);
    expect(() => createPlotModuleRegistry([seed("bar", { definition: { ...seed("bar").definition, roles: [{ key: "value", label: "Value", kind: "number", required: true }, { key: "value", label: "Again", kind: "number", required: false }] } })])).toThrow(/bar.*duplicate role key.*value/i);
    expect(() => createPlotModuleRegistry([seed("bar", { definition: { ...seed("bar").definition, examples: [{ label: "", description: "Bad", data: "x\n1" }] } })])).toThrow(/bar.*examples\[0\]\.label/i);
    expect(() => createPlotModuleRegistry([seed("bar", { capabilities: { dataShape: "long", settingKeys: ["widht"] } })], { allowedSettingKeys: ["width"] })).toThrow(/bar.*unknown adjustable setting key.*widht/i);
  });

  it("reports unknown plot modules instead of silently selecting another chart", () => {
    const registry = createPlotModuleRegistry([seed("bar")]);
    expect(() => registry.get("line")).toThrow(/unknown plot module.*line/i);
  });

  it("adapts all existing plots to the shared module contract", () => {
    expect(plotModuleRegistry.list()).toHaveLength(82);
    plotModuleRegistry.list().forEach((plotModule) => {
      expect(plotModule.definition.id).toBeTruthy();
      expect(plotModule.examples.length).toBeGreaterThan(0);
      expect(plotModule.guidance.references.length).toBeGreaterThan(0);
      expect(["standard", "advanced"]).toContain(plotModule.renderer);
      expect(plotModule.capabilities.dataShape).toBeTruthy();
      expect(plotModule.capabilities.settingKeys).toContain("width");
    });
    expect(getPlotModule("bar").renderer).toBe("standard");
    expect(getPlotModule("bar").capabilities.settingKeys).toContain("barBorderWidth");
    expect(getPlotModule("line").capabilities.settingKeys).toContain("swapAxes");
    expect(getPlotModule("line").capabilities.settingKeys).toEqual(expect.arrayContaining(["lineErrorType", "lineUncertaintyStyle", "lineBandOpacity"]));
    expect(getPlotModule("scatter").capabilities.settingKeys).toContain("swapAxes");
    expect(getPlotModule("scatter").renderer).toBe("advanced");
    expect(getPlotModule("scatter").capabilities.settingKeys).toEqual(expect.arrayContaining(["associationVariant", "associationFit", "associationShowConfidenceBand", "associationShowPValue", "associationGroupMode"]));
    expect(getPlotModule("correlation").capabilities.settingKeys).toEqual(expect.arrayContaining(["correlationMethod", "associationVariant", "associationFit"]));
    expect(getPlotModule("pca").capabilities.settingKeys).toContain("swapAxes");
    expect(getPlotModule("pca").renderer).toBe("advanced");
    expect(getPlotModule("pca").capabilities.settingKeys).toEqual(expect.arrayContaining(["ordinationView", "ordinationShowLoadings", "ordinationPermanovaR2"]));
    expect(getPlotModule("tsne").capabilities.dataShape).toBe("coordinates");
    expect(getPlotModule("network").capabilities.dataShape).toBe("network");
    expect(getPlotModule("network").capabilities.settingKeys).toEqual(expect.arrayContaining(["networkLayout", "networkSeed", "networkShowIsolates"]));
    expect(getPlotModule("tree").capabilities.dataShape).toBe("hierarchy");
    expect(getPlotModule("dendrogram").capabilities.settingKeys).toContain("treeOrientation");
    expect(getPlotModule("nmds").capabilities.settingKeys).toContain("ordinationStress");
    expect(getPlotModule("box").capabilities.settingKeys).not.toContain("legendPosition");
    expect(getPlotModule("circos").renderer).toBe("advanced");
    expect(getPlotModule("manhattan").capabilities.dataShape).toBe("genomic-coordinates");
    expect(getPlotModule("manhattan").capabilities.settingKeys).toContain("genomicSignificanceLog10");
    expect(getPlotModule("genome-tracks").capabilities.settingKeys).toContain("genomicTrackGap");
    expect(getPlotModule("oncoplot").capabilities.dataShape).toBe("alterations");
    expect(getPlotModule("oncoplot").capabilities.settingKeys).toContain("oncoplotShowMargins");
    expect(getPlotModule("motif-logo").capabilities.dataShape).toBe("motif-matrix");
    expect(getPlotModule("motif-logo").capabilities.settingKeys).toContain("motifDisplayMode");
    expect(getPlotModule("pie").capabilities.settingKeys).not.toContain("xLabel");
    expect(getPlotModule("pie").capabilities.settingKeys).not.toContain("grid");
    expect(getPlotModule("pie").capabilities.settingKeys).not.toContain("pointSize");
    expect(getPlotModule("radar").capabilities.settingKeys).toEqual(expect.arrayContaining(["gridLineWidth", "dataLineWidth", "pointSize"]));
    expect(getPlotModule("population-pyramid").capabilities.settingKeys).toContain("pyramidDisplayMode");
    expect(getPlotModule("raincloud").capabilities.numericAxes).toEqual(["x", "y"]);
    expect(getPlotModule("raincloud").capabilities.settingKeys).toEqual(expect.arrayContaining(["xMin", "xMax", "yMin", "yMax", "distributionOrientation"]));
  });

  it("infers exact and normalized aliases deterministically", () => {
    const enrichment = getPlotModule("enrichment").definition;
    expect(inferPlotMapping(enrichment, ["term", "Gene Ratio", "adjusted_p_value", "group"])).toMatchObject({
      term: "term",
      ratio: "Gene Ratio",
      pValue: "adjusted_p_value",
      group: "group",
    });

    const duplicateNormalized = inferPlotMapping(enrichment, ["term", "Gene Ratio", "gene_ratio", "adjusted_p_value"]);
    expect(duplicateNormalized.ratio).toBe("Gene Ratio");

    const scatter = getPlotModule("scatter").definition;
    expect(inferPlotMapping(scatter, ["group"])).toMatchObject({ x: "", y: "", group: "group", label: "" });
  });

  it("keeps the Rose example aligned with its ungrouped data contract", () => {
    const rose = getPlotModule("rose");
    const [header = ""] = rose.examples[0].data.trim().split(/\r?\n/);
    expect(header.split("\t")).toEqual(rose.definition.roles.map((role) => role.key));
  });
});
