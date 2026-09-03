export type DocumentInsertProfile = "scientific-full" | "scientific-result" | "scientific-narrative";

export const DOCUMENT_ZOOM_MIN = 80;
export const DOCUMENT_ZOOM_MAX = 160;
export const DOCUMENT_ZOOM_DEFAULT = 100;

const insertActionIdsByProfile = {
  "scientific-full": ["table", "metric", "callout", "media", "dataset"],
  "scientific-result": ["table", "metric", "callout", "media", "dataset"],
  "scientific-narrative": ["table", "callout", "media"],
} as const satisfies Record<DocumentInsertProfile, readonly string[]>;

export function insertActionIdsForProfile(profile: DocumentInsertProfile): readonly string[] {
  return insertActionIdsByProfile[profile];
}

export function normalizeDocumentZoom(value: unknown, fallback = DOCUMENT_ZOOM_DEFAULT) {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
  const safeFallback = Number.isFinite(fallback) ? fallback : DOCUMENT_ZOOM_DEFAULT;
  if (!Number.isFinite(parsed)) return Math.min(DOCUMENT_ZOOM_MAX, Math.max(DOCUMENT_ZOOM_MIN, Math.round(safeFallback)));
  return Math.min(DOCUMENT_ZOOM_MAX, Math.max(DOCUMENT_ZOOM_MIN, Math.round(parsed)));
}

export function documentFitScale(panelWidth: number, paperWidth: number, horizontalInset = 24) {
  if (!Number.isFinite(panelWidth) || !Number.isFinite(paperWidth) || paperWidth <= 0) return 1;
  const availableWidth = Math.max(0, panelWidth - Math.max(0, horizontalInset));
  return Math.min(DOCUMENT_ZOOM_MAX / 100, Math.max(DOCUMENT_ZOOM_MIN / 100, availableWidth / paperWidth));
}
