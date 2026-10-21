import { beforeEach, describe, expect, it, vi } from 'vitest';

const database = vi.hoisted(() => ({
  prisma: {
    attachmentLink: { findMany: vi.fn(), findFirst: vi.fn() },
    inventoryItem: { findMany: vi.fn() },
    aISettings: { findUnique: vi.fn() },
    methodSearchSettings: { findUnique: vi.fn(), upsert: vi.fn() },
    activityLog: { create: vi.fn() },
  },
}));
vi.mock('./db', () => database);
vi.mock('./ai-crypto', () => ({ encryptSecret: (value: string) => `v1:${value}`, decryptSecret: (value: string) => value.replace(/^v1:/, '') }));

import { defaultManualVendors } from './product-manuals';
import { fetchVendorPdf, manualFileName, searchProductManuals } from './product-manuals.server';

const pdf = new Uint8Array([...new TextEncoder().encode('%PDF-1.7\n'), 1, 2, 3]);
const answer = (body: BodyInit | null, init: ResponseInit = {}) => new Response(body, init);

describe('Downloading a manual from a vendor', () => {
  it('takes a PDF from a listed vendor and follows a redirect that stays on the list', async () => {
    const seen: string[] = [];
    const fetchImpl = (async (input: RequestInfo | URL) => {
      seen.push(String(input));
      return seen.length === 1 ? answer(null, { status: 302, headers: { location: 'https://assets.thermofisher.com/m.pdf' } }) : answer(pdf, { status: 200, headers: { 'content-type': 'application/pdf' } });
    }) as typeof fetch;
    const result = await fetchVendorPdf('https://www.thermofisher.com/m', defaultManualVendors, fetchImpl);
    expect(result.url).toBe('https://assets.thermofisher.com/m.pdf');
    expect(result.bytes.length).toBe(pdf.length);
    expect(seen).toHaveLength(2);
  });

  it('refuses a link off the list, a plain http link, a redirect off the list and a file that is not a PDF', async () => {
    const never = (async () => { throw new Error('must not be called'); }) as typeof fetch;
    await expect(fetchVendorPdf('https://blog.example.com/a.pdf', defaultManualVendors, never)).rejects.toThrow(/not on a vendor site/);
    await expect(fetchVendorPdf('http://www.qiagen.com/a.pdf', defaultManualVendors, never)).rejects.toThrow(/not on a vendor site/);
    const away = (async () => answer(null, { status: 302, headers: { location: 'https://files.example.com/a.pdf' } })) as typeof fetch;
    await expect(fetchVendorPdf('https://www.qiagen.com/a.pdf', defaultManualVendors, away)).rejects.toThrow(/not on a vendor site/);
    const page = (async () => answer('<html></html>', { status: 200 })) as typeof fetch;
    await expect(fetchVendorPdf('https://www.qiagen.com/a.pdf', defaultManualVendors, page)).rejects.toThrow(/did not give a PDF/);
    const loop = (async () => answer(null, { status: 302, headers: { location: 'https://www.qiagen.com/a.pdf' } })) as typeof fetch;
    await expect(fetchVendorPdf('https://www.qiagen.com/a.pdf', defaultManualVendors, loop)).rejects.toThrow(/Too many redirects/);
  });

  it('names the file after the last part of its link', () => {
    expect(manualFileName('https://assets.thermofisher.com/TFS-Assets/LSG/manuals/MAN0000.pdf?x=1', 'x')).toBe('MAN0000.pdf');
    expect(manualFileName('https://www.qiagen.com/', 'RNeasy Mini')).toBe('RNeasy Mini.pdf');
  });
});

describe('Searching for the manual of a product', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    database.prisma.attachmentLink.findMany.mockResolvedValue([{ targetId: 'item-1', attachmentId: 'att-1', attachment: { originalFilename: 'RNeasy_handbook.pdf' } }]);
    database.prisma.inventoryItem.findMany.mockResolvedValue([{ id: 'item-1', name: 'RNeasy Mini Kit', vendor: 'Qiagen', brand: null, catalogNumber: '74104' }]);
    database.prisma.methodSearchSettings.findUnique.mockResolvedValue({ webSearchKeyEncrypted: 'v1:tvly-key', manualVendorsJson: null });
  });

  it('finds the manual kept on an inventory item, and says so when AI is off and the web was not searched', async () => {
    database.prisma.aISettings.findUnique.mockResolvedValue({ enabled: false });
    const result = await searchProductManuals('rneasy');
    expect(result.hits).toEqual([expect.objectContaining({ key: 'inventory:att-1', source: 'inventory', title: 'RNeasy_handbook.pdf', vendor: 'Qiagen', isPdf: true, inventoryItem: { id: 'item-1', name: 'RNeasy Mini Kit', catalogNumber: '74104' } })]);
    expect(result.note).toMatch(/AI is off/);
  });

  it('asks the web only on listed vendors, once, and adds what it finds after the inventory', async () => {
    database.prisma.aISettings.findUnique.mockResolvedValue({ enabled: true });
    const calls: { url: string; body: Record<string, unknown>; auth: string }[] = [];
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), body: JSON.parse(String(init?.body)), auth: String((init?.headers as Record<string, string>).authorization) });
      return answer(JSON.stringify({ results: [{ title: 'RNeasy Handbook', url: 'https://www.qiagen.com/HB-0435.pdf', content: 'Handbook' }, { title: 'Other', url: 'https://example.com/x.pdf' }] }), { status: 200 });
    }) as typeof fetch;
    const result = await searchProductManuals('RNeasy Mini', fetchImpl);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.tavily.com/search');
    expect(calls[0].auth).toBe('Bearer tvly-key');
    expect(calls[0].body).toMatchObject({ query: 'RNeasy Mini 说明书 manual instructions pdf', include_domains: [...defaultManualVendors], max_results: 10 });
    expect(result.hits.map(hit => hit.key)).toEqual(['inventory:att-1', 'web:https://www.qiagen.com/HB-0435.pdf']);
    expect(database.prisma.activityLog.create).toHaveBeenCalledTimes(1);
  });

  it('keeps the inventory result when the web search fails, and refuses a query that is too short', async () => {
    database.prisma.aISettings.findUnique.mockResolvedValue({ enabled: true });
    const broken = (async () => answer('nope', { status: 500 })) as typeof fetch;
    const result = await searchProductManuals('rneasy', broken);
    expect(result.hits).toHaveLength(1);
    expect(result.note).toMatch(/Web search failed: The search service answered 500/);
    await expect(searchProductManuals(' a ')).rejects.toThrow(/product name/);
  });
});
