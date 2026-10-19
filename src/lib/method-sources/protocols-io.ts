import { joinSections, plainTitle, stripHtml, textOf, type MethodHit, type MethodSourceAdapter, type MethodText } from './types';

export const protocolsIoHost = 'www.protocols.io';
type FetchJson = (url: string, init?: RequestInit) => Promise<unknown>;

/** protocols.io public API v4. Searches are public protocols only; the developer token is the user's own, kept encrypted. */
export function protocolsIoAdapter(fetchJson: FetchJson, token: string): MethodSourceAdapter {
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json' };
  return {
    id: 'protocols_io',
    async search(query) {
      const url = `https://${protocolsIoHost}/api/v4/protocols?filter=public&key=${encodeURIComponent(query)}&page_size=10&order_field=relevance&order_dir=desc`;
      const payload = await fetchJson(url, { headers }) as { items?: unknown[] };
      return (payload.items ?? []).flatMap(item => parseSearchItem(item));
    },
    async fetch(externalId) {
      const payload = await fetchJson(`https://${protocolsIoHost}/api/v4/protocols/${encodeURIComponent(externalId)}`, { headers }) as { protocol?: unknown; payload?: unknown };
      return parseProtocol(payload.protocol ?? payload.payload ?? payload);
    },
  };
}

export function parseSearchItem(item: unknown): MethodHit[] {
  if (!item || typeof item !== 'object') return [];
  const record = item as Record<string, unknown>;
  const id = record.id ?? record.uri;
  if (id === undefined || id === null) return [];
  const creator = record.creator && typeof record.creator === 'object' ? (record.creator as { name?: unknown }).name : undefined;
  const published = typeof record.published_on === 'number' ? new Date(record.published_on * 1000).getFullYear() : undefined;
  return [{ key: `protocols_io:${id}`, source: 'protocols_io', externalId: String(id), title: plainTitle(textOf(record.title)) || `protocols.io #${id}`, authors: plainTitle(textOf(creator)) || undefined, year: published ? String(published) : undefined,
    venue: 'protocols.io', url: record.uri ? `https://${protocolsIoHost}/view/${textOf(record.uri)}` : record.doi ? `https://doi.org/${textOf(record.doi)}` : undefined, license: licenseOf(record), snippet: stripHtml(textOf(record.description)).slice(0, 240) || undefined }];
}

const licenseOf = (record: Record<string, unknown>) => {
  const license = record.license ?? record.cc_license;
  if (license && typeof license === 'object') return textOf((license as { name?: unknown }).name) || undefined;
  return textOf(license) || undefined;
};

/** Steps come as HTML in `step` (v3) or as components with HTML bodies (v4); either way one step is one section. */
export function parseProtocol(raw: unknown): MethodText {
  const record = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const title = plainTitle(textOf(record.title)) || 'protocols.io protocol';
  const steps = Array.isArray(record.steps) ? record.steps : [];
  const sections = steps.flatMap((step, index) => {
    if (!step || typeof step !== 'object') return [];
    const item = step as Record<string, unknown>;
    const parts: string[] = [];
    if (typeof item.step === 'string') parts.push(item.step);
    for (const component of Array.isArray(item.components) ? item.components : []) {
      const source = component && typeof component === 'object' ? (component as { source?: unknown }).source : undefined;
      if (!source || typeof source !== 'object') continue;
      const body = source as Record<string, unknown>;
      for (const field of ['body', 'description', 'name', 'title']) if (typeof body[field] === 'string') parts.push(body[field] as string);
    }
    const body = stripHtml(parts.join('\n'));
    return body ? [{ title: textOf(item.title) || `Step ${index + 1}`, text: body }] : [];
  });
  const description = stripHtml(textOf(record.description));
  const materials = stripHtml(textOf(record.materials_text ?? record.materials));
  const head = [description ? { title: 'Description', text: description } : undefined, materials ? { title: 'Materials', text: materials } : undefined].filter((section): section is { title: string; text: string } => Boolean(section));
  const all = [...head, ...sections];
  return { title, sections: all, text: joinSections(all), license: licenseOf(record), url: record.uri ? `https://${protocolsIoHost}/view/${textOf(record.uri)}` : undefined, fetchedAt: new Date().toISOString() };
}
