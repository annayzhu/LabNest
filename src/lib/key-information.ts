export const keyInformationMaxLength = 5000;

export type KeyInformationFormState = {
  error?: string;
  saved?: boolean;
};

export type KeyInformationAction = (
  previousState: KeyInformationFormState,
  formData: FormData,
) => Promise<KeyInformationFormState>;

export function normalizeKeyInformation(value: unknown) {
  if (typeof value !== "string") throw new Error("Key information must be text.");
  const normalized = value.trim();
  if (normalized.length > keyInformationMaxLength) {
    throw new Error(`Key information must be ${keyInformationMaxLength} characters or fewer.`);
  }
  return normalized || null;
}
