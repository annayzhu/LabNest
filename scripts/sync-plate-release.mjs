// Import a verified independent release without maintaining another copy of app logic.
import { readFile, writeFile, copyFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';

const source = resolve(process.argv[2] || '');
if (!process.argv[2]) throw new Error('Provide the independent release directory');
const target = resolve('public/tools/free-plate-layout');
const manifest = JSON.parse(await readFile(resolve(source, 'release.json'), 'utf8'));
// Check the entire release before replacing any installed runtime asset.
for (const [file, expected] of Object.entries(manifest.files)) {
  if (resolve(source, file) !== `${source}/${file}` || file.includes('..')) throw new Error('Invalid release path');
  const bytes = await readFile(resolve(source, file));
  if (createHash('sha256').update(bytes).digest('hex') !== expected) throw new Error(`Release hash mismatch: ${file}`);
}
for (const file of Object.keys(manifest.files)) {
  await mkdir(dirname(resolve(target, file)), { recursive: true });
  await copyFile(resolve(source, file), resolve(target, file));
}
const insertion = '<link rel="stylesheet" href="labnest-bridge.css?v=20261009">\n<script src="calculator-engine.js?v=20261009"></script>\n<script src="labnest-bridge.js?v=20261009"></script>';
const html = await readFile(resolve(target, 'index.html'), 'utf8');
if (!html.includes('<!-- host-integration -->')) throw new Error('Release has no host integration seam');
await writeFile(resolve(target, 'index.html'), html.replace('<!-- host-integration -->', `<!-- host-integration -->${insertion}`));
await writeFile(resolve(target, 'release.json'), JSON.stringify({ ...manifest, hostInsertion: insertion }, null, 2) + '\n');
console.log(`Synced ${Object.keys(manifest.files).length} files from ${manifest.commit}`);
