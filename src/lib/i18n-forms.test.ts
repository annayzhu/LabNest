import { describe, expect, it } from "vitest";
import { translateUiText } from "./i18n";

const zh = (text: string) => translateUiText(text, "zh");

describe("New Experiment, Entry and Protocol usage text in Chinese", () => {
  it("translates the New Experiment metadata and protocol picker", () => {
    expect(["Plan", "No plan chosen", "Follow a Protocol", "Write my own steps", "Chosen Protocols · in run order", "Add from Protocol library", "Back to the page to keep editing or save"].map(zh))
      .toEqual(["研究计划", "未选择", "依据实验规程", "自行记录", "已选规程 · 按执行顺序", "从实验规程库添加", "返回主界面继续填写或保存"]);
    expect(zh("Seed cells | 2.0 × 10^5 cells per well\nIncubate overnight\nImage | 20× objective")).toBe("铺板 | 每孔 2.0 × 10^5 个细胞\n孵育过夜\n拍照 | 20× 物镜");
    expect(zh("v1.2 · Draft · Protocol library · 5 steps")).toBe("v1.2 · 草稿 · 规程库 · 5 步");
    expect(zh("RNA kit v2 · v1.0 · Reviewed · Lab A · 1 step")).toBe("RNA kit v2 · v1.0 · 已审核 · Lab A · 1 步");
    expect([zh("v0.3 · 7 steps"), zh("Position 2"), zh("Remove TRIzol RNA from the chosen Protocols"), zh("3 matching versions"), zh("Show earlier versions (4)")])
      .toEqual(["v0.3 · 7 步", "第 2 个", "移除 TRIzol RNA", "匹配到 3 个版本", "显示历史版本（4）"]);
    expect(zh("Latest version v1.1 is chosen; open earlier versions if you need one.")).toBe("最新版本 v1.1 已选；需要时可展开历史版本。");
  });

  it("translates the Entry composer and source entry cards", () => {
    expect(["Experiment / observation time (optional)", "Save and file…", "Entry type", "Observation / result", "Idea"].map(zh))
      .toEqual(["实验／观察时间（可留空）", "保存并归入…", "记录类型", "观察/结果", "想法"]);
    expect(zh("Recorded 2026/10/19 09:30:00 · Author: not recorded · Modified 2026/10/19 10:00:00")).toBe("记录于 2026/10/19 09:30:00 · 作者：未记录 · 修改于 2026/10/19 10:00:00");
    expect([zh("Experiment / observation time: 2026-10-19 (date only)"), zh("Experiment / observation time: not recorded")]).toEqual(["实验／观察时间：2026-10-19（仅日期）", "实验／观察时间：未记录"]);
    expect(zh("This title: Day 3 · Server title: Day 3 (edited). Files added here stay in the editor; check them too.")).toBe("本机标题：Day 3 · 服务器标题：Day 3 (edited)；本机文件仍保留在编辑区，请一并核对。");
  });

  it("translates the Protocol usage history", () => {
    expect(["Usage history", "Systems · run quantities", "Actual values", "No experiment has used this Protocol yet."].map(zh))
      .toEqual(["使用记录", "体系 · 本次数量", "实际值", "还没有实验用过这份规程。"]);
  });
});

describe("Reagents and consumables used in this run, in Chinese", () => {
  it("translates the table, dialog and deduction review", () => {
    expect(["Reagents and consumables used in this run", "Reagent or consumable", "Expected use", "Actual use", "Stock handling", "Actions", "Deduction to confirm", "Save usage record"].map(zh))
      .toEqual(["本次使用的试剂与耗材", "物料", "预计", "实际", "库存处理", "操作", "待确认扣减", "保存使用记录"]);
    expect([zh("Review 2 selected deductions"), zh("Holder: see the container record"), zh("From the Protocol: Step 1 · 预混液"), zh("Tris · Lot not recorded · a1b2c3"), zh("box-3 · Holder not recorded")])
      .toEqual(["核对所选 2 项扣减", "持有人：请查看实物记录", "依据规程：Step 1 · 预混液", "Tris · 批号未记录 · a1b2c3", "box-3 · 持有人未记录"]);
    expect(zh("Tris buffer — deduct 5 mL; book adjustment +1 mL (corrected use, not a physical return)")).toBe("Tris buffer：5 mL；账面调整 +1 mL（更正用量，不代表实物退库）");
    expect(zh("Tris buffer — deduct not confirmed mL")).toBe("Tris buffer：未确认 mL");
  });
});

