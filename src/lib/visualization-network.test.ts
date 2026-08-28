import { describe, expect, it } from "vitest";
import {
  deterministicNetworkLayout,
  hierarchyLayoutMetrics,
  networkEdgeGeometries,
  networkFrameMetrics,
  networkLayoutMetrics,
  parseNetworkRecords,
} from "./visualization-network";
import {
  defaultVisualizationSettings,
  getPlotDefinition,
  parseDelimitedData,
  plotModuleRegistry,
  validatePlotDataset,
  type PlotType,
} from "./visualization-studio";

const relationshipTypes: PlotType[] = ["network", "ppi", "cerna", "mirna-target", "cnet", "enrichment-map", "tree", "dendrogram"];

describe("network and hierarchy contracts", () => {
  it("ships valid realistic examples with references and explicit advanced renderers", () => {
    relationshipTypes.forEach((id) => {
      const plotModule = plotModuleRegistry.get(id);
      const dataset = parseDelimitedData(plotModule.definition.sampleData);
      expect(dataset.rows.length, id).toBeGreaterThanOrEqual(id === "tree" ? 7 : id === "dendrogram" ? 9 : 9);
      expect(validatePlotDataset(plotModule.definition, dataset, plotModule.definition.defaultMapping, defaultVisualizationSettings).errors, id).toEqual([]);
      expect(plotModule.renderer, id).toBe("advanced");
      expect(plotModule.guidance.references.length, id).toBeGreaterThan(0);
    });
  });

  it("preserves direction, weight, sign, type, grouping, and explicit isolated nodes", () => {
    const definition = getPlotDefinition("ppi");
    const dataset = parseDelimitedData(definition.sampleData);
    const parsed = parseNetworkRecords("ppi", dataset.rows, definition.defaultMapping);
    expect(parsed.nodes.find((node) => node.id === "Isolated_candidate")).toMatchObject({ explicit: true, group: "Candidate", nodeType: "Protein" });
    expect(parsed.edges[0]).toMatchObject({ source: "TP53", target: "MDM2", weight: 0.92, direction: "undirected", sign: "neutral", edgeType: "physical" });
    expect(parsed.nodes.every((node) => node.explicit)).toBe(true);
  });

  it("produces identical coordinates for one seed and a changed circular rotation for another", () => {
    const definition = getPlotDefinition("network");
    const parsed = parseNetworkRecords("network", parseDelimitedData(definition.sampleData).rows, definition.defaultMapping);
    const frame = { left: 14, top: 24, plotWidth: 220, plotHeight: 240 };
    const first = deterministicNetworkLayout(parsed.nodes, parsed.edges, frame, "circular", 42);
    const repeat = deterministicNetworkLayout(parsed.nodes, parsed.edges, frame, "circular", 42);
    const changed = deterministicNetworkLayout(parsed.nodes, parsed.edges, frame, "circular", 43);
    expect([...first.positions]).toEqual([...repeat.positions]);
    expect([...first.positions]).not.toEqual([...changed.positions]);
  });

  it("rejects incomplete records, undeclared endpoints, invalid edge semantics, and duplicate nodes", () => {
    const definition = getPlotDefinition("network");
    const data = parseDelimitedData([
      "record_type\tnode\tsource\ttarget\tweight\tdirection\tsign\tedge_type\tgroup\tnode_type\tnode_value",
      "node\tA\t\t\t\t\t\t\tG1\tType\t1",
      "node\tA\t\t\t\t\t\t\tG1\tType\t1",
      "edge\t\tA\tB\t-2\tsideways\tmixed\trel\tEdges\t\t",
      "other\tC\t\t\t\t\t\t\tG2\tType\t1",
    ].join("\n"));
    const errors = validatePlotDataset(definition, data, definition.defaultMapping, defaultVisualizationSettings).errors.join(" ");
    expect(errors).toMatch(/node or edge/i);
    expect(errors).toMatch(/non-negative/i);
    expect(errors).toMatch(/directed, undirected, or bidirectional/i);
    expect(errors).toMatch(/positive, negative, or neutral/i);
    expect(errors).toMatch(/Node IDs must be unique/i);
  });

  it("enforces specialized miRNA, Cnet, and enrichment-map meanings", () => {
    const invalidMiRna = parseDelimitedData("record_type\tnode\tsource\ttarget\tweight\tdirection\tsign\tedge_type\tgroup\tnode_type\tnode_value\nnode\tGeneA\t\t\t\t\t\t\tGene\tmRNA\t1\nnode\tGeneB\t\t\t\t\t\t\tGene\tmRNA\t1\nedge\t\tGeneA\tGeneB\t1\tdirected\tnegative\tpredicted\tE\t\t");
    const mirna = getPlotDefinition("mirna-target");
    expect(validatePlotDataset(mirna, invalidMiRna, mirna.defaultMapping, defaultVisualizationSettings).errors.join(" ")).toMatch(/directed miRNA.*mRNA\/gene target contract/i);
    const undirectedMiRna = parseDelimitedData(mirna.sampleData.replace(/\tdirected\t/g, "\tundirected\t"));
    expect(validatePlotDataset(mirna, undirectedMiRna, mirna.defaultMapping, defaultVisualizationSettings).errors.join(" ")).toMatch(/directed miRNA.*target contract/i);

    const invalidCnet = parseDelimitedData("record_type\tnode\tsource\ttarget\tweight\tdirection\tsign\tedge_type\tgroup\tnode_type\tnode_value\nnode\tG1\t\t\t\t\t\t\tGene\tGene\t1\nnode\tG2\t\t\t\t\t\t\tGene\tGene\t1\nedge\t\tG1\tG2\t1\tundirected\tneutral\tmembership\tE\t\t");
    const cnet = getPlotDefinition("cnet");
    expect(validatePlotDataset(cnet, invalidCnet, cnet.defaultMapping, defaultVisualizationSettings).errors.join(" ")).toMatch(/term–gene membership/i);
    expect(validatePlotDataset(cnet, parseDelimitedData(cnet.sampleData.replace(/\tundirected\t/g, "\tdirected\t")), cnet.defaultMapping, defaultVisualizationSettings).errors.join(" ")).toMatch(/term–gene membership/i);

    const enrichment = getPlotDefinition("enrichment-map");
    const tooLargeSimilarity = enrichment.sampleData.replace("0.62\tundirected", "1.62\tundirected");
    expect(validatePlotDataset(enrichment, parseDelimitedData(tooLargeSimilarity), enrichment.defaultMapping, defaultVisualizationSettings).errors.join(" ")).toMatch(/similarity weight.*above 1/i);

    const invalidPpi = parseDelimitedData("record_type\tnode\tsource\ttarget\tweight\tdirection\tsign\tedge_type\tgroup\tnode_type\tnode_value\nnode\tP1\t\t\t\t\t\t\tG\tProtein\t1\nnode\tRNA1\t\t\t\t\t\t\tG\tmRNA\t1\nedge\t\tP1\tRNA1\t1\tundirected\tneutral\tphysical\tE\t\t");
    const ppi = getPlotDefinition("ppi");
    expect(validatePlotDataset(ppi, invalidPpi, ppi.defaultMapping, defaultVisualizationSettings).errors.join(" ")).toMatch(/every endpoint node.*Protein/i);
    const misleadingPpi = parseDelimitedData("record_type\tnode\tsource\ttarget\tweight\tdirection\tsign\tedge_type\tgroup\tnode_type\tnode_value\nnode\tP1\t\t\t\t\t\t\tG\tProtein\t1\nnode\tP2\t\t\t\t\t\t\tG\tnonprotein\t1\nedge\t\tP1\tP2\t1\tundirected\tneutral\tphysical\tE\t\t");
    expect(validatePlotDataset(ppi, misleadingPpi, ppi.defaultMapping, defaultVisualizationSettings).errors.join(" ")).toMatch(/every endpoint node.*Protein/i);

    const invalidCeRna = parseDelimitedData("record_type\tnode\tsource\ttarget\tweight\tdirection\tsign\tedge_type\tgroup\tnode_type\tnode_value\nnode\tL1\t\t\t\t\t\t\tG\tlncRNA\t1\nnode\tM1\t\t\t\t\t\t\tG\tmRNA\t1\nedge\t\tL1\tM1\t1\tundirected\tneutral\trel\tE\t\t");
    const cerna = getPlotDefinition("cerna");
    expect(validatePlotDataset(cerna, invalidCeRna, cerna.defaultMapping, defaultVisualizationSettings).errors.join(" ")).toMatch(/directed miRNA.*non-miRNA RNA/i);

    const invalidEnrichment = enrichment.sampleData.replace("node\tApoptosis", "node\tApoptosis").replace("Stress response\tTerm\t11", "Stress response\tProtein\t11").replace("0.49\tundirected", "0.49\tdirected");
    const enrichmentErrors = validatePlotDataset(enrichment, parseDelimitedData(invalidEnrichment), enrichment.defaultMapping, defaultVisualizationSettings).errors.join(" ");
    expect(enrichmentErrors).toMatch(/term nodes only/i);
    expect(enrichmentErrors).toMatch(/must be undirected/i);
    expect(validatePlotDataset(enrichment, parseDelimitedData(enrichment.sampleData), { ...enrichment.defaultMapping, weight: "" }, defaultVisualizationSettings).errors.join(" ")).toMatch(/require a mapped Weight column/i);
    expect(validatePlotDataset(enrichment, parseDelimitedData(enrichment.sampleData.replace("Stress response\tTerm\t11", "Stress response\tnonterm\t11")), enrichment.defaultMapping, defaultVisualizationSettings).errors.join(" ")).toMatch(/term nodes only/i);
  });

  it("requires complete mapped node values and edge weights instead of mixing visual meanings", () => {
    const definition = getPlotDefinition("network");
    const partial = parseDelimitedData("record_type\tnode\tsource\ttarget\tweight\tdirection\tsign\tedge_type\tgroup\tnode_type\tnode_value\nnode\tA\t\t\t\t\t\t\tG\tCell\t1\nnode\tB\t\t\t\t\t\t\tG\tCell\t\nedge\t\tA\tB\t\tdirected\tpositive\trel\tE\t\t");
    const errors = validatePlotDataset(definition, partial, definition.defaultMapping, defaultVisualizationSettings).errors.join(" ");
    expect(errors).toMatch(/every node row needs a numeric value/i);
    expect(errors).toMatch(/every edge row needs a numeric weight/i);
    const unweighted = validatePlotDataset(definition, partial, { ...definition.defaultMapping, weight: "", nodeValue: "" }, defaultVisualizationSettings);
    expect(unweighted.errors.join(" ")).not.toMatch(/numeric weight|numeric value/i);
  });

  it("keeps tree hierarchy separate and validates dendrogram merge heights", () => {
    const tree = getPlotDefinition("tree");
    const cycle = parseDelimitedData("node\tparent\tlabel\tgroup\theight\nA\tC\tA\tG\t0\nB\tA\tB\tG\t0\nC\tB\tC\tG\t0");
    expect(validatePlotDataset(tree, cycle, tree.defaultMapping, defaultVisualizationSettings).errors.join(" ")).toMatch(/exactly one blank-parent root|cycle/i);

    const dendrogram = getPlotDefinition("dendrogram");
    const descending = parseDelimitedData("node\tparent\tlabel\tgroup\theight\nRoot\t\tRoot\tInternal\t0.2\nA\tRoot\tA\tG\t0.5\nB\tRoot\tB\tG\t0");
    expect(validatePlotDataset(dendrogram, descending, dendrogram.defaultMapping, defaultVisualizationSettings).errors.join(" ")).toMatch(/parent merge height below its child/i);
    const elevatedLeaf = parseDelimitedData("node\tparent\tlabel\tgroup\theight\nRoot\t\tRoot\tInternal\t0.2\nA\tRoot\tA\tG\t0.1\nB\tRoot\tB\tG\t0");
    expect(validatePlotDataset(dendrogram, elevatedLeaf, dendrogram.defaultMapping, defaultVisualizationSettings).errors.join(" ")).toMatch(/leaf heights must be zero/i);
  });

  it("blocks dense graphs by actual compact-canvas capacity", () => {
    const rows = ["record_type\tnode\tsource\ttarget\tweight\tdirection\tsign\tedge_type\tgroup\tnode_type\tnode_value"];
    for (let index = 0; index < 120; index += 1) rows.push(`node\tN${index}\t\t\t\t\t\t\tG\tNode\t1`);
    for (let index = 1; index < 120; index += 1) rows.push(`edge\t\tN0\tN${index}\t1\tundirected\tneutral\trel\tE\t\t`);
    const definition = getPlotDefinition("network");
    expect(validatePlotDataset(definition, parseDelimitedData(rows.join("\n")), definition.defaultMapping, defaultVisualizationSettings).errors.join(" ")).toMatch(/not pixel-safe.*node collision/i);
    expect(validatePlotDataset(definition, parseDelimitedData(rows.join("\n")), definition.defaultMapping, { ...defaultVisualizationSettings, networkLayout: "layered" }).errors.join(" ")).toMatch(/not pixel-safe.*node collision/i);
  });

  it("shares exact frames and includes node and curved-edge bounds in pixel safety", () => {
    expect(hierarchyLayoutMetrics({ ...defaultVisualizationSettings, legendPosition: "bottom" }, 8, 4, true)).toMatchObject(networkFrameMetrics({ ...defaultVisualizationSettings, legendPosition: "bottom" }));
    expect(hierarchyLayoutMetrics({ ...defaultVisualizationSettings, legendPosition: "bottom", treeOrientation: "vertical" }, 60, 4, true).fits).toBe(false);
    expect(hierarchyLayoutMetrics({ ...defaultVisualizationSettings, treeOrientation: "vertical" }, 120, 4, false).fits).toBe(false);
    expect(hierarchyLayoutMetrics({ ...defaultVisualizationSettings, treeOrientation: "horizontal" }, 120, 4, false).fits).toBe(false);
    const frame = { width: 100, height: 100, left: 0, right: 0, top: 0, bottom: 0, plotWidth: 100, plotHeight: 100 };
    const nodes = [
      { id: "A", group: "G", nodeType: "Cell", value: 1, explicit: true },
      { id: "B", group: "G", nodeType: "Cell", value: 2, explicit: true },
    ];
    const reciprocalEdges = [
      { source: "A", target: "B", weight: 1, direction: "directed" as const, sign: "positive" as const, edgeType: "rel", group: "E", index: 0 },
      { source: "B", target: "A", weight: 1, direction: "directed" as const, sign: "positive" as const, edgeType: "rel", group: "E", index: 1 },
    ];
    const positions = new Map([["A", { x: 20, y: 50 }], ["B", { x: 80, y: 50 }]]);
    const radii = new Map([["A", 5], ["B", 5]]);
    const reciprocalGeometry = networkEdgeGeometries(reciprocalEdges, positions, radii, frame);
    expect(reciprocalGeometry.get(0)?.d).not.toBe(reciprocalGeometry.get(1)?.d);
    expect(reciprocalGeometry.get(0)?.points[1]).not.toEqual(reciprocalGeometry.get(1)?.points[1]);

    const loopGeometry = networkEdgeGeometries([{ ...reciprocalEdges[0], source: "A", target: "A" }], new Map([["A", { x: 50, y: 10 }]]), new Map([["A", 5]]), frame).get(0)!;
    expect(loopGeometry.points.every((point) => point.x >= 0 && point.x <= 100 && point.y >= 0 && point.y <= 100)).toBe(true);

    const manyEdges = Array.from({ length: 40 }, (_, index) => ({ ...reciprocalEdges[index % 2], index }));
    const metrics = networkLayoutMetrics({ ...defaultVisualizationSettings, width: 340, height: 340, legendPosition: "none" }, nodes, manyEdges, true);
    expect(metrics.edgeBoundaryIssues).toBeGreaterThan(0);
    expect(metrics.fits).toBe(false);

    const boundaryNodes = Array.from({ length: 4 }, (_, index) => ({ id: `N${index}`, group: "G", nodeType: "Cell", value: index === 0 ? 100 : 1, explicit: true }));
    const boundaryEdges = boundaryNodes.slice(1).map((node, index) => ({ source: "N0", target: node.id, weight: 1, direction: "undirected" as const, sign: "neutral" as const, edgeType: "rel", group: "E", index }));
    const boundaryMetrics = Array.from({ length: 200 }, (_, seed) => networkLayoutMetrics({ ...defaultVisualizationSettings, width: 181, height: 200, legendPosition: "right", networkSeed: seed }, boundaryNodes, boundaryEdges, true)).find((candidate) => candidate.nodesOutsidePlot > 0);
    expect(boundaryMetrics?.fits).toBe(false);
  });

  it("blocks bottom legends that would truncate numeric size and weight endpoints", () => {
    const definition = getPlotDefinition("network");
    const dataset = parseDelimitedData(definition.sampleData);
    const compactErrors = validatePlotDataset(definition, dataset, definition.defaultMapping, { ...defaultVisualizationSettings, legendPosition: "bottom" }).errors.join(" ");
    expect(compactErrors).toMatch(/complete entry/i);
    const wideErrors = validatePlotDataset(definition, dataset, definition.defaultMapping, { ...defaultVisualizationSettings, legendPosition: "bottom", width: 800 }).errors.join(" ");
    expect(wideErrors).not.toMatch(/network legend/i);
  });
});
