import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('node:fs', () => ({ existsSync: vi.fn() }));
vi.mock('node:fs/promises', () => ({ readFile: vi.fn() }));
vi.mock('node:os', () => ({ networkInterfaces: vi.fn() }));
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { GET } from './route';
afterEach(() => { vi.unstubAllEnvs(); vi.resetAllMocks(); });
describe('LAN discovery endpoint', () => {
  it('reads fresh host addresses in Docker and disables caching', async () => {
    vi.stubEnv('LABNEST_NETWORK_FILE', '/host-network/addresses.json');
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({ updatedAt: Date.now(), addresses: ['192.168.0.106'] }));
    const response = await GET();
    expect(await response.json()).toEqual({ addresses: ['192.168.0.106'] });
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(networkInterfaces).not.toHaveBeenCalled();
  });
  it('never falls back to container interfaces when host discovery fails', async () => {
    vi.stubEnv('LABNEST_NETWORK_FILE', '/missing');
    vi.mocked(readFile).mockRejectedValue(new Error('missing'));
    expect(await (await GET()).json()).toEqual({ addresses: [] });
    expect(networkInterfaces).not.toHaveBeenCalled();
    vi.stubEnv('LABNEST_NETWORK_FILE', '');
    vi.mocked(existsSync).mockReturnValue(true);
    expect(await (await GET()).json()).toEqual({ addresses: [] });
    expect(networkInterfaces).not.toHaveBeenCalled();
  });
  it('discovers the native host on each request', async () => {
    vi.stubEnv('LABNEST_NETWORK_FILE', '');
    vi.mocked(existsSync).mockReturnValue(false);
    vi.mocked(networkInterfaces).mockReturnValue({});
    expect(await (await GET()).json()).toEqual({ addresses: [] });
    expect(networkInterfaces).toHaveBeenCalledOnce();
  });
});
