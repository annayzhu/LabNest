export const RICH_TEXT_FONT_FAMILIES = ["sans", "serif", "mono"] as const;

export type RichTextFontFamily = (typeof RICH_TEXT_FONT_FAMILIES)[number];

export const DEFAULT_RICH_TEXT_FONT_FAMILY: RichTextFontFamily = "sans";

const FONT_FAMILY_VALUES_SOURCE = RICH_TEXT_FONT_FAMILIES.join("|");

export function parseRichTextFontFamily(value: string | null | undefined): RichTextFontFamily | undefined {
  return value && RICH_TEXT_FONT_FAMILIES.includes(value as RichTextFontFamily)
    ? value as RichTextFontFamily
    : undefined;
}

export function richTextFontFamilyPrefix(value: RichTextFontFamily | undefined) {
  return value
    ? `<!--labnest-font-family:${value}-->`
    : "";
}

export function parseRichTextFontFamilyLine(value: string) {
  const match = value.match(new RegExp(`^<!--labnest-font-family:(${FONT_FAMILY_VALUES_SOURCE})-->(.*)$`));
  const fontFamily = parseRichTextFontFamily(match?.[1]);
  return fontFamily && match ? { fontFamily, content: match[2] } : { content: value };
}

export function stripLabNestFontFamilyMarkup(value: string) {
  return value.replace(new RegExp(`<!--labnest-font-family:(?:${FONT_FAMILY_VALUES_SOURCE})-->`, "g"), "");
}

function selectedLeafBlocks(root: HTMLElement) {
  const selection = window.getSelection();
  if (!selection?.rangeCount) return [];
  const range = selection.getRangeAt(0);
  if (!root.contains(range.commonAncestorContainer)) return [];
  return Array.from(root.querySelectorAll<HTMLElement>("p, h1, h2, h3, blockquote, li, div"))
    .filter((element) => {
      try { return range.intersectsNode(element); }
      catch { return false; }
    })
    .filter((element) => !Array.from(element.children).some((child) => child.matches("p, h1, h2, h3, blockquote, li, div")));
}

export function applyRichTextFontFamily(root: HTMLElement, fontFamily: RichTextFontFamily) {
  let blocks = selectedLeafBlocks(root);
  if (!blocks.length) {
    document.execCommand("formatBlock", false, "p");
    blocks = selectedLeafBlocks(root);
  }
  for (const block of blocks) {
    block.dataset.labnestFontFamily = fontFamily;
    block.style.removeProperty("font-family");
  }
}

/** Remove typography pasted from Word/web pages while preserving LabNest controls. */
export function normalizePastedRichTextTypography(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>("*").forEach((element) => {
    if (!element.dataset.labnestFontFamily) element.style.removeProperty("font-family");
    if (!element.dataset.labnestLineHeight) element.style.removeProperty("line-height");
    if (!element.dataset.labnestSize) element.style.removeProperty("font-size");
    if (element.tagName.toLowerCase() === "font") {
      element.removeAttribute("face");
      element.removeAttribute("size");
    }
    if (!element.getAttribute("style")?.trim()) element.removeAttribute("style");
  });
}

export function clearSelectedRichTextFormatting(root: HTMLElement) {
  const selection = window.getSelection();
  if (!selection?.rangeCount || !root.contains(selection.getRangeAt(0).commonAncestorContainer)) return;
  let blocks = selectedLeafBlocks(root);
  if (!blocks.length) {
    document.execCommand("formatBlock", false, "p");
    blocks = selectedLeafBlocks(root);
  }

  for (const block of blocks) {
    let ancestor = block.parentElement;
    while (ancestor && ancestor !== root) {
      ancestor.style.removeProperty("font-family");
      ancestor.style.removeProperty("font-size");
      ancestor.style.removeProperty("line-height");
      if (!ancestor.getAttribute("style")?.trim()) ancestor.removeAttribute("style");
      ancestor = ancestor.parentElement;
    }

    const checklist = block.getAttribute("data-checklist");
    Array.from(block.attributes).forEach((attribute) => block.removeAttribute(attribute.name));
    if (checklist !== null) block.setAttribute("data-checklist", checklist);

    Array.from(block.querySelectorAll<HTMLElement>("*")).reverse().forEach((element) => {
      if (element.tagName.toLowerCase() === "br" || element.hasAttribute("data-check-marker")) return;
      element.replaceWith(...Array.from(element.childNodes));
    });

    delete block.dataset.labnestFontFamily;
    delete block.dataset.labnestLineHeight;
    block.style.removeProperty("line-height");
  }
}
