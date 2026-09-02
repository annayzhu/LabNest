export const uiScaleStorageKey = "labnest.ui-scale";

export const uiScaleOptions = [
  {
    id: "compact",
    name: "紧凑",
    nameEn: "Compact",
    description: "更小的界面字与更清楚的信息层级",
    descriptionEn: "Smaller interface type with a clearer hierarchy",
  },
  {
    id: "standard",
    name: "标准",
    nameEn: "Standard",
    description: "接近浏览器常规界面字号",
    descriptionEn: "Balanced everyday interface sizing",
  },
  {
    id: "comfortable",
    name: "舒展",
    nameEn: "Comfortable",
    description: "放大界面文字，控件间距保持不变",
    descriptionEn: "Larger interface type without changing control spacing",
  },
] as const;

export type UiScaleId = (typeof uiScaleOptions)[number]["id"];

export const defaultUiScale: UiScaleId = "compact";

export function isUiScaleId(value: unknown): value is UiScaleId {
  return typeof value === "string" && uiScaleOptions.some((option) => option.id === value);
}

export function applyUiScale(scale: UiScaleId, root: HTMLElement = document.documentElement) {
  root.dataset.labnestUiScale = scale;
  window.localStorage.setItem(uiScaleStorageKey, scale);
}
