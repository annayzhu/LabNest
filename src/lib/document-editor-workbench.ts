export type DocumentInsertProfile = "scientific-full" | "scientific-result" | "scientific-narrative";

const insertActionIdsByProfile = {
  "scientific-full": ["table", "metric", "callout", "media", "dataset"],
  "scientific-result": ["table", "metric", "callout", "media", "dataset"],
  "scientific-narrative": ["table", "callout", "media"],
} as const satisfies Record<DocumentInsertProfile, readonly string[]>;

export function insertActionIdsForProfile(profile: DocumentInsertProfile): readonly string[] {
  return insertActionIdsByProfile[profile];
}

export function documentFitScale(panelWidth: number, paperWidth: number) {
  if (!Number.isFinite(panelWidth) || !Number.isFinite(paperWidth) || paperWidth <= 0) return 1;
  return Math.min(1.5, Math.max(0.4, (panelWidth - 2) / paperWidth));
}
