(function attachColorCore(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ColorCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createColorCore() {
  "use strict";

  const BASE_PALETTE = Object.freeze([
    Object.freeze(["#dcece8", "#225e59", "#75a9a1"]),
    Object.freeze(["#f5dfd3", "#7b4936", "#d28c6b"]),
    Object.freeze(["#e5e1f2", "#554a77", "#9589bc"]),
    Object.freeze(["#f1e7c9", "#6d5b2e", "#c8ac5f"]),
    Object.freeze(["#dce7f2", "#3b5874", "#7ea0bf"]),
    Object.freeze(["#eadde6", "#6c4960", "#b985a4"]),
    Object.freeze(["#e3ead7", "#51643d", "#91a970"]),
    Object.freeze(["#ece2d9", "#655246", "#ad927e"]),
  ]);
  const NEUTRAL_COLOR = Object.freeze(["#f8f5f0", "#4f5550", "#c9c3bb"]);

  function normalizeCategory(value) {
    if (typeof value === "number") return Number.isFinite(value) ? String(value) : null;
    if (typeof value !== "string") return null;
    const normalized = value.trim();
    return normalized ? normalized : null;
  }

  function hslColor(index) {
    const hue = Math.round((18 + (index * 137.508)) % 360);
    return [`hsl(${hue} 42% 89%)`, `hsl(${hue} 42% 27%)`, `hsl(${hue} 38% 57%)`];
  }

  function createCategoryRegistry(values, palette = BASE_PALETTE) {
    const categories = [...new Set((values || []).map(normalizeCategory).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const colors = new Map(categories.map((category, index) => [category, index < palette.length ? [...palette[index]] : hslColor(index)]));
    return Object.freeze({
      categories: Object.freeze([...categories]),
      colorFor(value) {
        const category = normalizeCategory(value);
        return category && colors.has(category) ? [...colors.get(category)] : [...NEUTRAL_COLOR];
      },
    });
  }

  return { BASE_PALETTE, NEUTRAL_COLOR, normalizeCategory, createCategoryRegistry };
});
