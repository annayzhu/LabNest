import { describe, expect, it } from "vitest";
import {
  defaultTypographySettings,
  parseTypographySettings,
  typographyCssVariables,
  settingsWithoutCustomFont,
  validateCustomFontFile,
} from "./typography-settings";

describe("typography settings", () => {
  it("restores valid role selections and falls back only invalid roles", () => {
    expect(parseTypographySettings(JSON.stringify({
      ui: { kind: "preset", id: "pingfang" },
      documentBody: { kind: "preset", id: "not-a-font" },
      documentHeading: { kind: "custom", id: "font-1", family: "LabNest Custom font-1", name: "My Song" },
    }))).toEqual({
      ui: { kind: "preset", id: "pingfang" },
      documentBody: defaultTypographySettings.documentBody,
      documentHeading: { kind: "custom", id: "font-1", family: "LabNest Custom font-1", name: "My Song" },
    });
  });

  it("maps each role to its public CSS variable while keeping data type fixed", () => {
    expect(typographyCssVariables({
      ui: { kind: "preset", id: "pingfang" },
      documentBody: { kind: "preset", id: "songti" },
      documentHeading: { kind: "preset", id: "source-han-serif" },
    })).toEqual({
      "--font-ui": '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", ui-sans-serif, system-ui, sans-serif',
      "--font-document-body": '"Songti SC", STSong, SimSun, serif',
      "--font-document-heading": '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", STSong, SimSun, serif',
    });
  });

  it("accepts local web fonts within the limit and explains recoverable failures", () => {
    expect(validateCustomFontFile({ name: "lab-song.woff2", size: 2_000_000, type: "font/woff2" })).toBeNull();
    expect(validateCustomFontFile({ name: "notes.pdf", size: 2_000, type: "application/pdf" })).toBe("请选择 WOFF2、TTF 或 OTF 字体文件。");
    expect(validateCustomFontFile({ name: "large.otf", size: 10_000_001, type: "font/otf" })).toBe("单个字体文件不能超过 10 MB。");
  });

  it("resets only roles that use a deleted local font", () => {
    const custom = { kind: "custom" as const, id: "font-1", family: "LabNest Custom font-1", name: "My Song" };
    expect(settingsWithoutCustomFont({
      ui: { kind: "preset", id: "pingfang" },
      documentBody: custom,
      documentHeading: custom,
    }, "font-1")).toEqual({
      ui: { kind: "preset", id: "pingfang" },
      documentBody: defaultTypographySettings.documentBody,
      documentHeading: defaultTypographySettings.documentHeading,
    });
  });
});
