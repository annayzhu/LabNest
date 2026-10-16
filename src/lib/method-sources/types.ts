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
  return html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<br\s*\/?>|<\/p>|<\/div>|<\/li>|<\/h\d>/gi, '\n').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
}
