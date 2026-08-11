export const RICH_TEXT_FONT_SIZES_PT = [8, 9, 10, 11, 12, 14] as const;

export type RichTextFontSizePt = (typeof RICH_TEXT_FONT_SIZES_PT)[number];

export const DEFAULT_RICH_TEXT_FONT_SIZE_PT: RichTextFontSizePt = 10;

const FONT_SIZE_VALUES_SOURCE = RICH_TEXT_FONT_SIZES_PT.join("|");

export const LABNEST_FONT_SIZE_TOKEN_SOURCE = `<span data-labnest-size="(?:${FONT_SIZE_VALUES_SOURCE})">[^\\n]*?<\\/span>`;

export function isRichTextFontSizePt(value: unknown): value is RichTextFontSizePt {
  return typeof value === "number" && RICH_TEXT_FONT_SIZES_PT.includes(value as RichTextFontSizePt);
}

export function parseRichTextFontSizePt(value: string | null | undefined): RichTextFontSizePt | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return isRichTextFontSizePt(parsed) ? parsed : undefined;
}

export function parseLabNestFontSizeToken(value: string) {
  const match = value.match(new RegExp(`^<span data-labnest-size="(${FONT_SIZE_VALUES_SOURCE})">([^\\n]*?)<\\/span>$`));
  const size = parseRichTextFontSizePt(match?.[1]);
  return size === undefined || match?.[2] === undefined ? undefined : { size, content: match[2] };
}

export function stripLabNestFontSizeMarkup(value: string) {
  return value
    .replace(new RegExp(`<span data-labnest-size="(?:${FONT_SIZE_VALUES_SOURCE})">`, "g"), "")
    .replaceAll("</span>", "");
}
