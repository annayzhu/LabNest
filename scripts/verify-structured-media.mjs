import {closeProperties,openBlockMenu,uploadImages} from './test-helpers/editor-controls.mjs';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
const base = process.env.LABNEST_E2E_BASE_URL ?? 'http://localhost:3338', dir = 'docs/structured-protocol/20261014/evidence';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname) && new URL(base).port !== '3001');
const fixture = JSON.parse(await readFile(`${dir}/fixtures.json`, 'utf8'));
const browser = await chromium.launch(), context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['clipboard-read','clipboard-write'] });
const page = await context.newPage(), report = { head: execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(), synthetic: true, checks: [] };
await context.tracing.start({ screenshots: true, snapshots: true });
context.setDefaultTimeout(15000);
const doc = async () => JSON.parse(await page.locator('input[name="contentJson"]').inputValue());
// Media can be a block or a token inside a step, table or instruction paragraph.
function collectDocumentMedia(value) {
 if (typeof value === 'string') return [...value.matchAll(/<!--labnest-media:([^\s]+)-->/g)].map(match=>JSON.parse(decodeURIComponent(match[1])));
 if (Array.isArray(value)) return value.flatMap(collectDocumentMedia);
 if (!value || typeof value !== 'object') return [];
 if (value.type === 'media' && value.id) return [value];
 return Object.values(value).flatMap(collectDocumentMedia);
}
const media = async () => collectDocumentMedia(await doc());
const close = () => closeProperties(page);
const check = async (name, fn) => { try { await fn(); report.checks.push({ name, result:'通过' }); console.log('PASS',name); } catch(e) {report.checks.push({name,result:'失败',error:e.message});await page.screenshot({path:`${dir}/media-failure.png`});throw e;} };
try {
await page.goto(`${base}/protocols/${fixture.protocolId}/versions/${fixture.versionId}/edit`,{waitUntil:'networkidle'});
const nodes = page.locator('#protocol-section-steps [data-document-media]');
const before = await media();
await check('C04 visible move, undo/redo and explicit clipboard copy preserve original assets and unique node IDs',async()=>{
 await nodes.first().locator('img').click(); await close();
 await (await openBlockMenu(page,nodes.first())).getByRole('menuitem',{name:/^Move down/}).click();
 assert.deepEqual((await media()).map(b=>b.id),[before[1].id,before[0].id,before[2].id,before[3].id]);
 await page.keyboard.press('ControlOrMeta+z');assert.deepEqual((await media()).map(b=>b.id),before.map(b=>b.id));
 await page.keyboard.press('ControlOrMeta+Shift+z');assert.equal((await media()).length,4);
 await nodes.first().locator('img').click();
 await page.keyboard.press('ControlOrMeta+c');
 const clipboard = await page.evaluate(async()=>{const items=await navigator.clipboard.read();for(const item of items)if(item.types.includes('text/html'))return (await item.getType('text/html')).text();return '';});
 assert(clipboard.includes('data-document-media'), 'Copy must finish with the selected media HTML before pasting.');
 const target=page.locator('#protocol-section-steps [data-node-view-content] p').last();await target.click();
 await page.waitForFunction(element=>element.contains(document.getSelection()?.anchorNode)&&document.activeElement?.getAttribute('contenteditable')==='true',await target.elementHandle());
 await page.keyboard.press('ControlOrMeta+v');
 await page.waitForFunction(()=>document.querySelectorAll('#protocol-section-steps [data-document-media]').length===5);
 // Separate paste/delete gestures from the editor's 500 ms undo grouping.
 const copied=await media();assert.equal(new Set(copied.map(b=>b.id)).size,5);assert.equal(new Set(copied.map(b=>b.attachmentId)).size,4);
 const copy=copied.find(b=>!before.some(o=>o.id===b.id));
 await page.locator(`[data-document-media="${copy.id}"] img`).click();
 await page.waitForTimeout(550);await (await openBlockMenu(page,page.locator('[data-document-media][data-media-active="true"]'))).getByRole('menuitem',{name:'Remove (keeps the file)',exact:true}).click();assert.equal((await media()).length,4);
 await page.keyboard.press('ControlOrMeta+z');assert.equal((await media()).length,5);
 await page.keyboard.press('ControlOrMeta+Shift+z');assert.equal((await media()).length,4);
});
await check('C04 native pointer drag moves one reference without a new upload',async()=>{
 const initial=await media();
 await nodes.first().locator('img').click();await close();
 await nodes.first().hover();await page.getByRole('button',{name:'Drag to move, click for the menu',exact:true}).dragTo(nodes.nth(1),{targetPosition:{x:30,y:170}});
 const moved=await media();assert.equal(moved.length,4);assert.deepEqual(new Set(moved.map(b=>b.id)),new Set(initial.map(b=>b.id)));assert.notDeepEqual(moved.map(b=>b.id),initial.map(b=>b.id));
});
await check('C06 upload failure is explicit; retry creates one asset, delete/undo retains reference',async()=>{
 let first=true,posts=0;
 await page.route('**/api/attachments',async route=>{if(route.request().method()==='POST'){posts++;if(first){first=false;return route.fulfill({status:503,json:{error:'Synthetic upload failure'}});}}return route.continue();});
 const buffer=await sharp({create:{width:180,height:120,channels:3,background:'#346a80'}}).png().toBuffer();
 await uploadImages(page,{name:'合成重试图.png',mimeType:'image/png',buffer},'image',page.locator('#protocol-section-steps [data-node-view-content] p').last());
 await page.getByText('上传失败 / Upload failed',{exact:false}).waitFor();assert.equal(await page.locator('[data-document-media] [role=status]').count(),1);const editUrl=page.url();await close();await page.getByRole('button',{name:'Save Protocol',exact:true}).click();assert.equal(page.url(),editUrl,'A failed upload must block saving');
 await page.getByRole('button',{name:'重试 / Retry',exact:true}).click();
 await page.waitForFunction(()=>!document.querySelector('[data-document-media] [role="status"]'));
 assert.equal(posts,2);assert.equal((await media()).length,5);assert.equal(new Set((await media()).map(b=>b.attachmentId)).size,5);
 const extra=(await media()).find(b=>b.filename==='合成重试图.png');
 await page.locator(`[data-document-media="${extra.id}"] img`).click();await page.waitForTimeout(550);await (await openBlockMenu(page,page.locator('[data-document-media][data-media-active="true"]'))).getByRole('menuitem',{name:'Remove (keeps the file)',exact:true}).click();assert.equal((await media()).length,4);
 await page.keyboard.press('ControlOrMeta+z');assert.equal((await media()).length,5);assert.equal(posts,2);
 await close();await page.getByRole('button',{name:'Save Protocol',exact:true}).click();await page.waitForURL(u=>/^\/protocols\/[^/]+$/.test(u.pathname));
 await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>[...document.querySelectorAll('.ln-protocol-media-preview img')].every(i=>i.complete&&i.naturalWidth>0));
 assert.equal(await page.locator('.ln-protocol-media-preview img').count(),5);
 await page.screenshot({path:`${dir}/media-readback.png`});
});
} finally {await context.tracing.stop({path:`${dir}/media-trace.zip`});await browser.close();await writeFile(`${dir}/media-report.json`,JSON.stringify(report,null,2));}
