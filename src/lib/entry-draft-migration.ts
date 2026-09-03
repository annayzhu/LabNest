type CurrentEntryDraftFields = {
  contentMarkdown: string;
  protocolVersionId: string;
  createInitialResult: string;
  resultTitle: string;
  resultType: string;
};

type LegacyEntryDraftFields = Partial<CurrentEntryDraftFields> & {
  resultTextValue?: string;
  resultNotes?: string;
};

export function migrateEntryDraftFields<T extends CurrentEntryDraftFields>(baseline: T, draftFields: Partial<T> & LegacyEntryDraftFields) {
  const { resultTextValue, resultNotes, ...currentFields } = draftFields;
  const restored = { ...baseline, ...currentFields };
  const legacyParts = [
    resultTextValue?.trim() ? `Result\n\n${resultTextValue.trim()}` : "",
    resultNotes?.trim() ? `Notes\n\n${resultNotes.trim()}` : "",
  ].filter(Boolean);
  const hadLegacyResult = Boolean(draftFields.resultTitle?.trim() || draftFields.resultType?.trim() || legacyParts.length);

  if (legacyParts.length) {
    const legacySection = `## Recovered initial result\n\n${legacyParts.join("\n\n")}`;
    restored.contentMarkdown = [restored.contentMarkdown.trim(), legacySection].filter(Boolean).join("\n\n");
  }
  if (hadLegacyResult && restored.protocolVersionId) restored.createInitialResult = "true";

  return { fields: restored, migratedLegacyResult: hadLegacyResult };
}
