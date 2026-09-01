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
