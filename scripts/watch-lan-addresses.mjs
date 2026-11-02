import { networkInterfaces, homedir } from 'node:os';
import { mkdir, writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { lanAddresses } from '../src/lib/lan-addresses.mjs';

const directory = process.env.LABNEST_NETWORK_DIR || join(homedir(), '.labnest/network');
await mkdir(directory, { recursive: true });
async function refresh() {
  // Atomic replacement prevents a container reading half a JSON document.
  const temporary = join(directory, 'addresses.json.tmp');
  await writeFile(temporary, JSON.stringify({ updatedAt: Date.now(), addresses: lanAddresses(networkInterfaces()) }));
  await rename(temporary, join(directory, 'addresses.json'));
}
await refresh();
setInterval(() => { refresh().catch(error => { console.error(error.message); process.exit(1); }); }, 5000);
