import { translateUiText } from "./i18n";
import type { StructuredFieldDefinition } from "./structured-modules";

// The words an import template shows people: each column and choice in Chinese and English, as the app names them,
// and the reverse, so a filled-in template reads back to field keys and stored codes.

/** “库位 / Storage location”; a name the app has no Chinese for stays as it is. */
export function bilingual(text: string) {
  const zh = translateUiText(text, "zh");
  return zh && zh !== text ? `${zh} / ${text}` : text;
}

/** The template's header for a field; a required one ends in *. */
export function columnHeader(field: StructuredFieldDefinition) {
  return `${bilingual(field.label)}${field.required ? " *" : ""}`;
}

/** Every header that names this field: its key, label, Chinese label, template header and aliases. */
export function headerNames(field: StructuredFieldDefinition) {
  return [field.key, field.label, translateUiText(field.label, "zh"), columnHeader(field), ...(field.aliases ?? [])];
}

/** Whether a field's cells are picked from a list in the template, and so are read back from it. */
export function hasChoices(field: StructuredFieldDefinition) {
  return Boolean(field.optionLabels || field.allowedValues?.length || field.choices);
}

/** The choices a template offers for a field: fixed ones from its definition, or the list the caller loaded. */
export function templateChoices(field: StructuredFieldDefinition, lists: Record<string, string[]> = {}) {
  if (field.optionLabels) return Object.values(field.optionLabels).map(bilingual);
  if (field.allowedValues?.length) return [...field.allowedValues];
  return field.choices ? (lists[field.key] ?? []).map(bilingual) : [];
}

/**
 * A chosen cell read back: “精确用量 / Precise use”, “Precise use”, “精确用量” and “precise” all store `precise`.
 * “A / B” loses its Chinese half only when A is exactly the Chinese for B, so a value such as “Fridge 2 / Shelf 3”
 * stays whole.
 */
export function choiceValue(field: StructuredFieldDefinition, value: unknown) {
  if (typeof value !== "string") return value;
  const parts = value.match(/^(.+?)\s+\/\s+(.+)$/);
  const text = parts && translateUiText(parts[2], "zh") === parts[1] ? parts[2] : value;
  if (!field.optionLabels) return text;
  const lower = text.toLowerCase();
  const code = Object.entries(field.optionLabels).find(([key, label]) => [key, label, translateUiText(label, "zh")].some((name) => name.toLowerCase() === lower));
  return code?.[0] ?? text;
}

/** A field's sample cell: a fixed choice is shown as the template offers it. */
export function sampleValue(field: StructuredFieldDefinition) {
  if (typeof field.example === "string" && field.optionLabels?.[field.example]) return bilingual(field.optionLabels[field.example]);
  if (typeof field.example === "string" && field.choices) return bilingual(field.example);
  return field.example ?? "";
}
