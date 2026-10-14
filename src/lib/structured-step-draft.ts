/** Keep local observations independent of unrelated Run revisions, while requiring
 * review when the same operation or its recorded values changed elsewhere. */
export type StructuredStepDraft = {
  values: Record<string, string>; reason: string; context: string; recorded: string;
};
export function reconcileStructuredStepDraft(draft: StructuredStepDraft, context: string, recorded: Record<string, { value: number }>) {
  const contextChanged = draft.context !== context;
  const values = contextChanged ? draft.values : Object.fromEntries(Object.entries(draft.values).filter(([id, value]) =>
    value.trim() === '' || !recorded[id] || Number(value) !== recorded[id].value));
  return {
    values, reason: draft.reason, contextChanged,
    needsReview: contextChanged || Boolean(Object.keys(values).length && draft.recorded !== JSON.stringify(recorded)),
  };
}
