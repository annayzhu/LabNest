import { readFile } from 'node:fs/promises';
import { decryptSecret, encryptSecret } from './ai-crypto';
import { resolveAttachmentPath } from './attachments';
import { MAX_ATTACHMENT_BYTES } from './attachment-limits';
import { prisma } from './db';
import { defaultManualVendors, isPublicHttpsUrl, manualHitsFromWeb, manualSearchQuery, normalizeVendorDomains, vendorOf, type ManualHit } from './product-manuals';

type FetchLike = typeof fetch;
const SEARCH_URL = 'https://api.tavily.com/search';
/** Browser checks point the search at a local stand-in; a production build always asks the real service. */
const searchUrl = () => process.env.NODE_ENV !== 'production' && process.env.LABNEST_MANUAL_SEARCH_URL ? process.env.LABNEST_MANUAL_SEARCH_URL : SEARCH_URL;
const MAX_REDIRECTS = 4;
const TIMEOUT_MS = 30_000;

export type ProductSearchSettingsView = { hasKey: boolean; vendors: string[]; isDefaultList: boolean };

export async function readProductSearchSettings(): Promise<ProductSearchSettingsView> {
  const row = await prisma.methodSearchSettings.findUnique({ where: { id: 'default' } });
  const saved = Array.isArray(row?.manualVendorsJson) ? normalizeVendorDomains((row!.manualVendorsJson as unknown[]).filter((entry): entry is string => typeof entry === 'string').join('\n')) : [];
  return { hasKey: Boolean(row?.webSearchKeyEncrypted), vendors: saved.length ? saved : [...defaultManualVendors], isDefaultList: !saved.length };
}

/** The key (kept encrypted) and the vendor list; an empty list goes back to the default one, an empty key keeps the saved one. */
export async function writeProductSearchSettings(change: { key?: string; clearKey?: boolean; vendors?: string }) {
  const key = change.clearKey ? null : change.key?.trim() ? encryptSecret(change.key.trim()) : undefined;
  const vendors = change.vendors === undefined ? undefined : normalizeVendorDomains(change.vendors);
  const data = { ...(key !== undefined ? { webSearchKeyEncrypted: key } : {}), ...(vendors !== undefined ? { manualVendorsJson: vendors } : {}) };
  await prisma.methodSearchSettings.upsert({ where: { id: 'default' }, create: { id: 'default', ...data }, update: data });
  return readProductSearchSettings();
}

/** Manuals the group has kept on its inventory items, matched on the item's name, brand, vendor or catalogue number. */
async function inventoryManuals(query: string): Promise<ManualHit[]> {
  const links = await prisma.attachmentLink.findMany({ where: { targetType: 'inventory_item', linkType: 'product_manual' }, include: { attachment: true }, take: 500 });
  if (!links.length) return [];
  const contains = { contains: query, mode: 'insensitive' as const };
  const items = await prisma.inventoryItem.findMany({
    where: { id: { in: [...new Set(links.map(link => link.targetId))] }, OR: [{ name: contains }, { englishName: contains }, { brand: contains }, { vendor: contains }, { catalogNumber: contains }, { casNumber: contains }] },
    select: { id: true, name: true, vendor: true, brand: true, catalogNumber: true }, take: 50,
  });
  const byId = new Map(items.map(item => [item.id, item]));
  return links.flatMap(link => {
    const item = byId.get(link.targetId);
    return item ? [{ key: `inventory:${link.attachmentId}`, source: 'inventory' as const, title: link.attachment.originalFilename, vendor: item.vendor ?? item.brand ?? undefined, isPdf: /\.pdf$/i.test(link.attachment.originalFilename), attachmentId: link.attachmentId,
      inventoryItem: { id: item.id, name: item.name, ...(item.catalogNumber ? { catalogNumber: item.catalogNumber } : {}) } }] : [];
  });
}

