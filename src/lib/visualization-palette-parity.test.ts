import { describe, expect, it } from "vitest";
import {
  defaultVisualizationPaletteSeriesId as embeddedDefaultSeries,
  defaultVisualizationThemeId as embeddedDefaultTheme,
  journalThemes as embeddedThemes,
  paletteSeries as embeddedSeries,
} from "./visualization-studio";
import {
  defaultVisualizationPaletteSeriesId as standaloneDefaultSeries,
  defaultVisualizationThemeId as standaloneDefaultTheme,
  journalThemes as standaloneThemes,
  paletteSeries as standaloneSeries,
} from "../../standalone/visualization-studio/src/lib/visualization-studio";

describe("Visualization Studio palette parity", () => {
  it("keeps every shared built-in palette identical in embedded and standalone builds", () => {
    expect(Object.keys(standaloneThemes)).toEqual(Object.keys(embeddedThemes));
    expect(standaloneSeries).toEqual(embeddedSeries);
    expect(standaloneDefaultTheme).toBe(embeddedDefaultTheme);
    expect(standaloneDefaultSeries).toBe(embeddedDefaultSeries);
    Object.entries(embeddedThemes).forEach(([id, theme]) => {
      expect(standaloneThemes[id as keyof typeof standaloneThemes]).toEqual(theme);
    });
  });
});
