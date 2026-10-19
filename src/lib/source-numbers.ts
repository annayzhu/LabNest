/**
 * The numbers a text states, compared as written: full-width digits folded, thousands separators dropped
 * ("12,000 ×g" gives "12000"). Checks against a source use it to catch a number the source never gave.
 */
export function numbersIn(text: string): string[] {
  return (text.normalize('NFKC').match(/\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g) ?? []).map(number => number.replace(/,/g, ''));
}
