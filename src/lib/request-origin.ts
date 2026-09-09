/** Browser-controlled Origin must match the actual HTTP Host. Forwarded headers
 * are deliberately ignored: deployment may preserve Host, but arbitrary clients
 * must never opt themselves into a trusted proxy boundary. */
export function acceptsRequestOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true; // Preserve existing non-browser API clients.
  try {
    const parsed = new URL(origin);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin) return false;
    const url = new URL(request.url);
    const host = request.headers.get('host');
    const expected = host ? new URL(`${url.protocol}//${host}`) : url;
    if (host && (expected.host !== host.toLowerCase() || /[\s,/@?#\\]/.test(host))) return false;
    return parsed.origin === expected.origin;
  } catch { return false; }
}