/** The web search: only with AI switched on and a key saved, only on the listed vendors, one request per search. */
async function webManuals(query: string, fetchImpl: FetchLike): Promise<{ hits: ManualHit[]; note?: string }> {
  const [ai, row, settings] = await Promise.all([prisma.aISettings.findUnique({ where: { id: 'default' } }), prisma.methodSearchSettings.findUnique({ where: { id: 'default' } }), readProductSearchSettings()]);
  if (!ai?.enabled) return { hits: [], note: 'AI is off, so only the manuals kept on inventory items were searched.' };
  if (!row?.webSearchKeyEncrypted) return { hits: [], note: 'No web search key is saved, so only the manuals kept on inventory items were searched.' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetchImpl(searchUrl(), {
      method: 'POST', signal: controller.signal,
      headers: { authorization: `Bearer ${decryptSecret(row.webSearchKeyEncrypted)}`, 'content-type': 'application/json' },
      body: JSON.stringify({ query: manualSearchQuery(query), include_domains: settings.vendors, max_results: 10, search_depth: 'basic' }),
    });
    if (!response.ok) throw new Error(`The search service answered ${response.status}`);
    const payload = await response.json() as { results?: unknown };
    const hits = manualHitsFromWeb(Array.isArray(payload.results) ? payload.results as { title?: unknown; url?: unknown; content?: unknown }[] : [], settings.vendors);
    await prisma.activityLog.create({ data: { action: 'product_manual_search', targetType: 'method_search_settings', targetId: 'default', metadataJson: { query: query.slice(0, 200), results: hits.length } } });
    return { hits };
  } catch (error) {
    throw new Error(`Web search failed: ${error instanceof Error ? error.message : 'unknown error'}`);
  } finally { clearTimeout(timer); }
}

/** Both sources, the group's own first; a failed web search does not hide what the inventory has. */
export async function searchProductManuals(query: string, fetchImpl: FetchLike = fetch) {
  const text = query.trim();
  if (text.length < 2) throw new Error('Write a product name, a catalogue number or a vendor');
  const inventory = await inventoryManuals(text);
  let web: ManualHit[] = [], note: string | undefined;
  try { ({ hits: web, note } = await webManuals(text, fetchImpl)); } catch (error) { note = error instanceof Error ? error.message : 'Web search failed'; }
  return { hits: [...inventory, ...web], note };
}

/** A PDF from a listed vendor's own site: https only, every redirect checked against the list, size and type checked. */
export async function fetchVendorPdf(url: string, vendors: readonly string[], fetchImpl: FetchLike = fetch) {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    if (!isPublicHttpsUrl(current) || !vendorOf(new URL(current).hostname.toLowerCase(), vendors)) throw new Error('The link is not on a vendor site in the list');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetchImpl(current, { redirect: 'manual', signal: controller.signal, headers: { 'user-agent': 'LabNest product manual (self-hosted lab notebook)', accept: 'application/pdf' } });
      if (response.status >= 300 && response.status < 400) {
        const next = response.headers.get('location');
        if (!next) throw new Error('The vendor site redirected without saying where');
        current = new URL(next, current).toString();
        continue;
      }
      if (!response.ok) throw new Error(`The vendor site answered ${response.status}`);
      if (Number(response.headers.get('content-length') ?? 0) > MAX_ATTACHMENT_BYTES) throw new Error('The file is larger than 25 MB');
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length > MAX_ATTACHMENT_BYTES) throw new Error('The file is larger than 25 MB');
      if (String.fromCharCode(...bytes.slice(0, 5)) !== '%PDF-') throw new Error('The link did not give a PDF');
      return { bytes, url: current };
    } finally { clearTimeout(timer); }
  }
  throw new Error('Too many redirects');
}

/** A manual kept on an inventory item, as a file ready to be read. */
export async function inventoryManualFile(attachmentId: string) {
  const link = await prisma.attachmentLink.findFirst({ where: { attachmentId, targetType: 'inventory_item', linkType: 'product_manual' }, include: { attachment: true } });
  if (!link) throw new Error('This manual is no longer on the inventory item');
  const bytes = await readFile(resolveAttachmentPath(link.attachment.storagePath));
  return new File([new Uint8Array(bytes)], link.attachment.originalFilename, { type: link.attachment.mimeType });
}

/** A file name for a downloaded manual: the last part of its link, else the vendor's name. */
export function manualFileName(url: string, fallback: string) {
  const last = decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).pop() ?? '').replace(/[^\w.\-()一-鿿 ]+/g, '_');
  const name = last || fallback.replace(/[^\w.\-()一-鿿 ]+/g, '_') || 'manual';
  return /\.pdf$/i.test(name) ? name : `${name}.pdf`;
}
