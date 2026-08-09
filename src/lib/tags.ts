export const tagSeparatorHint = "Separate with commas, semicolons, or spaces.";

export function parseTags(value: unknown) {
  const source = Array.isArray(value) ? value.map(String).join(",") : String(value ?? "");
  return Array.from(new Set(
    source
      .split(/[,，;；\s]+/u)
      .map((tag) => tag.trim())
      .filter(Boolean),
  ));
}
