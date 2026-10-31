// A model's suggestion for spreadsheet columns the import did not recognise by name. It only fills the column
// choices in the import preview; the preview and its checks still decide what is imported.

type Field = { key: string; label: string; description?: string; allowedValues?: readonly string[] };

/** What the model is shown: the import's fields, and each unrecognised column with up to five of its values. */
export function columnPrompt(fields: readonly Field[], columns: { source: string; samples: string[] }[]) {
  return {
    system: [
      "You match the columns of a laboratory spreadsheet to the fields of an import.",
      "Choose a field only when the column clearly holds it; otherwise answer null. Use each field at most once.",
      'Answer with JSON only: an object from each column name to a field key or null, such as {"Cat. No.": "catalogNumber", "Remarks": null}.',
    ].join(" "),
    user: [
      "Fields:",
      ...fields.map((field) => `- ${field.key}: ${field.label}${field.description ? ` (${field.description})` : ""}${field.allowedValues ? ` [${field.allowedValues.join(", ")}]` : ""}`),
      "",
      "Columns and some of their values:",
      ...columns.map((column) => `- ${JSON.stringify(column.source)}: ${column.samples.map((sample) => sample.slice(0, 60)).join(" | ") || "(empty)"}`),
    ].join("\n"),
  };
}

/** The suggestion as column → field, kept only for the columns asked about and real fields, each field once. */
export function parseColumnReply(text: string, fieldKeys: readonly string[], sources: readonly string[]) {
  const start = text.indexOf("{");
  let parsed: unknown;
  try { parsed = JSON.parse(text.slice(start, text.lastIndexOf("}") + 1)); } catch { return {}; }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const chosen: Record<string, string> = {};
  for (const [source, target] of Object.entries(parsed)) {
    if (!sources.includes(source) || typeof target !== "string" || !fieldKeys.includes(target) || Object.values(chosen).includes(target)) continue;
    chosen[source] = target;
  }
  return chosen;
}
