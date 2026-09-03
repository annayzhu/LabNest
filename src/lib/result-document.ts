import type { ScientificContentBlock, ScientificDocument } from "./scientific-document";

export type LegacyResultValues = {
  textValue?: string | null;
  numericValue?: number | null;
  unit?: string | null;
  notes?: string | null;
};

const LEGACY_PROMOTION_KEY = "legacyValuesPromotedToDocument";
const LEGACY_EMPTY_TEMPLATE_NOTE = "Template registered; no measurement has been entered.";

export function resultLegacyValuesArePromoted(metadata: unknown) {
  return Boolean(metadata && typeof metadata === "object" && !Array.isArray(metadata) && (metadata as Record<string, unknown>)[LEGACY_PROMOTION_KEY] === true);
}

export function withResultLegacyPromotionMarker(metadata: unknown): Record<string, unknown> {
  const existing = metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata as Record<string, unknown> : {};
  return { ...existing, [LEGACY_PROMOTION_KEY]: true };
}

/**
 * Keep historical scalar Result columns readable while moving all free-form
 * result capture into the shared scientific document. The conversion is
 * idempotent, so it is safe for both detail rendering and edit initialization.
 */
export function resultDocumentWithLegacyValues(document: ScientificDocument, values: LegacyResultValues): ScientificDocument {
  const next: ScientificDocument = {
    ...document,
    sections: document.sections.map((section) => ({ ...section, blocks: section.blocks.map((block) => ({ ...block })) })),
  };
  const summary = next.sections.find((section) => section.key === "summary");
  if (!summary) return next;

  const textValue = values.textValue?.trim();
  const rawNotes = values.notes?.trim();
  const notes = rawNotes === LEGACY_EMPTY_TEMPLATE_NOTE ? undefined : rawNotes;
  const unit = values.unit?.trim() || undefined;
  const hasText = (text: string) => summary.blocks.some((block) => (block.type === "text" || block.type === "heading" || block.type === "callout") && block.text.trim() === text);
  const additions: ScientificContentBlock[] = [];

  const hasId = (id: string) => summary.blocks.some((block) => block.id === id);
  if (textValue && !hasId("legacy-result-summary") && !hasText(textValue)) additions.push({ id: "legacy-result-summary", type: "text", text: textValue });
  if (values.numericValue !== null && values.numericValue !== undefined && !hasId("legacy-result-primary-outcome") && !summary.blocks.some((block) => block.type === "metric" && block.value === String(values.numericValue) && (block.unit || undefined) === unit)) {
    additions.push({ id: "legacy-result-primary-outcome", type: "metric", label: "Primary numeric outcome", value: String(values.numericValue), unit });
  }
  if (notes && !hasId("legacy-result-notes") && !hasText(notes)) {
    if (!summary.blocks.some((block) => block.type === "heading" && block.text === "Notes")) additions.push({ id: "legacy-result-notes-heading", type: "heading", text: "Notes" });
    additions.push({ id: "legacy-result-notes", type: "text", text: notes });
  }
  summary.blocks.push(...additions);
  return next;
}
