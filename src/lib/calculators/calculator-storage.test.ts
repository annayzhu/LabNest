import { describe, expect, it } from "vitest";
import {
  addHistoryEntry,
  clearHistory,
  createEmptyCalculatorState,
  deleteHistoryEntry,
  parseCalculatorState,
  sanitizePersistedInputs,
  saveCalculatorState,
  toggleFavorite,
} from "./calculator-storage";

describe("calculator local state", () => {
  it("keeps favorites stable without duplicates", () => {
    const first = toggleFavorite(createEmptyCalculatorState(), "dilution");
    expect(first.favorites).toEqual(["dilution"]);
    expect(toggleFavorite(first, "dilution").favorites).toEqual([]);
  });

  it("keeps only the newest 50 history entries", () => {
    let state = createEmptyCalculatorState();
    for (let index = 0; index < 55; index += 1) {
      state = addHistoryEntry(state, {
        id: `run-${index}`,
        calculatorId: "dilution",
        calculatorName: "Dilution",
        calculatorNameZh: "常规稀释",
        createdAt: new Date(2026, 0, 1, 0, index).toISOString(),
        methodVersion: "dilution-v1",
        inputs: { finalVolume: index },
        outputs: [{ key: "stockVolume", label: "Stock", labelZh: "母液", value: index, unit: "mL" }],
        warnings: [],
      });
    }

    expect(state.history).toHaveLength(50);
    expect(state.history[0].id).toBe("run-54");
    expect(state.history.at(-1)?.id).toBe("run-5");
  });

  it("removes image-like values before persistence", () => {
    const blob = new Blob(["pixels"], { type: "image/png" });
    const safe = sanitizePersistedInputs({
      automaticCount: 42,
      threshold: 128,
      image: blob,
      imageDataUrl: "data:image/png;base64,cGl4ZWxz",
      previewUrl: "blob:http://localhost/abc",
      nested: { imageBytes: new Uint8Array([1, 2, 3]), keep: "yes" },
    });

    expect(safe).toEqual({
      automaticCount: 42,
      threshold: 128,
      nested: { keep: "yes" },
    });
    expect(JSON.stringify(safe)).not.toContain("pixels");
    expect(JSON.stringify(safe)).not.toContain("data:image");
    expect(JSON.stringify(safe)).not.toContain("blob:");
  });

  it("recovers safely from malformed or stale storage", () => {
    expect(parseCalculatorState("not json")).toEqual(createEmptyCalculatorState());
    expect(parseCalculatorState(JSON.stringify({ version: 0, favorites: ["dilution"] }))).toEqual(createEmptyCalculatorState());
  });

  it("deletes one history entry or clears history without touching favorites", () => {
    const base = { ...createEmptyCalculatorState(), favorites: ["dilution"], history: [
      { id: "a", calculatorId: "dilution", calculatorName: "Dilution", calculatorNameZh: "稀释", createdAt: "2026-01-01", methodVersion: "v1", inputs: {}, outputs: [], warnings: [] },
      { id: "b", calculatorId: "moi", calculatorName: "MOI", calculatorNameZh: "MOI", createdAt: "2026-01-02", methodVersion: "v1", inputs: {}, outputs: [], warnings: [] },
    ] };
    expect(deleteHistoryEntry(base, "a").history.map((item) => item.id)).toEqual(["b"]);
    expect(clearHistory(base)).toMatchObject({ favorites: ["dilution"], history: [] });
  });

  it("degrades safely when browser storage is unavailable", () => {
    expect(saveCalculatorState(createEmptyCalculatorState())).toBe(false);
  });
});
