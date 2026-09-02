import { describe, expect, it } from "vitest";
import { systemThemeCssText, systemThemes } from "./system-theme";

function relativeLuminance(hex: string) {
  const [red, green, blue] = hex.match(/[\da-f]{2}/gi)!.map((part) => {
    const channel = Number.parseInt(part, 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
}

function contrastRatio(first: string, second: string) {
  const luminances = [relativeLuminance(first), relativeLuminance(second)].sort((left, right) => right - left);
  return (luminances[0] + 0.05) / (luminances[1] + 0.05);
}

function rgbDistance(first: string, second: string) {
  const channels = (hex: string) => hex.match(/[\da-f]{2}/gi)!.map((part) => Number.parseInt(part, 16));
  const left = channels(first);
  const right = channels(second);
  return Math.hypot(...left.map((channel, index) => channel - right[index]));
}

describe("system themes", () => {
  it("offers at least seven visibly distinct traditional palettes", () => {
    expect(systemThemes.length).toBeGreaterThanOrEqual(7);
  });

  it("gives every theme a contrasting, readable navigation selection color", () => {
    systemThemes.forEach((theme) => {
      expect(rgbDistance(theme.colors[1], theme.colors[2]), theme.name).toBeGreaterThan(75);
      expect(contrastRatio(theme.navigation.background, theme.navigation.foreground), theme.name).toBeGreaterThanOrEqual(4.5);
    });
  });

  it("reserves a readable collision color for decisive actions", () => {
    systemThemes.forEach((theme) => {
      const tokens = theme.tokens;
      expect(rgbDistance(tokens["--action"], tokens["--contrast-action"]), theme.name).toBeGreaterThan(65);
      expect(contrastRatio(tokens["--contrast-action"], tokens["--contrast-action-fg"]), theme.name).toBeGreaterThanOrEqual(4.5);
    });
  });

  it("separates moon-dai from celadon-pine instead of offering two near-identical green themes", () => {
    const moonDai = systemThemes.find((theme) => theme.id === "moon-dai")!;
    const celadonPine = systemThemes.find((theme) => theme.id === "celadon-pine")!;
    expect(rgbDistance(moonDai.colors[1], celadonPine.colors[1])).toBeGreaterThan(75);
  });

  it("generates every runtime theme selector from the typed theme manifest", () => {
    const css = systemThemeCssText();
    systemThemes.forEach((theme) => {
      expect(css).toContain(`data-labnest-theme="${theme.id}"`);
      expect(css).toContain(`--nav-active-bg:${theme.navigation.background}`);
    });
  });
});
