import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { freshLanAddresses, lanAddresses } from '@/lib/lan-addresses.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  let addresses: string[] = [];
  const snapshotPath = process.env.LABNEST_NETWORK_FILE;
  if (snapshotPath) {
    try { addresses = freshLanAddresses(JSON.parse(await readFile(snapshotPath, 'utf8'))); } catch { /* Host discovery is unavailable; do not substitute the container's address. */ }
  } else if (!existsSync('/.dockerenv')) {
    addresses = lanAddresses(networkInterfaces());
  }
  return Response.json({ addresses }, { headers: { 'Cache-Control': 'no-store' } });
}
