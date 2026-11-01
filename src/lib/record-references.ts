/**
 * A sample, inventory product or stock lot named in a document (Q249–Q252): a Markdown link to its page, shown as a tag.
 * The link text is what was written at the time; the page behind the ID shows how the record stands now.
 */
export type RecordReferenceKind = "sample" | "product" | "lot";
export type RecordReference = { kind: RecordReferenceKind; id: string; label: string };

// Pages under /inventory that are not stock lots.
const inventoryPages = new Set(["list", "new", "products", "types", "locations", "import", "export"]);

/** Any Markdown link to a sample or inventory page; `parseRecordReferenceLink` decides whether it names a record. */
export const RECORD_REFERENCE_LINK_SOURCE = "\\[[^\\]\\n]+\\]\\(\\/(?:samples|inventory)\\/[A-Za-z0-9_\\/-]+\\)";

export function recordReferenceHref(kind: RecordReferenceKind, id: string) {
  return kind === "sample" ? `/samples/${id}` : kind === "product" ? `/inventory/products/${id}` : `/inventory/${id}`;
}

export function parseRecordReferenceHref(href: string): { kind: RecordReferenceKind; id: string } | null {
  const match = /^\/(samples|inventory\/products|inventory)\/([A-Za-z0-9_-]+)$/.exec(href);
  if (!match) return null;
  if (match[1] === "samples") return { kind: "sample", id: match[2] };
  if (match[1] === "inventory/products") return { kind: "product", id: match[2] };
  return inventoryPages.has(match[2]) ? null : { kind: "lot", id: match[2] };
}

/** One line, no square brackets (they would end the Markdown link text). */
export function recordReferenceLabel(text: string) {
  return text.replace(/\s+/g, " ").replaceAll("[", "［").replaceAll("]", "］").trim().slice(0, 160);
}

export function recordReferenceMarkdown(reference: RecordReference) {
  return `[${recordReferenceLabel(reference.label) || reference.id}](${recordReferenceHref(reference.kind, reference.id)})`;
}

export function parseRecordReferenceLink(part: string): RecordReference | null {
  const match = /^\[([^\]\n]+)\]\(([^)\s]+)\)$/.exec(part);
  const target = match ? parseRecordReferenceHref(match[2]) : null;
  return match && target ? { ...target, label: match[1] } : null;
}

export function recordReferencesInText(text: string): RecordReference[] {
  return [...text.matchAll(new RegExp(RECORD_REFERENCE_LINK_SOURCE, "g"))].flatMap((match) => parseRecordReferenceLink(match[0]) ?? []);
}

/** Search and export text: a reference reads as its written label. */
export function stripRecordReferenceLinks(text: string) {
  return text.replace(new RegExp(RECORD_REFERENCE_LINK_SOURCE, "g"), (part) => parseRecordReferenceLink(part)?.label ?? part);
}

export function sampleReferenceLabel(sample: { code: string; name: string }) {
  const name = sample.name.trim();
  return name && name !== sample.code ? `${sample.code} ${name}` : sample.code;
}

/** A lot reads as its product and lot number, or where it is kept when it has none. */
export function lotReferenceLabel(lot: { productName: string; lotNumber?: string | null; place?: string | null }, lotWord: string) {
  const detail = lot.lotNumber?.trim() ? `${lotWord} ${lot.lotNumber.trim()}` : lot.place?.trim();
  return detail ? `${lot.productName} · ${detail}` : lot.productName;
}
