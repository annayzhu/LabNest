/** 现场模式 on other devices: the address a tablet, phone or watch can reach, and the run page it opens. */

/** Names the computer uses for itself; a tablet, phone or watch cannot reach them. */
export function isLocalHost(hostname: string) {
  const name = hostname.toLowerCase();
  return ['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]'].includes(name) || name.endsWith('.localhost');
}

/** "192.168.0.102:3001" or "http://192.168.0.102:3001/runs" → "http://192.168.0.102:3001"; undefined when other devices could not use it. */
export function lanOrigin(input: string) {
  const text = input.trim();
  if (!text) return undefined;
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(text) ? text : `http://${text}`);
    if (!['http:', 'https:'].includes(url.protocol) || isLocalHost(url.hostname)) return undefined;
    return url.origin;
  } catch {
    return undefined;
  }
}

/** The page a tablet or phone opens after scanning: this experiment's run, laid out for the bench. */
export function fieldRunUrl(origin: string, experimentId: string) {
  return `${origin}/experiments/${encodeURIComponent(experimentId)}/run?view=bench`;
}

/** Opens the installed iPhone companion. Only the short-lived pairing code is shared, never a bearer token. */
export function watchPairingLink(origin: string, rawCode: string) {
  const server = lanOrigin(origin);
  const code = rawCode.replace(/\s/g, '');
  if (!server || !/^[0-9]{4}$/.test(code)) return undefined;
  const parsed = new URL(origin.includes('://') ? origin : `http://${origin}`);
  if (parsed.username || parsed.password) return undefined;
  return `labnest://watch-pair?${new URLSearchParams({ server, code })}`;
}
