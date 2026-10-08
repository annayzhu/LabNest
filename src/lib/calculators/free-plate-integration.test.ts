import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

const root = resolve('public/tools/free-plate-layout');
const read = (path:string) => readFileSync(resolve(root,path),'utf8');
describe('authoritative planner release with a LabNest host adapter',()=>{
 it('retains every independent runtime asset byte-for-byte except the declared host insertion',()=>{
  const manifest=JSON.parse(read('release.json'));
  expect(manifest.commit).toMatch(/^[a-f0-9]{40}$/);
  for(const [file,expected] of Object.entries(manifest.files)){
   const content=file==='index.html'?read(file).replace(manifest.hostInsertion,''):readFileSync(resolve(root,file));
   expect(createHash('sha256').update(content).digest('hex'),file).toBe(expected);
  }
 });
 it('keeps offline preparation modules and uses a separate host bridge, not a forked app',()=>{
  const html=read('index.html');
  for(const id of ['basic','transfection','serial','drug','reaction','normalization']) expect(html).toContain(`data-liquid-module="${id}"`);
  expect(html).toContain('labnest-bridge.js');
  expect(read('app.js')).toContain('window.LabNestPlateBridge?.connect');
  expect(read('app.js')).not.toContain('plateCalculatorDefinitions');
  const bridge=read('labnest-bridge.js');
  for(const id of ['master-mix','seeding','hydrogel','kill-curve','moi'])expect(bridge).toContain(id);
  expect(bridge).toContain('buildPlateLiquidPlan');
  expect(bridge).toContain('event.source !== current.frame.contentWindow');
 });
});
