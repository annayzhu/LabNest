/**
 * What happened to Copilot suggestions (Q334): which fields an author changed before adopting one, and the adoption
 * numbers the AI page shows per service, module and task spec version.
 */

/** Why an author set a suggestion aside. They pick from the first four; the program records the rest. */
export const ignoreReasons = ['wrong', 'not_needed', 'already_have', 'poor_wording', 'regenerated', 'other'] as const;
export type IgnoreReason = typeof ignoreReasons[number];
export const pickableReasons = ['wrong', 'not_needed', 'already_have', 'poor_wording'] as const;
export const ignoreReasonLabels: Record<IgnoreReason, string> = {
  wrong: 'Wrong', not_needed: 'Not needed', already_have: 'Already there', poor_wording: 'Poorly written', regenerated: 'Asked for a new one', other: 'Other',
};

export type SuggestionStatus = 'pending' | 'edited' | 'adopted' | 'ignored';
export const openStatuses: SuggestionStatus[] = ['pending', 'edited'];

/** JSON with object keys sorted: Postgres keeps JSON keys in its own order, so values read back compare equal. */
export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).filter(key => (value as Record<string, unknown>)[key] !== undefined).sort().map(key => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}

/** The top-level fields that differ between what was proposed and what the author kept. */
export function changedFields(proposed: Record<string, unknown>, kept: Record<string, unknown>, skip: readonly string[] = []) {
  return [...new Set([...Object.keys(proposed), ...Object.keys(kept)])].filter(key => !skip.includes(key) && stableJson(proposed[key]) !== stableJson(kept[key])).sort();
}

export type AdoptionRow = { status: string; editedFields: string[]; ignoreReason: string | null };
export type AdoptionNumbers = { adopted: number; ignored: number; open: number; editedAverage: number | null; reasons: Partial<Record<IgnoreReason, number>> };

/** Decided suggestions split into adopted and ignored, with how many fields were changed before adopting. */
export function adoptionNumbers(rows: AdoptionRow[]): AdoptionNumbers {
  const adopted = rows.filter(row => row.status === 'adopted');
  const reasons: AdoptionNumbers['reasons'] = {};
  for (const row of rows) if (row.status === 'ignored') {
    const reason = (ignoreReasons as readonly string[]).includes(row.ignoreReason ?? '') ? row.ignoreReason as IgnoreReason : 'other';
    reasons[reason] = (reasons[reason] ?? 0) + 1;
  }
  return {
    adopted: adopted.length,
    ignored: rows.filter(row => row.status === 'ignored').length,
    open: rows.filter(row => (openStatuses as string[]).includes(row.status)).length,
    editedAverage: adopted.length ? adopted.reduce((sum, row) => sum + row.editedFields.length, 0) / adopted.length : null,
    reasons,
  };
}

/** The share of decided suggestions that were adopted, or undefined before any was decided. */
export const adoptionRate = (numbers: AdoptionNumbers) => numbers.adopted + numbers.ignored ? numbers.adopted / (numbers.adopted + numbers.ignored) : undefined;
