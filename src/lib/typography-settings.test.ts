import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyTypographySettings,
  clearTypographySettings,
  defaultTypographySettings,
  legacyTypographyCssStorageKey,
  parseTypographySettings,
  saveTypographySettings,
  typographyCssProperties,
  typographyCssStorageKey,
  typographyCssVariables,
  typographySettingsStorageKey,
  settingsWithoutCustomFont,
  reconcileTypographySettings,
  validateCustomFontFile,
  typographyCatalogForRole,
} from "./typography-settings";

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

function inlineStyleRoot(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const root = {
    style: {
      setProperty: (property: string, value: string) => { values.set(property, value); },
      removeProperty: (property: string) => { values.delete(property); },
    },
  } as unknown as HTMLElement;
  return { root, values };
}

describe("typography settings", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("migrates legacy document roles into Chinese roles and ignores retired interface roles", () => {
    expect(parseTypographySettings(JSON.stringify({
      ui: { kind: "preset", id: "pingfang" },
      cjkUi: { kind: "preset", id: "pingfang" },
      latinUi: { kind: "preset", id: "times-new-roman" },
      documentBody: { kind: "preset", id: "not-a-font" },
      documentHeading: { kind: "custom", id: "font-1", family: "LabNest Custom font-1", name: "My Song" },
    }))).toEqual({
      cjkDocumentBody: defaultTypographySettings.cjkDocumentBody,
      cjkDocumentHeading: { kind: "custom", id: "font-1", family: "LabNest Custom font-1", name: "My Song" },
      latinDocumentBody: { kind: "preset", id: "times-new-roman" },
      latinDocumentHeading: { kind: "preset", id: "times-new-roman" },
    });
  });

  it("maps Chinese and English document roles to separate public CSS variables", () => {
    expect(typographyCssVariables({
      cjkDocumentBody: { kind: "preset", id: "songti" },
      cjkDocumentHeading: { kind: "preset", id: "source-han-serif" },
      latinDocumentBody: { kind: "preset", id: "times-new-roman" },
      latinDocumentHeading: { kind: "preset", id: "arial" },
    })).toEqual({
      "--font-cjk-document-body": '"LabNest CJK Songti", serif',
      "--font-cjk-document-heading": '"LabNest CJK Source Han Serif", serif',
      "--font-latin-document-body": '"Times New Roman", Times',
      "--font-latin-document-heading": 'Arial, "Helvetica Neue", Helvetica',
    });
  });

  it("leaves the interface font to Appearance and clears inline values written by earlier releases", () => {
    expect(typographyCssProperties.filter((property) => /-ui$/.test(property))).toEqual([]);
    const { root, values } = inlineStyleRoot({ "--font-ui": "Georgia", "--font-latin-ui": "Georgia", "--font-cjk-ui": "Songti SC" });
    applyTypographySettings(defaultTypographySettings, root);
    expect([...values.keys()].sort()).toEqual([...typographyCssProperties].sort());
  });

  it("applies settings without recording them as a choice; only explicit saves persist", () => {
    const storage = memoryStorage({ [legacyTypographyCssStorageKey]: "{}" });
    vi.stubGlobal("window", { localStorage: storage });
    const settings = { ...defaultTypographySettings, latinDocumentBody: { kind: "preset" as const, id: "arial" as const } };

    applyTypographySettings(settings, inlineStyleRoot().root);
    expect([...storage.values.keys()]).toEqual([legacyTypographyCssStorageKey]);

    saveTypographySettings(settings);
    expect(parseTypographySettings(storage.getItem(typographySettingsStorageKey))).toEqual(settings);
    expect(JSON.parse(storage.getItem(typographyCssStorageKey) ?? "{}")).toEqual(typographyCssVariables(settings));
    expect(storage.getItem(legacyTypographyCssStorageKey)).toBeNull();

    clearTypographySettings();
    expect(storage.values.size).toBe(0);
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
    expect(variables["--font-cjk-document-body"]).toContain('"labnest-custom-font-1"');
    expect(variables["--font-latin-document-body"]).toContain('"labnest-custom-font-1"');
  });

  it("keeps a browser-discovered family available for every typography role", () => {
    const settings = parseTypographySettings(JSON.stringify(Object.fromEntries(
      Object.keys(defaultTypographySettings).map((role) => [role, { kind: "local", id: "fdevice", name: "Device Font" }]),
    )));
    expect(Object.values(settings).every((selection) => selection.kind === "local" && selection.name === "Device Font")).toBe(true);
    expect(Object.values(typographyCssVariables(settings)).every((value) => value.includes("--ln-local-font-fdevice"))).toBe(true);
  });

  it("accepts local web fonts within the limit and explains recoverable failures", () => {
    expect(validateCustomFontFile({ name: "lab-song.woff2", size: 2_000_000 })).toBeNull();
    expect(validateCustomFontFile({ name: "legacy-name.ttf", size: 2_000_000 })).toBeNull();
    expect(validateCustomFontFile({ name: "editorial.otf", size: 2_000_000 })).toBeNull();
    expect(validateCustomFontFile({ name: "notes.pdf", size: 2_000 })).toBe("请选择 WOFF2、TTF 或 OTF 字体文件。");
    expect(validateCustomFontFile({ name: "notes.pdf", size: 2_000 }, "en")).toBe("Choose a WOFF2, TTF, or OTF font file.");
    expect(validateCustomFontFile({ name: "empty.ttf", size: 0 })).toBe("字体文件为空，请选择其他文件。");
    expect(validateCustomFontFile({ name: "large.otf", size: 10_000_001 })).toBe("单个字体文件不能超过 10 MB。");
    expect(validateCustomFontFile({ name: "large.otf", size: 10_000_001 }, "en")).toBe("A font file cannot exceed 10 MB.");
  });

  it("resets only roles that use a deleted local font", () => {
    const custom = { kind: "custom" as const, id: "font-1", family: "LabNest Custom font-1", name: "My Song" };
    expect(settingsWithoutCustomFont({
      ...defaultTypographySettings,
      cjkDocumentHeading: { kind: "preset", id: "pingfang" },
      cjkDocumentBody: custom,
      latinDocumentHeading: custom,
    }, "font-1")).toEqual({
      ...defaultTypographySettings,
      cjkDocumentHeading: { kind: "preset", id: "pingfang" },
    });
  });

  it("reconciles saved selections with fonts that still exist in this browser", () => {
    const custom = { kind: "custom" as const, id: "font-1", family: "LabNest Custom font-1", name: "My Song" };
    expect(reconcileTypographySettings({ ...defaultTypographySettings, cjkDocumentBody: custom }, new Set())).toEqual(defaultTypographySettings);
  });

  it("offers the complete language catalog to body and heading roles", () => {
    expect(typographyCatalogForRole("cjkDocumentBody").map((font) => font.id)).toEqual(
      typographyCatalogForRole("cjkDocumentHeading").map((font) => font.id),
    );
    expect(typographyCatalogForRole("latinDocumentBody").map((font) => font.id)).toEqual(
      typographyCatalogForRole("latinDocumentHeading").map((font) => font.id),
    );
  });
});
