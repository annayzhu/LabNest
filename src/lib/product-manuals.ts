/**
 * 产品说明书: finding the instructions of a kit or reagent, from the group's own inventory first and then from the
 * vendors' own sites. Only the vendors on the list are ever searched or downloaded from.
 */
export type ManualHit = {
  /** Stable across reloads: "inventory:<attachmentId>" or "web:<url>". */
  key: string;
  source: 'inventory' | 'web';
  title: string;
  vendor?: string;
  url?: string;
  snippet?: string;
  /** Only a PDF can be taken straight into 整理说明书; a page has to be saved as PDF and uploaded. */
  isPdf: boolean;
  attachmentId?: string;
  inventoryItem?: { id: string; name: string; catalogNumber?: string };
};

/** The vendors searched unless the list is changed. Domains cover the vendors' document hosts; the list is the user's to edit. */
export const defaultManualVendors = [
  'thermofisher.com', 'sigmaaldrich.com', 'merckmillipore.com', 'qiagen.com', 'takarabio.com', 'takarabiomed.com.cn',
  'promega.com', 'promega.com.cn', 'neb.com', 'neb.cn', 'bio-rad.com', 'abcam.com', 'abcam.cn',
  'vazyme.com', 'beyotime.com', 'yeasen.com', 'transgen.com.cn', 'transgenbiotech.com', 'solarbio.com',
] as const;
export const MAX_MANUAL_VENDORS = 60;

const domainPattern = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

/** A list of vendor sites as typed (one per line or comma-separated, with or without https:// and www.) as clean domains. */
export function normalizeVendorDomains(text: string) {
  const domains = text.split(/[\s,;，；]+/).map(entry => entry.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[/?#].*$/, '').replace(/:\d+$/, ''))
    .filter(entry => domainPattern.test(entry));
  return [...new Set(domains)].slice(0, MAX_MANUAL_VENDORS);
}

/** The listed domain a host belongs to: the domain itself or any site under it. */
export const vendorOf = (host: string, vendors: readonly string[]) => vendors.find(domain => host === domain || host.endsWith(`.${domain}`));

/** Whether a link may be fetched at all: https, a name rather than an address, never the machine itself. */
export function isPublicHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return false;
    const host = url.hostname.toLowerCase();
    return host.includes('.') && !/^[\d.]+$/.test(host) && !host.startsWith('[') && !/(^|\.)(localhost|local|internal|test)$/.test(host);
  } catch { return false; }
}

/** A link that ends in .pdf, or goes through a vendor's document service (Thermo Fisher serves PDFs from /document-connect/). */
export const looksLikePdf = (url: string) => /\.pdf(?:$|[?#])/i.test(url) || /\/(?:document-connect|pdf)\//i.test(url);

type WebResult = { title?: unknown; url?: unknown; content?: unknown };

/** Web search results as hits: only those on a listed vendor's site, PDFs first; a title is plain text, never markup. */
export function manualHitsFromWeb(results: WebResult[], vendors: readonly string[]): ManualHit[] {
  const hits: ManualHit[] = [];
  for (const result of results) {
    const url = typeof result.url === 'string' ? result.url : '';
    if (!isPublicHttpsUrl(url)) continue;
    const vendor = vendorOf(new URL(url).hostname.toLowerCase(), vendors);
    if (!vendor) continue;
    const title = (typeof result.title === 'string' ? result.title : '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() || url;
    const snippet = (typeof result.content === 'string' ? result.content : '').replace(/\s+/g, ' ').trim();
    hits.push({ key: `web:${url}`, source: 'web', title: title.slice(0, 200), vendor, url, ...(snippet ? { snippet: snippet.length > 240 ? `${snippet.slice(0, 240)}…` : snippet } : {}), isPdf: looksLikePdf(url) });
  }
  return hits.sort((left, right) => Number(right.isPdf) - Number(left.isPdf));
}

/** What to ask a search engine: the product as typed plus the words that find its instructions. */
export const manualSearchQuery = (query: string) => `${query.trim()} 说明书 manual instructions pdf`;
