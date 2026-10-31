import { describe, expect, it } from "vitest";
import { translateUiText } from "./i18n";

describe("Samples in Chinese", () => {
  it.each([
    ["Samples", "样本"],
    ["In storage", "在库"],
    ["Register outputs", "登记产出"],
    ["Cells", "细胞"],
    ["8 samples added; 2 already in this experiment.", "已添加 8 个样本；2 个已在本实验中。"],
    ["RNA-0001 now has 25 µL left.", "RNA-0001：剩余 25 µL。"],
    ["Code RNA-0001 is already used.", "编号 RNA-0001 已被使用。"],
    ["RNA box 1 A1 already holds a sample.", "RNA box 1 A1 已有样本。"],
    ["J1 is outside the 9 × 9 box.", "J1 超出 9 × 9 的盒子。"],
    ["This sample has 2 derived samples, 1 experiment, so it cannot be deleted. Mark it as discarded instead.", "这个样本有 2 个派生样本、1 个实验记录，不能删除。请改为“已丢弃”。"],
    ["4 samples · A1–A2, A5–A6", "4 个样本 · A1–A2, A5–A6"],
    ["Samples 1 · Materials 1", "样本 1 · 材料 1"],
  ])("%s", (english, chinese) => expect(translateUiText(english, "zh")).toBe(chinese));

  it("leaves messages other modules translate to them", () => {
    expect(translateUiText("Purity must be a number.", "zh")).toBe("纯度必须是数字。");
    expect(translateUiText("Group 2", "zh")).toBe("第 2 组");
  });
});
