/** Decode only the Markdown transport envelope. Consumers apply their own schema.
 * Kept independent of document/media schemas to avoid a circular import. */
export function decodeDocumentTableToken(line: string): unknown {
  const match = line.trim().match(/^<!--labnest-table:(.+)-->$/);
  if (!match) return undefined;
  try {
    return JSON.parse(decodeURIComponent(match[1]));
  } catch {
    return undefined;
  }
}
