import { describe, expect, it } from "vitest";
import { resolveAppLocale, translateUiText } from "./i18n";

describe("LabNest UI translations", () => {
  it("resolves only supported persisted locales", () => {
    expect(resolveAppLocale("zh")).toBe("zh");
    expect(resolveAppLocale("en")).toBe("en");
    expect(resolveAppLocale("unsupported")).toBe("en");
    expect(resolveAppLocale(null, "zh")).toBe("zh");
  });

  it("translates known interface text without changing spacing", () => {
    expect(translateUiText("  Research Plans ", "zh")).toBe("  研究方案 ");
    expect(translateUiText("Edit Protocol", "zh")).toBe("编辑实验规程");
    expect(translateUiText("Edit as new revision", "zh")).toBe("编辑并新建修订版");
    expect(translateUiText("Research Plans", "en")).toBe("Research Plans");
  });

  it("translates safe dynamic UI prefixes while preserving record names", () => {
    expect(translateUiText("Edit RNA extraction", "zh")).toBe("编辑 RNA extraction");
    expect(translateUiText("12 rows · 4 columns · managed file", "zh")).toBe("12 行 · 4 列 · managed file");
    expect(translateUiText("3/8 steps · 2 results", "zh")).toBe("3/8 个步骤 · 2 个结果");
    expect(translateUiText("Complete run", "zh")).toBe("完成执行");
  });

  it("does not translate unknown scientific or user-authored content", () => {
    expect(translateUiText("CHMP2A knockdown cohort", "zh")).toBe("CHMP2A knockdown cohort");
  });
});
