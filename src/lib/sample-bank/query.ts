import { sampleBankQuerySchema, type SampleBankQuery } from "./contract";

export type SearchForm = { text?: string; sampleTypes?: string[]; disease?: string; collectedFrom?: string; collectedTo?: string; attributes?: string };

/**
 * The search form as a contract query (S20). Extra conditions are one per line, written `name = value` (a full-width
 * ＝ or a colon works too); blank fields are left out, and at least one condition must remain.
 */
export function searchQueryFromForm(form: SearchForm): SampleBankQuery {
  const attributes: Record<string, string> = {};
  for (const line of (form.attributes ?? "").split(/\r?\n/)) {
    if (!line.trim()) continue;
    const match = line.match(/^\s*([^=＝:：]+?)\s*[=＝:：]\s*(.+?)\s*$/);
    if (!match) throw new Error("Write each extra condition as name = value, one per line.");
    attributes[match[1]] = match[2];
  }
  const blankToUndefined = (value: string | undefined) => value?.trim() || undefined;
  const query = {
    text: blankToUndefined(form.text),
    sampleTypes: form.sampleTypes?.length ? form.sampleTypes : undefined,
    disease: blankToUndefined(form.disease),
    collectedFrom: blankToUndefined(form.collectedFrom),
    collectedTo: blankToUndefined(form.collectedTo),
    attributes: Object.keys(attributes).length ? attributes : undefined,
  };
  if (query.collectedFrom && query.collectedTo && query.collectedFrom > query.collectedTo) throw new Error("The first collection date is after the last.");
  const parsed = sampleBankQuerySchema.safeParse(Object.fromEntries(Object.entries(query).filter(([, value]) => value !== undefined)));
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);
  return parsed.data;
}

/** A query in one line for lists: its conditions in the form's order. */
export function querySummary(query: SampleBankQuery, typeLabel: (key: string) => string = (key) => key) {
  return [
    query.text,
    query.sampleTypes?.map(typeLabel).join(", "),
    query.disease,
    query.collectedFrom || query.collectedTo ? `${query.collectedFrom ?? "…"} – ${query.collectedTo ?? "…"}` : undefined,
    ...Object.entries(query.attributes ?? {}).map(([name, value]) => `${name} = ${value}`),
  ].filter(Boolean).join(" · ");
}
