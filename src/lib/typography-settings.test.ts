import { describe, expect, it } from "vitest";
import {
  defaultTypographySettings,
  parseTypographySettings,
  typographyCssVariables,
  settingsWithoutCustomFont,
  reconcileTypographySettings,
  validateCustomFontFile,
} from "./typography-settings";

describe("typography settings", () => {
  it("migrates the previous three roles into Chinese roles and gives English independent defaults", () => {
    expect(parseTypographySettings(JSON.stringify({
      ui: { kind: "preset", id: "pingfang" },
      documentBody: { kind: "preset", id: "not-a-font" },
      documentHeading: { kind: "custom", id: "font-1", family: "LabNest Custom font-1", name: "My Song" },
    }))).toEqual({
      cjkUi: { kind: "preset", id: "pingfang" },
      cjkDocumentBody: defaultTypographySettings.cjkDocumentBody,
      cjkDocumentHeading: { kind: "custom", id: "font-1", family: "LabNest Custom font-1", name: "My Song" },
      latinUi: { kind: "preset", id: "arial" },
      latinDocumentBody: { kind: "preset", id: "times-new-roman" },
      latinDocumentHeading: { kind: "preset", id: "times-new-roman" },
    });
  });

  it("maps Chinese and English roles to separate public CSS variables", () => {
    expect(typographyCssVariables({
      cjkUi: { kind: "preset", id: "pingfang" },
      cjkDocumentBody: { kind: "preset", id: "songti" },
      cjkDocumentHeading: { kind: "preset", id: "source-han-serif" },
      latinUi: { kind: "preset", id: "arial" },
      latinDocumentBody: { kind: "preset", id: "times-new-roman" },
      latinDocumentHeading: { kind: "preset", id: "arial" },
    })).toEqual({
      "--font-cjk-ui": '"LabNest CJK PingFang", sans-serif',
      "--font-cjk-document-body": '"LabNest CJK Songti", serif',
      "--font-cjk-document-heading": '"LabNest CJK Source Han Serif", serif',
      "--font-latin-ui": 'Arial, "Helvetica Neue", Helvetica',
      "--font-latin-document-body": '"Times New Roman", Times',
      "--font-latin-document-heading": 'Arial, "Helvetica Neue", Helvetica',
    });
  });

  it("keeps built-in Chinese preset stacks behind CJK-only aliases", () => {
    const variables = typographyCssVariables(defaultTypographySettings);
    expect(variables["--font-cjk-document-body"]).toBe('"LabNest CJK Source Han Serif", serif');
    expect(variables["--font-cjk-document-body"]).not.toContain('"Songti SC"');
    expect(variables["--font-latin-document-body"]).toBe('"Times New Roman", Times');
  });

  it("uses script-scoped aliases for imported fonts so an English font cannot replace Chinese glyphs", () => {
    const custom = { kind: "custom" as const, id: "font-1", family: "LabNest Custom font-1", name: "My Font" };
    const variables = typographyCssVariables({
      ...defaultTypographySettings,
      cjkDocumentBody: custom,
      latinDocumentBody: custom,
    });
    expect(variables["--font-cjk-document-body"]).toContain('"LabNest Custom font-1 CJK"');
    expect(variables["--font-latin-document-body"]).toContain('"LabNest Custom font-1 Latin"');
  });

  it("accepts local web fonts within the limit and explains recoverable failures", () => {
    expect(validateCustomFontFile({ name: "lab-song.woff2", size: 2_000_000, type: "font/woff2" })).toBeNull();
    expect(validateCustomFontFile({ name: "legacy-name.ttf", size: 2_000_000, type: "application/x-font-ttf" })).toBeNull();
    expect(validateCustomFontFile({ name: "notes.pdf", size: 2_000, type: "application/pdf" })).toBe("请选择 WOFF2、TTF 或 OTF 字体文件。");
    expect(validateCustomFontFile({ name: "notes.woff2", size: 2_000, type: "application/pdf" })).toBe("请选择 WOFF2、TTF 或 OTF 字体文件。");
    expect(validateCustomFontFile({ name: "large.otf", size: 10_000_001, type: "font/otf" })).toBe("单个字体文件不能超过 10 MB。");
  });

  it("resets only roles that use a deleted local font", () => {
    const custom = { kind: "custom" as const, id: "font-1", family: "LabNest Custom font-1", name: "My Song" };
    expect(settingsWithoutCustomFont({
      ...defaultTypographySettings,
      cjkUi: { kind: "preset", id: "pingfang" },
      cjkDocumentBody: custom,
      latinDocumentHeading: custom,
    }, "font-1")).toEqual({
      ...defaultTypographySettings,
      cjkUi: { kind: "preset", id: "pingfang" },
    });
  });

  it("reconciles saved selections with fonts that still exist in this browser", () => {
    const custom = { kind: "custom" as const, id: "font-1", family: "LabNest Custom font-1", name: "My Song" };
    expect(reconcileTypographySettings({ ...defaultTypographySettings, cjkDocumentBody: custom }, new Set())).toEqual(defaultTypographySettings);
  });
});
