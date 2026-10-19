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

  it("translates the editor menus, run preparation, stock dialog and version pages", () => {
    const zh = (text: string) => translateUiText(text, "zh");
    expect(["Turn into", "Bold ⌘B", "＋ Row", "－ This column", "Applies to…", "Turn into mix card", "Equipment operations", "Mix card", "Bullet points"].map(zh))
      .toEqual(["转换为", "加粗 ⌘B", "＋ 行", "－ 本列", "适用范围…", "转为配液卡", "设备操作", "配液卡", "项目列表"]);
    expect(zh("Type / to insert a parameter, tool or content")).toBe("输入 / 插入参数、工具或内容");
    expect(zh("PCR / thermal cycler")).toBe("PCR／热循环");
    expect(zh("Insert 14:05")).toBe("插入 14:05");
    expect([zh("New Protocol"), zh("New Experiment")]).toEqual(["新建实验规程", "新建实验"]);
    expect(zh("New from Protocol PRT-100003 v1.0 “SYBR Green qPCR”. Confirm the experiment name, research plan and date; once saved, the steps come from the Protocol and are ticked off one by one on the run page."))
      .toBe("从规程 PRT-100003 v1.0「SYBR Green qPCR」新建。先确认实验名称、所属研究计划和日期；保存后，步骤按规程生成，在执行页逐步勾选。");
    expect(["Preparation · systems and groups", "Run quantities", "Save quantities", "Confirm systems for this run", "Preparation checklist", "Mix cards", "Equipment setup", "Timers"].map(zh))
      .toEqual(["实验准备 · 体系与分组", "本次数量", "保存数量", "确认本次体系", "准备清单", "配液卡", "设备准备", "计时"]);
    expect(["PRT-100003 step 2", "Step 2", "Ready 3/7", "A组 · Run quantities", "Group 2", "Note for 2× SYBR Mix"].map(zh))
      .toEqual(["PRT-100003 第 2 步", "第 2 步", "已备 3/7", "A组 · 本次数量", "第 2 组", "2× SYBR Mix 备注"]);
    expect(zh("Centrifuge · Pre-cool to 4 °C · 12,000 ×g · PRT-100001 step 2, PRT-100003 step 1")).toBe("Centrifuge · 预冷至 4 °C · 12,000 ×g · PRT-100001 第 2 步、PRT-100003 第 1 步");
    expect(zh("Centrifuge · 低速")).toBe("离心 · 低速");
    expect(zh("Calculation to confirm: Cell suspension (PRT-100003 step 2)")).toBe("计算待确认：Cell suspension（PRT-100003 第 2 步）");
    expect(zh("Required at run time: Step 3 · Ct value; Filled in at run time: Step 4 · OD600")).toBe("执行时必填：第 3 步 · Ct value；执行时填写：第 4 步 · OD600");
    expect(zh("Continuing from: Lyse cells. Operations completed earlier are not copied as completed in this run.")).toBe("本次继续位置：Lyse cells。此前已完成操作并未复制为本次完成。");
    expect(zh("2 calculations are confirmed in the steps that use them: click a calculation result in a step to fill it in and confirm.")).toBe("2 项计算在使用它的步骤里确认：点步骤中的计算结果即可填写并确认。");
    expect([zh("Deduct this run’s use from stock?"), zh("Complete and record use (3)"), zh("Tris buffer · Lot not recorded (not precisely tracked)"), zh("Actual amount of Tris buffer")])
      .toEqual(["按本次用量扣减库存？", "完成并记录用量（3 项）", "Tris buffer · 批号未记录（非精确管理）", "Tris buffer 实际用量"]);
    expect([zh("RNA extraction · Version comparison"), zh("Compare versions"), zh("Revise protocol from this run"), zh("Back to tools"), zh("Step 2 · details"), zh("Block 4")])
      .toEqual(["RNA extraction · 版本对比", "版本对比", "整理成规程修订", "返回工具目录", "第 2 步 · 说明", "第 4 块"]);
    expect(zh("By system: 350 µL + not 富脂 → 50 µL; Default → Not filled (µL)")).toBe("350 µL + 非 富脂：50 µL；默认：未填（µL）");
    expect(zh("Systems adopted · EXP-000123")).toBe("本次采用体系 · EXP-000123");
  });

  it("leaves names and step titles that only look like the checklist's wording alone", () => {
    expect(translateUiText("Wash step 2", "zh")).toBe("Wash step 2");
    expect(translateUiText("Master mix · Confirmed by PI", "zh")).toBe("Master mix · Confirmed by PI");
  });
});
