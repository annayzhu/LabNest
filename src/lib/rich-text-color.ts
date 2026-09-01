export const RICH_TEXT_COLORS = ["risk"] as const;

export type RichTextColor = (typeof RICH_TEXT_COLORS)[number];

/** Semantic risk color shared by editor commands, persisted content, and exports. */
export const RICH_TEXT_RISK_COLOR_HEX = "#8f4e52";

const COLOR_VALUES_SOURCE = RICH_TEXT_COLORS.join("|");

export const LABNEST_COLOR_TOKEN_SOURCE = `<mark data-labnest-color="(?:${COLOR_VALUES_SOURCE})">[^\\n]*?<\\/mark>`;

export function parseRichTextColor(value: unknown): RichTextColor | undefined {
  if (value === "risk") return "risk";
  if (typeof value !== "string") return undefined;
  return [RICH_TEXT_RISK_COLOR_HEX, "#9c4848", "#c00000"].includes(value.trim().toLowerCase()) ? "risk" : undefined;
}

export function parseLabNestColorToken(value: string) {
  const match = value.match(new RegExp(`^<mark data-labnest-color="(${COLOR_VALUES_SOURCE})">([^\\n]*?)<\\/mark>$`));
  const color = parseRichTextColor(match?.[1]);
  return color && match?.[2] !== undefined ? { color, content: match[2] } : undefined;
}

export function stripLabNestColorMarkup(value: string) {
  return value
    .replace(new RegExp(`<mark data-labnest-color="(?:${COLOR_VALUES_SOURCE})">`, "g"), "")
    .replaceAll("</mark>", "");
}
