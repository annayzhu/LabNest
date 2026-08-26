export type FormActionState = { error?: string; message?: string };
export type FormAction = (
  previousState: FormActionState,
  formData: FormData,
) => Promise<FormActionState>;

export function formActionErrorMessage(error: unknown, fallback: string, uniqueConflictMessage?: string) {
  if (uniqueConflictMessage && error && typeof error === "object" && "code" in error && error.code === "P2002") {
    return uniqueConflictMessage;
  }
  if (error && typeof error === "object" && "issues" in error && Array.isArray(error.issues)) {
    const message = error.issues
      .map((issue) => issue && typeof issue === "object" && "message" in issue ? String(issue.message).trim() : "")
      .find(Boolean);
    if (message) return message;
  }
  const message = error instanceof Error ? error.message.trim() : "";
  return message || fallback;
}
