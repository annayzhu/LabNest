import { createRef } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ScientificChartPreview } from "@/components/ScientificChartPreview";
import {
  defaultVisualizationPaletteSeriesId,
  defaultVisualizationSettings,
  defaultVisualizationThemeId,
  getPlotDefinition,
  inferPlotMapping,
  journalThemes,
  parseDelimitedData,
  plotModuleRegistry,
} from "./visualization-studio";

describe("Visualization Studio release contract", () => {
  it("ships 82 complete, uniquely addressable scientific modules", () => {
    const modules = plotModuleRegistry.list();
    expect(modules).toHaveLength(82);
    expect(new Set(modules.map(({ definition }) => definition.id)).size).toBe(82);

    modules.forEach((module) => {
      expect(module.definition.summary.trim().length).toBeGreaterThan(20);
      expect(module.definition.inputHint.trim().length).toBeGreaterThan(10);
      expect(module.examples.length).toBeGreaterThan(0);
      module.examples.forEach((example) => {
        expect(example.label.trim()).not.toBe("");
        expect(example.description.trim()).not.toBe("");
        expect(example.data.trim().split(/\r?\n/).length).toBeGreaterThan(1);
      });
      expect(module.guidance.definition.trim().length).toBeGreaterThan(20);
      expect(module.guidance.suitableData.trim().length).toBeGreaterThan(15);
      expect(module.guidance.answers.trim().length).toBeGreaterThan(15);
      expect(module.guidance.references.length).toBeGreaterThan(0);
      module.guidance.references.forEach((reference) => {
        expect(reference.citation.trim().length).toBeGreaterThan(10);
        expect(reference.href).toMatch(/^https:\/\//);
      });
    });
  });

  it("locks the compact publication defaults and restrained Chinese-traditional palette", () => {
    expect(defaultVisualizationSettings).toMatchObject({
      width: 340,
      height: 340,
      fontFamily: "arial",
      categoricalColors: ["#8A6F58", "#355F61", "#C99573", "#71877C"],
      divergingLow: "#9AADB0",
      divergingMid: "#FAF8F4",
      divergingHigh: "#D5B49E",
    });
    expect(defaultVisualizationPaletteSeriesId).toBe("chinese-traditional");
    expect(defaultVisualizationThemeId).toBe("cn-beihai");
    expect(journalThemes[defaultVisualizationThemeId].name).toBe("柴染棕");
  });

  it.each(["bar", "correlation-heatmap"] as const)("exports accessible black semantic text for %s", (type) => {
    const definition = getPlotDefinition(type);
    const dataset = parseDelimitedData(definition.sampleData);
    const mapping = inferPlotMapping(definition, dataset.headers);
    const markup = renderToStaticMarkup(
      <ScientificChartPreview
        svgRef={createRef<SVGSVGElement>()}
        type={type}
        dataset={dataset}
        mapping={mapping}
        settings={defaultVisualizationSettings}
        themeId={defaultVisualizationThemeId}
      />,
    );

    expect(markup).toContain('width="340"');
    expect(markup).toContain('height="340"');
    expect(markup).toContain('data-chart-text-color="#23242A"');
    expect(markup).toContain("<title>");
    expect(markup).toContain("<desc>");
    expect(markup).toContain("Arial");
  });
});
