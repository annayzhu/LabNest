export const systemThemeStorageKey = "labnest.system-theme";

export const systemThemes = [
  {
    id: "moon-dai",
    name: "月白黛青",
    description: "安静、克制，适合长时间记录与阅读。",
    colors: ["#f5f7f4", "#3f625d", "#9a6257"],
    motif: "huiwen",
  },
  {
    id: "azure-coral",
    name: "法蓝赪霞",
    description: "明亮而清晰，增强操作与选中状态的辨识度。",
    colors: ["#f5fafb", "#30aecf", "#de7565"],
    motif: "ruyi-cloud",
  },
  {
    id: "celadon-pine",
    name: "青瓷松石",
    description: "柔和的青瓷底色与松石绿，沉静但不冷淡。",
    colors: ["#f5f8f2", "#397568", "#b17859"],
    motif: "lotus",
  },
  {
    id: "lotus-ink",
    name: "藕荷砚墨",
    description: "偏暖的纸色与藕荷紫，适合报告和文档工作。",
    colors: ["#faf6f4", "#75556b", "#c06f5d"],
    motif: "linked-diamond",
  },
] as const;

export type SystemThemeId = (typeof systemThemes)[number]["id"];

export function isSystemThemeId(value: string | null): value is SystemThemeId {
  return systemThemes.some((theme) => theme.id === value);
}
