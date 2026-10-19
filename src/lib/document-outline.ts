import type { ScientificDocument } from "./scientific-document";

export type DocumentOutlineItem = { id: string; label: string };

export function scientificSectionAnchorId(sectionKey: string) {
  return `scientific-section-${encodeURIComponent(sectionKey)}`;
}

export function scientificDocumentOutline(document: ScientificDocument, hiddenSectionKeys: readonly string[] = []): DocumentOutlineItem[] {
  const hiddenKeys = new Set(hiddenSectionKeys);
  return document.sections
    .filter((section) => !hiddenKeys.has(section.key))
    .map((section) => ({ id: scientificSectionAnchorId(section.key), label: section.title }));
}

/**
 * Which section the reader is in: the last one whose top has passed the reading line.
 * At the end of the page the short closing sections can never reach that line, so the last section in view wins.
 */
export function readingSectionIndex(tops: readonly number[], readingLine: number, viewportHeight: number, atPageEnd: boolean) {
  if (!tops.length) return -1;
  if (atPageEnd) for (let index = tops.length - 1; index >= 0; index--) if (tops[index] < viewportHeight) return index;
  let reading = 0;
  tops.forEach((top, index) => { if (top <= readingLine) reading = index; });
  return reading;
}
