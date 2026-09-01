export const typographySettingsStorageKey = "labnest.typography-settings.v1";
export const typographyCssStorageKey = "labnest.typography-css.v1";
export const customFontDatabaseName = "labnest-custom-fonts";
export const customFontStoreName = "fonts";
export const maxCustomFontBytes = 10_000_000;
export const maxCustomFontCount = 8;

export const typographyPresets = {
  ui: [
    {
      id: "source-han-sans",
      name: "思源黑体",
      description: "清晰、克制，适合导航与表单",
      family: '"Source Han Sans SC", "Noto Sans CJK SC", "PingFang SC", "Microsoft YaHei", ui-sans-serif, system-ui, sans-serif',
    },
    {
      id: "pingfang",
      name: "苹方",
      description: "轻盈现代，适合 macOS",
      family: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", ui-sans-serif, system-ui, sans-serif',
    },
    {
      id: "system-sans",
      name: "系统黑体",
      description: "跟随当前设备，加载最稳定",
      family: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
    },
  ],
  documentBody: [
    {
      id: "source-han-serif",
      name: "思源宋体",
      description: "清楚舒展，适合长文阅读",
      family: '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", STSong, SimSun, serif',
    },
    {
      id: "songti",
      name: "华文宋体",
      description: "温润传统，适合中文文档",
      family: '"Songti SC", STSong, SimSun, serif',
    },
    {
      id: "simsun",
      name: "中易宋体",
      description: "兼容性好，接近传统科研文稿",
      family: 'SimSun, "Songti SC", STSong, serif',
    },
  ],
  documentHeading: [
    {
      id: "source-han-serif",
      name: "思源宋体",
      description: "端正但不过分厚重",
      family: '"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", STSong, SimSun, serif',
    },
    {
      id: "songti",
      name: "华文宋体",
      description: "更具中文书卷气",
      family: '"Songti SC", STSong, SimSun, serif',
    },
    {
      id: "source-serif",
      name: "Source Serif",
      description: "适合英文标题，中文自动回退",
      family: '"Source Serif 4", "Songti SC", STSong, SimSun, Georgia, serif',
    },
  ],
} as const;

export type TypographyRole = keyof typeof typographyPresets;
export type TypographyPresetId = (typeof typographyPresets)[TypographyRole][number]["id"];

export type PresetFontSelection = { kind: "preset"; id: TypographyPresetId };
export type CustomFontSelection = { kind: "custom"; id: string; family: string; name: string };
export type FontSelection = PresetFontSelection | CustomFontSelection;

export type TypographySettings = Record<TypographyRole, FontSelection>;

export type CustomFontRecord = {
  id: string;
  family: string;
  name: string;
  fileName: string;
  mimeType: string;
  size: number;
  data: ArrayBuffer;
  createdAt: string;
};

export const defaultTypographySettings: TypographySettings = {
  ui: { kind: "preset", id: "source-han-sans" },
  documentBody: { kind: "preset", id: "source-han-serif" },
  documentHeading: { kind: "preset", id: "source-han-serif" },
};

const cssVariableByRole: Record<TypographyRole, string> = {
  ui: "--font-ui",
  documentBody: "--font-document-body",
  documentHeading: "--font-document-heading",
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
    const value = JSON.parse(serialized) as Partial<Record<TypographyRole, unknown>>;
    return {
      ui: parseSelection("ui", value.ui),
      documentBody: parseSelection("documentBody", value.documentBody),
      documentHeading: parseSelection("documentHeading", value.documentHeading),
    };
  } catch {
    return defaultTypographySettings;
  }
}

function familyForSelection(role: TypographyRole, selection: FontSelection): string {
  if (selection.kind === "custom") {
    const fallback = typographyPresets[role].find((preset) => preset.id === defaultTypographySettings[role].id)?.family;
    return `"${selection.family}", ${fallback}`;
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
  Object.entries(variables).forEach(([property, value]) => root.style.setProperty(property, value));
  window.localStorage.setItem(typographySettingsStorageKey, JSON.stringify(settings));
  window.localStorage.setItem(typographyCssStorageKey, JSON.stringify(variables));
}

export function validateCustomFontFile(file: Pick<File, "name" | "size" | "type">): string | null {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension || !["woff2", "ttf", "otf"].includes(extension)) return "请选择 WOFF2、TTF 或 OTF 字体文件。";
  if (file.size > maxCustomFontBytes) return "单个字体文件不能超过 10 MB。";
  if (file.size === 0) return "字体文件为空，请选择其他文件。";
  return null;
}

export function settingsWithoutCustomFont(settings: TypographySettings, fontId: string): TypographySettings {
  return (Object.keys(settings) as TypographyRole[]).reduce<TypographySettings>((next, role) => {
    const selection = settings[role];
    next[role] = selection.kind === "custom" && selection.id === fontId ? defaultTypographySettings[role] : selection;
    return next;
  }, { ...defaultTypographySettings });
}
