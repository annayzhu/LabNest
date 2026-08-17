export const RICH_TEXT_LINE_HEIGHTS = [1, 1.15, 1.3, 1.5, 2] as const;

export type RichTextLineHeight = (typeof RICH_TEXT_LINE_HEIGHTS)[number];

// CSS `line-height: 1` leaves almost no visual leading around Chinese glyphs.
// 1.5 is the default authoring line height for rich-text modules.
export const DEFAULT_RICH_TEXT_LINE_HEIGHT: RichTextLineHeight = 1.5;

const LINE_HEIGHT_VALUES_SOURCE = RICH_TEXT_LINE_HEIGHTS.map((value) => String(value).replace(".", "\\.")).join("|");

export function isRichTextLineHeight(value: unknown): value is RichTextLineHeight {
  return typeof value === "number" && RICH_TEXT_LINE_HEIGHTS.includes(value as RichTextLineHeight);
}

export function parseRichTextLineHeight(value: string | null | undefined): RichTextLineHeight | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return isRichTextLineHeight(parsed) ? parsed : undefined;
}

export function richTextLineHeightPrefix(value: RichTextLineHeight | undefined) {
  return value && value !== DEFAULT_RICH_TEXT_LINE_HEIGHT
    ? `<!--labnest-line-height:${value}-->`
    : "";
}

export function parseRichTextLineHeightLine(value: string) {
  const match = value.match(new RegExp(`^<!--labnest-line-height:(${LINE_HEIGHT_VALUES_SOURCE})-->(.*)$`));
  const lineHeight = parseRichTextLineHeight(match?.[1]);
  return lineHeight && match ? { lineHeight, content: match[2] } : { content: value };
}

export function stripLabNestLineHeightMarkup(value: string) {
  return value.replace(new RegExp(`<!--labnest-line-height:(?:${LINE_HEIGHT_VALUES_SOURCE})-->`, "g"), "");
}

export function applyRichTextLineHeight(root: HTMLElement, lineHeight: RichTextLineHeight) {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return;
  let range = selection.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return;

  const matchingBlocks = () => Array.from(root.querySelectorAll<HTMLElement>("p, h1, h2, h3, blockquote, li, div"))
    .filter((element) => {
      try { return range.intersectsNode(element); }
      catch { return false; }
    })
    .filter((element) => !Array.from(element.children).some((child) => child.matches("p, h1, h2, h3, blockquote, li, div")));

  let blocks = matchingBlocks();
  if (!blocks.length) {
    document.execCommand("formatBlock", false, "p");
    if (!selection.rangeCount) return;
    range = selection.getRangeAt(0);
    blocks = matchingBlocks();
  }

  for (const block of blocks) {
    if (lineHeight === DEFAULT_RICH_TEXT_LINE_HEIGHT) {
      delete block.dataset.labnestLineHeight;
      block.style.removeProperty("line-height");
    } else {
      block.dataset.labnestLineHeight = String(lineHeight);
      block.style.lineHeight = String(lineHeight);
    }
  }
}
