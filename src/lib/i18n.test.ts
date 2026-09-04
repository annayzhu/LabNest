import { describe, expect, it } from "vitest";
import { resolveAppLocale, translateUiText, zhUi } from "./i18n";

const canonicalTermsAllowedAsChinese = new Set([
  "English",
  "FASTA",
  "Markdown",
]);

const requiredPrimaryModuleKeys = [
  "Overview",
  "Entries",
  "Projects",
  "Research Plans",
  "Protocols",
  "Experiments",
  "Results",
  "Reports",
  "Inventory",
  "Tools",
  "Sequences",
  "Sequence Collections",
  "Recycle Bin",
  "Settings",
];

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
    expect(translateUiText("Evidence · 1 observations · 2 measurements · 3 files · 4 inventory records", "zh")).toBe("证据 · 1 条观察 · 2 个测量值 · 3 个文件 · 4 条耗材记录");
    expect(translateUiText("offline-photo.jpg saved on this device · waiting to sync.", "zh")).toBe("offline-photo.jpg 已保存在本机 · 等待同步。");
  });

  it("does not translate unknown scientific or user-authored content", () => {
    expect(translateUiText("CHMP2A knockdown cohort", "zh")).toBe("CHMP2A knockdown cohort");
  });

  it("covers structured editors, inventory filters, and accessibility labels", () => {
    expect(translateUiText("Formatting toolbar", "zh")).toBe("格式工具栏");
    expect(translateUiText("Result Template contract", "zh")).toBe("结果模板约定");
    expect(translateUiText("Filter Inventory by principal investigator", "zh")).toBe("按负责人筛选库存");
    expect(translateUiText("Close permanent deletion dialog", "zh")).toBe("关闭永久删除对话框");
  });

  it("translates generated counts, record labels, and file actions", () => {
    expect(translateUiText("0 experiments · 1 entries", "zh")).toBe("0 个实验 · 1 条记录");
    expect(translateUiText("Select record result-1", "zh")).toBe("选择记录 result-1");
    expect(translateUiText("Table row 2, column 3", "zh")).toBe("表格第 2 行，第 3 列");
    expect(translateUiText("Download results.xlsx", "zh")).toBe("下载 results.xlsx");
    expect(translateUiText("Experiment code suffix after EXP-", "zh")).toBe("EXP- 之后的实验编号后缀");
    expect(translateUiText("Protocol · PRT-100010", "zh")).toBe("实验规程 · PRT-100010");
    expect(translateUiText("8/11/2026, 1:44:12 PM", "zh")).toBe("2026/8/11 13:44:12");
  });

  it("keeps units, brands, schema keys, and software names canonical", () => {
    expect(translateUiText("1 mg/mL", "zh")).toBe("1 mg/mL");
    expect(translateUiText("BioLegend", "zh")).toBe("BioLegend");
    expect(translateUiText("dataset_key", "zh")).toBe("dataset_key");
    expect(translateUiText("LabNest", "zh")).toBe("LabNest");
  });

  it("keeps the Chinese UI dictionary complete enough to catch silent fallbacks", () => {
    expect(Object.keys(zhUi).length).toBeGreaterThan(1000);
    expect(requiredPrimaryModuleKeys.filter((key) => !zhUi[key])).toEqual([]);

    const emptyTranslations = Object.entries(zhUi)
      .filter(([, translated]) => !translated.trim())
      .map(([source]) => source);
    expect(emptyTranslations).toEqual([]);

    const untranslatedEntries = Object.entries(zhUi)
      .filter(([source, translated]) => source === translated && !canonicalTermsAllowedAsChinese.has(source))
      .map(([source]) => source);
    expect(untranslatedEntries).toEqual([]);
  });
});
