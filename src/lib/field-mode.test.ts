import { describe, expect, it } from 'vitest';
import { fieldRunUrl, isLocalHost, lanOrigin, watchPairingLink } from './field-mode';

describe('现场模式 addresses for other devices', () => {
  it('treats the computer\'s own names as unreachable from a tablet, phone or watch', () => {
    for (const host of ['localhost', '127.0.0.1', '0.0.0.0', '[::1]', 'labnest.localhost']) expect(isLocalHost(host)).toBe(true);
    for (const host of ['192.168.0.102', 'lab-mac.local', 'labnest.example.org']) expect(isLocalHost(host)).toBe(false);
  });

  it('accepts a LAN address with or without the scheme and keeps only the origin', () => {
    expect(lanOrigin('192.168.0.102:3001')).toBe('http://192.168.0.102:3001');
    expect(lanOrigin(' http://192.168.0.102:3001/protocol-run ')).toBe('http://192.168.0.102:3001');
    expect(lanOrigin('https://lab-mac.local')).toBe('https://lab-mac.local');
  });

  it('refuses addresses other devices could not open', () => {
    for (const input of ['', 'localhost:3001', 'http://127.0.0.1:3001', 'ftp://192.168.0.102', 'http://', 'not a url']) expect(lanOrigin(input)).toBeUndefined();
  });

  it('opens the experiment run laid out for the bench', () => {
    expect(fieldRunUrl('http://192.168.0.102:3001', 'cmv123')).toBe('http://192.168.0.102:3001/experiments/cmv123/run?view=bench');
  });

  it('hands the iPhone only a normalized server and a one-use code', () => {
    const link = new URL(watchPairingLink('http://192.168.1.10:3001/experiments/x', ' 0 1 2 3 ')!);
    expect(link.protocol).toBe('labnest:');
    expect(link.hostname).toBe('watch-pair');
    expect([...link.searchParams]).toEqual([['server', 'http://192.168.1.10:3001'], ['code', '0123']]);
    expect(new URL(watchPairingLink('https://lab.example', '0000')!).searchParams.get('code')).toBe('0000');
  });

  it('does not produce a handoff for invalid codes, loopback or embedded credentials', () => {
    for (const origin of ['http://localhost:3001', 'http://user:secret@192.168.1.10', 'javascript:alert(1)']) expect(watchPairingLink(origin, '0123')).toBeUndefined();
    for (const code of ['', '123', '12345', 'A123', '１２３４', 'A1B2C3D4E5F6']) expect(watchPairingLink('https://lab.example', code)).toBeUndefined();
  });
});
