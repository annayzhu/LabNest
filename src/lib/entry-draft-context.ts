type DraftContext = { experimentId?: string; experimentStepId?: string; protocolVersionId?: string };
const contextKeys = ["experimentId", "experimentStepId", "protocolVersionId"] as const;

export function entryDraftKey(entryId: string | undefined, context: DraftContext) {
  if (entryId) return `entry-composer:${entryId}`;
  return `entry-composer:new:${JSON.stringify(contextKeys.map((key) => context[key] || ""))}`;
}

export function entryDraftMatchesContext(context: DraftContext, draft: DraftContext) {
  return contextKeys.every((key) => (context[key] || "") === (draft[key] || ""));
}
