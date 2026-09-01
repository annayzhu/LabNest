export const systemThemeStorageKey = "labnest.system-theme";

export const systemThemes = [
  {
    id: "moon-dai",
    name: "月白黛青",
    description: "月白纸面、黛青结构与韎韐暖红，冷暖对照更清楚。",
    colors: ["#f7f9fb", "#2a475f", "#a5441b"],
    navigation: { background: "#a5441b", foreground: "#ffffff" },
    motif: "huiwen",
  },
  {
    id: "azure-coral",
    name: "法蓝赪霞",
    description: "明亮而清晰，增强操作与选中状态的辨识度。",
    colors: ["#f5fafb", "#30aecf", "#de7565"],
    navigation: { background: "#de7565", foreground: "#2b1815" },
    motif: "ruyi-cloud",
  },
  {
    id: "celadon-pine",
    name: "青瓷松石",
    description: "青瓷与松石负责秩序，以槟榔棕作为温暖的选中撞色。",
    colors: ["#f5f8f2", "#4a9d9c", "#c1651a"],
    navigation: { background: "#986524", foreground: "#ffffff" },
    motif: "lotus",
  },
  {
    id: "lotus-ink",
    name: "藕荷砚墨",
    description: "藕荷紫与官绿相撞，保留温润纸感又有明确焦点。",
    colors: ["#faf6f4", "#75556b", "#7aa35a"],
    navigation: { background: "#7aa35a", foreground: "#15210f" },
    motif: "linked-diamond",
  },
  {
    id: "indigo-xiangqi",
    name: "靛青缃绮",
    description: "深靛蓝搭配明亮缃绮金，理性内容中带清晰行动焦点。",
    colors: ["#f6f8fc", "#1661ab", "#f8c471"],
    navigation: { background: "#f8c471", foreground: "#2f240e" },
    motif: "linked-diamond",
  },
  {
    id: "palace-jasmine",
    name: "宫绿茉莉",
    description: "宫殿绿与草茉莉红形成鲜明互补，明快但不过量。",
    colors: ["#f7faf5", "#20894d", "#ef475d"],
    navigation: { background: "#ef475d", foreground: "#2c1015" },
    motif: "lotus",
  },
  {
    id: "ganqing-buddha",
    name: "绀青佛手",
    description: "清亮绀青配佛手黄，适合偏年轻、辨识度高的工作界面。",
    colors: ["#f7f9ff", "#4f84ff", "#fed71a"],
    navigation: { background: "#fed71a", foreground: "#1f2a44" },
    motif: "huiwen",
  },
] as const;

export type SystemThemeId = (typeof systemThemes)[number]["id"];

export function isSystemThemeId(value: string | null): value is SystemThemeId {
  return systemThemes.some((theme) => theme.id === value);
}
