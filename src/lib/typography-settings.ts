export const typographySettingsStorageKey = "labnest.typography-settings.v1";
export const typographyCssStorageKey = "labnest.typography-css.v2";
export const legacyTypographyCssStorageKey = "labnest.typography-css.v1";
export const customFontDatabaseName = "labnest-custom-fonts";
export const customFontStoreName = "fonts";
export const maxCustomFontBytes = 10_000_000;
export const maxCustomFontCount = 8;

const cjkTypographyCatalog = [
    {
      id: "source-han-sans",
      name: "思源黑体",
      nameEn: "Source Han Sans",
      description: "清晰、克制，适合导航与表单",
      descriptionEn: "Clear and restrained for navigation and forms",
      family: '"LabNest CJK Source Han Sans", sans-serif',
    },
    {
      id: "pingfang",
      name: "苹方",
      nameEn: "PingFang SC",
      description: "轻盈现代，适合 macOS",
      descriptionEn: "Light and modern on macOS",
      family: '"LabNest CJK PingFang", sans-serif',
    },
    {
      id: "system-sans",
      name: "系统黑体",
      nameEn: "System sans",
      description: "跟随当前设备，加载最稳定",
      descriptionEn: "Uses the most stable font on this device",
      family: '"LabNest CJK System Sans", sans-serif',
    },
    {
      id: "source-han-serif",
      name: "思源宋体",
      nameEn: "Source Han Serif",
      description: "清楚舒展，适合长文与标题",
      descriptionEn: "Open and readable for body text and headings",
      family: '"LabNest CJK Source Han Serif", serif',
    },
    {
      id: "songti",
      name: "华文宋体",
      nameEn: "Songti SC",
      description: "温润传统，适合中文文档",
      descriptionEn: "A warm, traditional Chinese serif",
      family: '"LabNest CJK Songti", serif',
    },
    {
      id: "simsun",
      name: "中易宋体",
      nameEn: "SimSun",
      description: "兼容性好，接近传统科研文稿",
      descriptionEn: "Compatible with traditional research documents",
      family: '"LabNest CJK SimSun", serif',
    },
] as const;

const latinTypographyCatalog = [
    {
      id: "arial",
      name: "Arial",
      nameEn: "Arial",
      description: "英文无衬线，适合界面与表单",
      descriptionEn: "Sans serif for interface text and forms",
      family: 'Arial, "Helvetica Neue", Helvetica',
    },
    {
      id: "times-new-roman",
      name: "Times New Roman",
      nameEn: "Times New Roman",
      description: "经典英文衬线字体",
      descriptionEn: "Classic serif for English text",
      family: '"Times New Roman", Times',
    },
    {
      id: "courier-new",
      name: "Courier New",
      nameEn: "Courier New",
      description: "等宽字体，适合编号与原始数据",
      descriptionEn: "Monospaced type for identifiers and raw data",
      family: '"Courier New", Courier, monospace',
    },
] as const;

export const typographyPresets = {
  cjkUi: cjkTypographyCatalog,
  cjkDocumentBody: cjkTypographyCatalog,
  cjkDocumentHeading: cjkTypographyCatalog,
  latinUi: latinTypographyCatalog,
  latinDocumentBody: latinTypographyCatalog,
  latinDocumentHeading: latinTypographyCatalog,
} as const;

export type TypographyRole = keyof typeof typographyPresets;
export type TypographyPresetId = (typeof typographyPresets)[TypographyRole][number]["id"];

export type PresetFontSelection = { kind: "preset"; id: TypographyPresetId };
export type CustomFontSelection = { kind: "custom"; id: string; family: string; name: string };
export type FontSelection = PresetFontSelection | CustomFontSelection;

export type TypographySettings = Record<TypographyRole, FontSelection>;

export function typographyCatalogForRole(role: TypographyRole) {
  return typographyPresets[role];
}

export type CustomFontRecord = {
  id: string;
  family: string;
  name: string;
  fileName: string;
  mimeType: string;
  size: number;
  data?: ArrayBuffer;
  faces?: CustomFontFaceRecord[];
  createdAt: string;
};

export type CustomFontFaceRecord = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  data: ArrayBuffer;
  weight: string;
  style: "normal" | "italic";
};

export const defaultTypographySettings: TypographySettings = {
  cjkUi: { kind: "preset", id: "source-han-sans" },
  cjkDocumentBody: { kind: "preset", id: "source-han-serif" },
  cjkDocumentHeading: { kind: "preset", id: "source-han-serif" },
  latinUi: { kind: "preset", id: "arial" },
  latinDocumentBody: { kind: "preset", id: "times-new-roman" },
  latinDocumentHeading: { kind: "preset", id: "times-new-roman" },
};

const cssVariableByRole: Record<TypographyRole, string> = {
  cjkUi: "--font-cjk-ui",
  cjkDocumentBody: "--font-cjk-document-body",
  cjkDocumentHeading: "--font-cjk-document-heading",
  latinUi: "--font-latin-ui",
  latinDocumentBody: "--font-latin-document-body",
  latinDocumentHeading: "--font-latin-document-heading",
};

