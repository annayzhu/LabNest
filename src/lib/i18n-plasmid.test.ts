import { describe, expect, it } from "vitest";
import { translateUiText } from "./i18n";
import { plasmidZh, translatePlasmidDynamic } from "./i18n-plasmid";

describe("plasmid workbench translations", () => {
  it.each([
    ["Plasmid workbench", "质粒工作台"],
    ["Known full length", "已知全长"],
    ["Reverse strand", "反链"],
    ["The ABIF directory lies outside the file; the file may be truncated.", "ABIF 目录超出了文件范围，文件可能不完整。"],
  ])("translates %s", (english, chinese) => {
    expect(plasmidZh[english]).toBe(chinese);
  });

  it.each([
    ["2,949 bp · Circular", "2,949 bp · 环状"],
    ["700 nt · no quality values · same run as 3 other file(s)", "700 nt · 无质量值 · 与另外 3 个文件为同一次测序"],
    ["history tree (packet 0x07, 8660 bytes) is not read.", "构建历史（数据块 0x07，8660 字节）未读取。"],
    ["words: Invalid DNA characters: E, L, O, I.", "words：含非 DNA 字符 E, L, O, I。"],
    ["median Q47 · 98% of bases ≥ Q20", "中位 Q47 · 98% 的碱基 ≥ Q20"],
    ["v1.0 · From inventory", "v1.0 · 来自库存"],
  ])("translates the dynamic text %s", (english, chinese) => {
    expect(translatePlasmidDynamic(english)).toBe(chinese);
  });

  it("never translates a string to itself", () => {
    expect(Object.entries(plasmidZh).filter(([english, chinese]) => english === chinese)).toEqual([]);
  });
});

describe("plasmid translations inside the app dictionary", () => {
  it.each([
    ["Plasmid workbench", "质粒工作台"],
    ["Reverse strand", "反链"],
    ["2,949 bp · Circular", "2,949 bp · 环状"],
    ["700 nt · no quality values · same run as 3 other file(s)", "700 nt · 无质量值 · 与另外 3 个文件为同一次测序"],
    ["history tree (packet 0x07, 8660 bytes) is not read.", "构建历史（数据块 0x07，8660 字节）未读取。"],
    ["Open in the plasmid workbench", "在工作台打开"],
    ["pUC19: the record has no ORIGIN section.", "pUC19：记录里没有 ORIGIN 部分。"],
    ["seq1: Invalid DNA characters: E, L.", "seq1：含非 DNA 字符 E, L。"],
    ["Known full length · Circular", "已知全长 · 环状"],
    ["Not written to GenBank (2)", "GenBank 里没有写入的内容（2）"],
    ["Read", "已读取"],
  ])("shows %s as %s", (english, chinese) => {
    expect(translateUiText(english, "zh")).toBe(chinese);
  });

  it("leaves the words other modules already translate alone", () => {
    expect(translateUiText("Reverse", "zh")).toBe("撤销");
    expect(translateUiText("Could not read", "zh")).toBe("没读出来");
  });
});
