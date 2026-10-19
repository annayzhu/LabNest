/** Where a method can be looked up: the group's own Protocols always; protocols.io and Europe PMC when switched on. */
export const methodSourceIds = ['local', 'protocols_io', 'europe_pmc'] as const;
export type MethodSourceId = typeof methodSourceIds[number];
/** A hit's origin: a searched source, or text the user pasted from a site without an API (JoVE, Bio-protocol, a PDF). */
export type MethodHitSource = MethodSourceId | 'manual';
export const methodSourceLabels: Record<MethodHitSource, string> = { local: '课题组规程库', protocols_io: 'protocols.io', europe_pmc: 'Europe PMC（开放获取全文）', manual: '粘贴的原文' };

/** One search result. `key` is stable across reloads: "<source>:<externalId>". */
export type MethodHit = {
  key: string; source: MethodHitSource; externalId: string;
  title: string; authors?: string; year?: string; venue?: string; url?: string; license?: string; snippet?: string;
  /** Set once the text was fetched and kept as an attachment of the design session. */
  attachmentId?: string; fetchedAt?: string; textChars?: number; fetchError?: string;
};

/** A method's text as fetched: whole, and by section when the source has sections. */
export type MethodText = { title: string; text: string; sections: Array<{ title: string; text: string }>; license?: string; url?: string; fetchedAt: string };

export type MethodSourceAdapter = {
  id: MethodSourceId;
  search(query: string): Promise<MethodHit[]>;
  fetch(externalId: string): Promise<MethodText>;
};

/** A field from an outside API as text: anything that is not a string reads as empty. */
export const textOf = (value: unknown) => typeof value === 'string' ? value : '';

/** A method's sections as one text, each under its title. */
export const joinSections = (sections: MethodText['sections']) => sections.map(section => `${section.title}\n${section.text}`).join('\n\n');

/** Tags and entities out, whitespace folded: the text a reader and the quote check see. */
export function stripHtml(html: string) {
  return decodeEntities(html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<br\s*\/?>|<\/p>|<\/div>|<\/li>|<\/h\d>/gi, '\n').replace(/<[^>]+>/g, ' '))
    .replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
}

/** The named entities outside APIs put in titles and text; numeric ones are decoded whatever they are. No-break spaces read as spaces. */
const namedEntities: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ensp: ' ', emsp: ' ', thinsp: ' ',
  ndash: '–', mdash: '—', minus: '−', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', hellip: '…', bull: '•', middot: '·',
  deg: '°', micro: 'µ', plusmn: '±', times: '×', le: '≤', ge: '≥', asymp: '≈', prime: '′', copy: '©', reg: '®', trade: '™',
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', kappa: 'κ', lambda: 'λ', mu: 'μ', pi: 'π', sigma: 'σ', tau: 'τ', phi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
  Delta: 'Δ', Sigma: 'Σ', Omega: 'Ω', auml: 'ä', ouml: 'ö', uuml: 'ü', szlig: 'ß', eacute: 'é', egrave: 'è', aacute: 'á', oacute: 'ó', iacute: 'í', ntilde: 'ñ', ccedil: 'ç',
};

/** `&lt;i&gt;`, `&#946;`, `&#x3B2;`, `&beta;` as the characters they stand for, in one pass; an unknown entity stays as written. */
export function decodeEntities(text: string) {
  return text.replace(/&(?:#(\d{1,7})|#[xX]([0-9a-fA-F]{1,6})|([A-Za-z][A-Za-z0-9]{1,31}));/g, (entity, decimal: string | undefined, hex: string | undefined, name: string | undefined) => {
    if (name) return namedEntities[name] ?? namedEntities[name.toLowerCase()] ?? entity;
    const code = decimal ? Number(decimal) : parseInt(hex ?? '', 16);
    return code > 0 && code <= 0x10ffff && (code < 0xd800 || code > 0xdfff) ? String.fromCodePoint(code) : entity;
  });
}

/**
 * A title from an outside source as plain text: "&lt;i&gt;Enterococcus&lt;/i&gt; faecalis" and "<i>Enterococcus</i> faecalis"
 * both read "Enterococcus faecalis". Entities are decoded first (twice at most, for double-escaped feeds), then markup goes:
 * inline tags with nothing in their place ("Ca<sup>2+</sup>" → "Ca2+"), line breaks as a space. Only something shaped like a
 * tag is removed, so "p < 0.05" stays. The result is text, never markup.
 */
export function plainTitle(text: string) {
  let plain = text;
  for (let pass = 0; pass < 2; pass += 1) {
    const decoded = decodeEntities(plain);
    if (decoded === plain) break;
    plain = decoded;
  }
  return plain.replace(/<(?:br|\/?(?:p|div|li))\b[^<>]*>/gi, ' ').replace(/<\/?[A-Za-z][\w:.-]*(?:\s[^<>]*)?\/?>/g, '').replace(/\s+/g, ' ').trim();
}

/** An outside hit's title, authors and journal as plain text, also for sessions saved before titles were cleaned. Pasted and the group's own titles are the user's words and stay as typed. */
export function plainHit(hit: MethodHit): MethodHit {
  if (hit.source !== 'europe_pmc' && hit.source !== 'protocols_io') return hit;
  return { ...hit, title: plainTitle(hit.title) || hit.externalId, ...(hit.authors ? { authors: plainTitle(hit.authors) } : {}), ...(hit.venue ? { venue: plainTitle(hit.venue) } : {}) };
}
