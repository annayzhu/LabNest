import { describe, expect, it } from 'vitest';
import { lanAddresses, freshLanAddresses, isLanIpv4 } from './lan-addresses.mjs';
import { lanPortOrigin } from './field-mode';

const ipv4 = (address: string, internal = false) => ({ family: 'IPv4', address, internal });
describe('current host LAN discovery', () => {
  it('ignores VPN, loopback, Docker and link-local addresses, including with an active VPN default route', () => {
    expect(lanAddresses({ lo0: [ipv4('127.0.0.1', true)], utun6: [ipv4('10.1.0.2')], docker0: [ipv4('172.17.0.1')], en0: [ipv4('192.168.0.106')], en1: [ipv4('169.254.1.2')], eth0: [ipv4('10.2.0.4')] })).toEqual(['192.168.0.106', '10.2.0.4']);
  });
  it('handles missing interfaces and excludes invalid, public and IPv6 addresses', () => {
    expect(lanAddresses({ en0: undefined })).toEqual([]);
    for (const address of ['192.168.0.999', '172.32.0.1', '8.8.8.8', '::1', undefined]) expect(isLanIpv4(address)).toBe(false);
    expect(isLanIpv4('172.31.1.2')).toBe(true);
  });
  it('does not reuse old network snapshots after disconnect or host-service failure', () => {
    expect(freshLanAddresses({ updatedAt: 1000, addresses: ['192.168.0.106'] }, 22000)).toEqual([]);
    expect(freshLanAddresses({ updatedAt: 22000, addresses: ['10.1.1.3', '127.0.0.1'] }, 23000)).toEqual(['10.1.1.3']);
    expect(freshLanAddresses({ updatedAt: 23000, addresses: [] }, 23001)).toEqual([]);
    expect(freshLanAddresses({ updatedAt: '23000', addresses: ['10.1.1.3'] }, 23001)).toEqual([]);
  });
  it('uses the published port, never the Docker internal port; blocks invalid drafts', () => {
    expect(lanPortOrigin('192.168.0.106', '3001')).toBe('http://192.168.0.106:3001');
    expect(lanPortOrigin('192.168.0.106', '3443', 'https:')).toBe('https://192.168.0.106:3443');
    for (const port of ['', '0', '65536', '3e3', '3001/path']) expect(lanPortOrigin('192.168.0.106', port)).toBeUndefined();
  });
});