export const typographyCssProperties = Object.values(cssVariableByRole);

export const typographyRoleGroups = {
  cjk: ["cjkUi", "cjkDocumentBody", "cjkDocumentHeading"],
  latin: ["latinUi", "latinDocumentBody", "latinDocumentHeading"],
} as const satisfies Record<"cjk" | "latin", readonly TypographyRole[]>;

const legacyRoleByRole: Partial<Record<TypographyRole, "ui" | "documentBody" | "documentHeading">> = {
  cjkUi: "ui",
  cjkDocumentBody: "documentBody",
  cjkDocumentHeading: "documentHeading",
};

function isRolePreset(role: TypographyRole, id: unknown): id is TypographyPresetId {
  return typeof id === "string" && typographyPresets[role].some((preset) => preset.id === id);
}

function parseSelection(role: TypographyRole, value: unknown): FontSelection {
  if (!value || typeof value !== "object") return defaultTypographySettings[role];
  const candidate = value as Partial<FontSelection>;
  if (candidate.kind === "preset" && isRolePreset(role, candidate.id)) return { kind: "preset", id: candidate.id };
  if (
    candidate.kind === "custom"
    && typeof candidate.id === "string"
    && /^[a-zA-Z0-9-]+$/.test(candidate.id)
    && typeof candidate.family === "string"
    && candidate.family === `LabNest Custom ${candidate.id}`
    && typeof candidate.name === "string"
    && candidate.name.trim().length > 0
  ) {
    return { kind: "custom", id: candidate.id, family: candidate.family, name: candidate.name.trim().slice(0, 80) };
  }
  return defaultTypographySettings[role];
}

export function parseTypographySettings(serialized: string | null): TypographySettings {
  if (!serialized) return defaultTypographySettings;
  try {
    const value = JSON.parse(serialized) as Partial<Record<TypographyRole | "ui" | "documentBody" | "documentHeading", unknown>>;
    return (Object.keys(defaultTypographySettings) as TypographyRole[]).reduce<TypographySettings>((settings, role) => {
      const legacyRole = legacyRoleByRole[role];
      settings[role] = parseSelection(role, value[role] ?? (legacyRole ? value[legacyRole] : undefined));
      return settings;
    }, { ...defaultTypographySettings });
  } catch {
    return defaultTypographySettings;
  }
}

function familyForSelection(role: TypographyRole, selection: FontSelection): string {
  if (selection.kind === "custom") {
    const fallback = typographyPresets[role].find((preset) => preset.id === defaultTypographySettings[role].id)?.family;
    return `"labnest-custom-${selection.id}", ${fallback}`;
  }
  return typographyPresets[role].find((preset) => preset.id === selection.id)?.family
    ?? typographyPresets[role][0].family;
}

export function typographyCssVariables(settings: TypographySettings): Record<string, string> {
  return (Object.keys(cssVariableByRole) as TypographyRole[]).reduce<Record<string, string>>((variables, role) => {
    variables[cssVariableByRole[role]] = familyForSelection(role, settings[role]);
    return variables;
  }, {});
}

export function applyTypographySettings(settings: TypographySettings, root: HTMLElement = document.documentElement) {
  const variables = typographyCssVariables(settings);
  ["--font-ui", "--font-document-body", "--font-document-heading"].forEach((property) => root.style.removeProperty(property));
  Object.entries(variables).forEach(([property, value]) => root.style.setProperty(property, value));
  window.localStorage.setItem(typographySettingsStorageKey, JSON.stringify(settings));
  window.localStorage.setItem(typographyCssStorageKey, JSON.stringify(variables));
  window.localStorage.removeItem(legacyTypographyCssStorageKey);
}

export function validateCustomFontFile(file: Pick<File, "name" | "size">, locale: "zh" | "en" = "zh"): string | null {
  const message = (zh: string, en: string) => locale === "zh" ? zh : en;
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension || !["woff2", "ttf", "otf"].includes(extension)) {
    return message("请选择 WOFF2、TTF 或 OTF 字体文件。", "Choose a WOFF2, TTF, or OTF font file.");
  }
  if (file.size > maxCustomFontBytes) return message("单个字体文件不能超过 10 MB。", "A font file cannot exceed 10 MB.");
  if (file.size === 0) return message("字体文件为空，请选择其他文件。", "This font file is empty. Choose another file.");
  return null;
}

export function reconcileTypographySettings(settings: TypographySettings, availableFontIds: ReadonlySet<string>): TypographySettings {
  return Object.values(settings).reduce<TypographySettings>((next, selection) => {
    if (selection.kind === "custom" && !availableFontIds.has(selection.id)) return settingsWithoutCustomFont(next, selection.id);
    return next;
  }, settings);
}

export function settingsWithoutCustomFont(settings: TypographySettings, fontId: string): TypographySettings {
  return (Object.keys(settings) as TypographyRole[]).reduce<TypographySettings>((next, role) => {
    const selection = settings[role];
    next[role] = selection.kind === "custom" && selection.id === fontId ? defaultTypographySettings[role] : selection;
    return next;
  }, { ...defaultTypographySettings });
}
