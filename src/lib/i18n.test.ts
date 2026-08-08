import { describe, expect, it } from "vitest";
import { translateUiText } from "./i18n";

describe("LabNest UI translations", () => {
  it("translates known interface text without changing spacing", () => {
    expect(translateUiText("  Research Plans ", "zh")).toBe("  研究方案 ");
    expect(translateUiText("Research Plans", "en")).toBe("Research Plans");
  });

  it("translates safe dynamic UI prefixes while preserving record names", () => {
    expect(translateUiText("Edit RNA extraction", "zh")).toBe("编辑 RNA extraction");
    expect(translateUiText("12 rows · 4 columns · managed file", "zh")).toBe("12 行 · 4 列 · managed file");
  });

  it("does not translate unknown scientific or user-authored content", () => {
    expect(translateUiText("CHMP2A knockdown cohort", "zh")).toBe("CHMP2A knockdown cohort");
  });
});
