import { describe, expect, it } from "vitest";
import { defaultUiScale, isUiScaleId, uiScaleOptions } from "@/lib/ui-scale";

describe("interface scale settings", () => {
  it("exposes three stable scale choices with compact as the default", () => {
    expect(defaultUiScale).toBe("compact");
    expect(uiScaleOptions.map((option) => option.id)).toEqual(["compact", "standard", "comfortable"]);
  });

  it("rejects unknown persisted values", () => {
    expect(isUiScaleId("standard")).toBe(true);
    expect(isUiScaleId("oversized")).toBe(false);
    expect(isUiScaleId(null)).toBe(false);
  });
});
