import { decryptSecret, encryptSecret } from '../ai-crypto';
import { prisma } from '../db';
import { europePmcAdapter, europePmcHost } from './europe-pmc';
import { localAdapter } from './local.server';
import { protocolsIoAdapter, protocolsIoHost } from './protocols-io';
import { methodSourceIds, type MethodHit, type MethodSourceAdapter, type MethodSourceId } from './types';

/** Only these hosts are ever contacted, and only when the user searches or fetches. */
/** Browser checks may point Europe PMC at a local stand-in; a production build never does. */
export const europePmcBase = process.env.NODE_ENV !== 'production' && process.env.LABNEST_EUROPE_PMC_BASE ? process.env.LABNEST_EUROPE_PMC_BASE : `https://${europePmcHost}`;
const allowedHosts = new Set([protocolsIoHost, europePmcHost, new URL(europePmcBase).hostname]);
const timeoutMs = 15_000, maxBytes = 2_000_000;

export async function fetchLimited(url: string, init?: RequestInit) {
  const host = new URL(url).hostname;
  if (!allowedHosts.has(host)) throw new Error(`Address not on the allow list: ${host}`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, headers: { 'User-Agent': 'LabNest method search (self-hosted lab notebook)', ...(init?.headers as Record<string, string> | undefined) } });
    if (!response.ok) throw new Error(`${host} returned ${response.status}`);
    const length = Number(response.headers.get('content-length') ?? 0);
    if (length > maxBytes) throw new Error('Response too large; abandoned');
    const body = await response.text();
    if (body.length > maxBytes) throw new Error('Response too large; abandoned');
    return body;
  } finally { clearTimeout(timer); }
}
const fetchJson = async (url: string, init?: RequestInit) => JSON.parse(await fetchLimited(url, init)) as unknown;

export type MethodSearchSettingsView = { enabled: boolean; sources: MethodSourceId[]; hasProtocolsIoToken: boolean; revision: string };

export async function readMethodSearchSettings(): Promise<MethodSearchSettingsView> {
  const row = await prisma.methodSearchSettings.findUnique({ where: { id: 'default' } });
  const sources = (Array.isArray(row?.sourcesJson) ? row!.sourcesJson : ['local']).filter((id): id is MethodSourceId => methodSourceIds.includes(id as MethodSourceId));
  return { enabled: row?.enabled ?? false, sources: sources.includes('local') ? sources : ['local', ...sources], hasProtocolsIoToken: Boolean(row?.protocolsIoTokenEncrypted), revision: row?.updatedAt.toISOString() ?? 'unset' };
}

export async function writeMethodSearchSettings(change: { enabled: boolean; sources: MethodSourceId[]; protocolsIoToken?: string; clearProtocolsIoToken?: boolean }) {
  const sources = [...new Set(['local' as MethodSourceId, ...change.sources.filter(id => methodSourceIds.includes(id))])];
  const token = change.clearProtocolsIoToken ? null : change.protocolsIoToken?.trim() ? encryptSecret(change.protocolsIoToken.trim()) : undefined;
  await prisma.methodSearchSettings.upsert({ where: { id: 'default' }, create: { id: 'default', enabled: change.enabled, sourcesJson: sources, protocolsIoTokenEncrypted: token ?? null }, update: { enabled: change.enabled, sourcesJson: sources, ...(token !== undefined ? { protocolsIoTokenEncrypted: token } : {}) } });
  return readMethodSearchSettings();
}

/** The adapters the settings allow right now; external ones only when 外部方法检索 is on. */
export async function enabledAdapters(): Promise<MethodSourceAdapter[]> {
  const settings = await prisma.methodSearchSettings.findUnique({ where: { id: 'default' } });
  const adapters: MethodSourceAdapter[] = [localAdapter];
  if (!settings?.enabled) return adapters;
  const sources = Array.isArray(settings.sourcesJson) ? settings.sourcesJson : [];
  if (sources.includes('protocols_io') && settings.protocolsIoTokenEncrypted) adapters.push(protocolsIoAdapter(fetchJson, decryptSecret(settings.protocolsIoTokenEncrypted)));
  if (sources.includes('europe_pmc')) adapters.push(europePmcAdapter(fetchLimited));
  return adapters;
}

/** Searches every enabled source, logs each outside request, and keeps going when one source fails. */
export async function searchMethods(sessionId: string, query: string): Promise<{ hits: MethodHit[]; errors: string[]; failed: MethodSourceId[] }> {
  const adapters = await enabledAdapters();
  const hits: MethodHit[] = [], errors: string[] = [], failed: MethodSourceId[] = [];
  for (const adapter of adapters) {
    try {
      const found = await adapter.search(query);
      hits.push(...found);
      if (adapter.id !== 'local') await prisma.activityLog.create({ data: { action: 'method_search', targetType: 'method_design_session', targetId: sessionId, metadataJson: { source: adapter.id, query, results: found.length } } });
    } catch (error) {
      failed.push(adapter.id);
      errors.push(`${adapter.id}: ${error instanceof Error ? error.message : 'Search failed'}`);
      if (adapter.id !== 'local') await prisma.activityLog.create({ data: { action: 'method_search_failed', targetType: 'method_design_session', targetId: sessionId, metadataJson: { source: adapter.id, query, error: String(error instanceof Error ? error.message : error) } } });
    }
  }
  return { hits, errors, failed };
}

export async function fetchMethodText(sessionId: string, hit: Pick<MethodHit, 'source' | 'externalId'>) {
  if (hit.source === 'manual') throw new Error('Pasted text has no source to fetch');
  const adapter = (await enabledAdapters()).find(item => item.id === hit.source);
  if (!adapter) throw new Error('This source is not turned on now');
  const text = await adapter.fetch(hit.externalId);
  if (hit.source !== 'local') await prisma.activityLog.create({ data: { action: 'method_fetch', targetType: 'method_design_session', targetId: sessionId, metadataJson: { source: hit.source, externalId: hit.externalId, chars: text.text.length, license: text.license ?? null } } });
  return text;
}