describe("AI availability reasons in Chinese", () => {
  it("translates them alone and inside the design page line", () => {
    expect([zh("AI is off; existing records stay as they are."), zh("The service “Lab GPT” is turned off."), zh("The service “Lab GPT” has no saved API key yet.")])
      .toEqual(["已关闭 AI，现有记录保持不变。", "服务“Lab GPT”已停用。", "服务“Lab GPT”尚未保存 API 密钥。"]);
    expect(zh("No model connected (The service “Lab GPT” has no saved API key yet.): you can still search and fetch the original texts, and fill in method cards by hand."))
      .toBe("未连接模型（服务“Lab GPT”尚未保存 API 密钥。）：仍可检索与抓取原文，方法卡手工填写。");
  });
});

describe("Run page program card, photo line and analysis upload in Chinese", () => {
  it("translates them", () => {
    expect(["Thermal cycling program", "Hold", "Write 15 s, 3 min or hold", "Add an analysis result", "qPCR analysis workbench", "Exported workbook (.xlsx, .xls or .csv)", "Added as a draft result."].map(zh))
      .toEqual(["热循环程序", "保持", "写成 15 s、3 min 或 保持", "添加分析结果", "qPCR 分析工作台", "导出的工作簿（.xlsx、.xls 或 .csv）", "已添加为草稿结果。"]);
    expect([zh("35 cycles"), zh("Cycles in stage 2"), zh("Delete program step 3"), zh("Photo for step 4 · 上机扩增")]).toEqual(["35 个循环", "第 2 段的循环次数", "删除第 3 步", "照片归属：第 4 步 · 上机扩增"]);
  });
});

describe("Protocol editor systems bar in Chinese", () => {
  it("translates the hint, buttons, lens labels and deletion dialog", () => {
    expect(["When systems use different amounts, write ", "; set sample conditions that need their own label in “Applies to…” from ⋮⋮ beside a step or paragraph.", "System", "Condition", "Save as a preset", "Export Word"].map(zh))
      .toEqual(["不同体系用量不同时，直接写 ", "；需要单独标注的样本条件，在步骤或段落左侧 ⋮⋮ 的“适用范围”里设置。", "体系", "条件", "存为常用组合", "导出 Word"]);
    expect([zh("Lens by 裂解液体系"), zh("Only 350 µL: fade the rest"), zh("Open 体系 for editing"), zh("Option name: A"), zh("Delete option “A”?"), zh("Delete “富脂组织”?")])
      .toEqual(["透镜：裂解液体系", "只看350 µL：其余淡化", "编辑体系", "选项名称：A", "删除选项“A”？", "删除“富脂组织”？"]);
    expect(zh("“体系”: 2 parameters take their value from it, and the first option’s values are kept; 1 applicability rule uses it, and that content becomes general."))
      .toBe("“体系”：2 个参数按它取值，删除后保留第一个选项的数值；1 处适用范围用到它，删除后这些内容变为通用。");
    expect(zh("“A”: 1 parameter takes its value from it, and those values are deleted with it.")).toBe("“A”：1 个参数按它取值，它的数值一并删除。");
  });
});

describe("Lens titles show stored default labels in English", () => {
  it("maps them back in Chinese", () => {
    expect([zh("Only Yes: fade the rest"), zh("Lens by System 2"), zh("Read as No: the rest folds away"), zh("Preview by System")]).toEqual(["只看是：其余淡化", "透镜：体系 2", "按否阅读：其余内容折叠", "预览：体系"]);
  });
});
