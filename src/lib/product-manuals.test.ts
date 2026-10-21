import { describe, expect, it } from 'vitest';
import { defaultManualVendors, isPublicHttpsUrl, manualHitsFromWeb, manualSearchQuery, normalizeVendorDomains, vendorOf } from './product-manuals';

describe('Finding the instructions of a product', () => {
  it('reads a typed list of vendor sites as clean domains', () => {
    expect(normalizeVendorDomains('https://www.Vazyme.com/products, qiagen.com\nhttp://assets.thermofisher.com/TFS-Assets/LSG/manuals/x.pdf\nnot a domain\nqiagen.com'))
      .toEqual(['vazyme.com', 'qiagen.com', 'assets.thermofisher.com']);
    expect(normalizeVendorDomains('')).toEqual([]);
  });

  it('matches a host to a listed vendor, itself or any site under it, and nothing that only ends alike', () => {
    expect(vendorOf('assets.thermofisher.com', defaultManualVendors)).toBe('thermofisher.com');
    expect(vendorOf('thermofisher.com', defaultManualVendors)).toBe('thermofisher.com');
    expect(vendorOf('evilthermofisher.com', defaultManualVendors)).toBeUndefined();
    expect(vendorOf('thermofisher.com.evil.example', defaultManualVendors)).toBeUndefined();
  });

  it('allows only https links to named hosts', () => {
    expect(isPublicHttpsUrl('https://www.qiagen.com/a.pdf')).toBe(true);
    for (const bad of ['http://www.qiagen.com/a.pdf', 'https://127.0.0.1/a.pdf', 'https://localhost/a.pdf', 'https://user:pw@www.qiagen.com/a.pdf', 'https://10.0.0.1/a', 'ftp://x.qiagen.com/a', 'not a url', 'https://intranet.local/a.pdf'])
      expect(isPublicHttpsUrl(bad), bad).toBe(false);
  });

  it('keeps only hits on listed vendors, PDFs first, titles as plain text', () => {
    const hits = manualHitsFromWeb([
      { title: 'Kit page', url: 'https://www.qiagen.com/us/products/rneasy-mini-kit', content: 'The RNeasy kit' },
      { title: 'Elsewhere', url: 'https://blog.example.com/rneasy.pdf', content: 'copy' },
      { title: '<b>RNeasy</b> Handbook', url: 'https://www.qiagen.com/HB-0435-rneasy.pdf', content: 'Protocol   details' },
      { title: 'Plain http', url: 'http://www.qiagen.com/x.pdf' },
    ], defaultManualVendors);
    expect(hits.map(hit => [hit.title, hit.vendor, hit.isPdf])).toEqual([['RNeasy Handbook', 'qiagen.com', true], ['Kit page', 'qiagen.com', false]]);
    expect(hits[0].snippet).toBe('Protocol details');
  });

  it('asks the search engine for the instructions, not just the product', () => {
    expect(manualSearchQuery(' RNeasy Mini 74104 ')).toBe('RNeasy Mini 74104 说明书 manual instructions pdf');
  });
});
