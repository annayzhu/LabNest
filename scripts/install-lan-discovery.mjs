import { homedir } from 'node:os';
import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

if (process.platform !== 'darwin') throw new Error('On Linux, run npm run network:watch as a persistent host service before starting Docker.');
const root = fileURLToPath(new URL('../', import.meta.url));
const service = join(homedir(), '.labnest/network-service');
const state = process.env.LABNEST_NETWORK_DIR || join(homedir(), '.labnest/network');
const agents = join(homedir(), 'Library/LaunchAgents');
await Promise.all([mkdir(join(service, 'scripts'), { recursive: true }), mkdir(join(service, 'src/lib'), { recursive: true }), mkdir(state, { recursive: true }), mkdir(agents, { recursive: true })]);
await copyFile(join(root, 'scripts/watch-lan-addresses.mjs'), join(service, 'scripts/watch-lan-addresses.mjs'));
await copyFile(join(root, 'src/lib/lan-addresses.mjs'), join(service, 'src/lib/lan-addresses.mjs'));
const label = 'com.labnest.lan-discovery';
const plist = join(agents, `${label}.plist`);
const xml = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
await writeFile(plist, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${label}</string>
<key>ProgramArguments</key><array><string>${xml(process.execPath)}</string><string>${xml(join(service, 'scripts/watch-lan-addresses.mjs'))}</string></array>
<key>EnvironmentVariables</key><dict><key>LABNEST_NETWORK_DIR</key><string>${xml(state)}</string></dict>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
<key>StandardErrorPath</key><string>${xml(join(state, 'service.log'))}</string>
</dict></plist>`);
const domain = `gui/${process.getuid()}`;
try { execFileSync('launchctl', ['bootout', `${domain}/${label}`], { stdio: 'ignore' }); } catch { /* First installation. */ }
execFileSync('launchctl', ['bootstrap', domain, plist]);
console.log('LabNest automatic LAN discovery installed; refreshes every 5 seconds and starts at login.');
