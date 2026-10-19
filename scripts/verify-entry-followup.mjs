import {chromium} from 'playwright';import assert from 'node:assert/strict';import {readFile,writeFile} from 'node:fs/promises';
const base=process.env.LABNEST_E2E_BASE_URL??'http://localhost:3338',out='docs/structured-protocol/20261014/followup-evidence';assert(['localhost','127.0.0.1'].includes(new URL(base).hostname)&&new URL(base).port!=='3001');
const f=JSON.parse(await readFile(`${out}/entry-fixture.json`,'utf8')),browser=await chromium.launch(),page=await browser.newPage({viewport:{width:390,height:844}});const report={synthetic:true,checks:[]};
const entry=async()=> (await (await page.request.get(`${base}/api/entries/${f.entryId}`)).json()).entry;
const status=async(next,reason)=>{await page.locator('select[name="recordStatus"]').selectOption(next);if(reason)await page.locator('textarea[name="reason"]').fill(reason);const saved=page.waitForResponse(r=>r.request().method()==='POST'&&!!r.request().headers()['next-action']);await page.getByRole('button',{name:'Update',exact:true}).click();await saved;await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('select[name="recordStatus"]').inputValue(),next);};
try {
 await page.goto(`${base}/entries/${f.entryId}`,{waitUntil:'networkidle'});
 const ai=page.getByRole('button',{name:'Propose with AI',exact:true});assert(await ai.isVisible());assert((await ai.boundingBox()).y<500);assert.equal(await ai.getAttribute('data-ai-off'),'true');
 await page.screenshot({path:`${out}/entry-ai-mobile.png`});
 await page.goto(`${base}/experiments/${f.experimentId}`,{waitUntil:'networkidle'});await status('submitted');
 const before=await entry();assert.equal(before.createdAt,f.createdAt);assert.equal(before.occurredAt,f.occurredAt);
 const patch=await page.request.patch(`${base}/api/entries/${f.entryId}`,{multipart:{title:before.title,contentMarkdown:'SOURCE-AFTER · 后续更正',eventTimePrecision:'date',occurredAt:'2026-09-21',expectedUpdatedAt:before.updatedAt,mediaOrder:JSON.stringify([{kind:'existing',id:f.attachmentId}]),newFileIds:'[]'}});assert.equal(patch.status(),200,await patch.text());
 await page.reload({waitUntil:'networkidle'});await status('reviewed');
 const source=page.getByRole('region',{name:/^Source entries/}).last().locator('article').filter({has:page.locator(`a[href="/entries/${f.entryId}"]`)});assert((await source.innerText()).includes('SOURCE-BEFORE'));assert(!(await source.innerText()).includes('SOURCE-AFTER'));
 const image=source.locator('img').first();await image.waitFor();assert(await image.evaluate(i=>i.complete&&i.naturalWidth>0));
 await page.screenshot({path:`${out}/entry-frozen-mobile.png`,fullPage:true});
 await status('draft','合成验收：明确重新打开');assert((await source.innerText()).includes('SOURCE-AFTER'));
 await page.goto(`${base}/results/${f.resultId}`,{waitUntil:'networkidle'});assert((await page.getByRole('region',{name:/^Source entries/}).last().innerText()).includes('RESULT-SOURCE-BEFORE'));assert(!(await page.locator('body').innerText()).includes('RESULT-SOURCE-AFTER'));
 report.checks.push({name:'Entry top AI button; filing preserves original times; experiment submit→source edit→review retains text and loaded image; explicit reopen sees latest; reviewed result reads frozen source',result:'通过'});
 await page.goto(`${base}/entries/${f.entryId}/edit`,{waitUntil:'networkidle'});
 const editor=page.locator('.ProseMirror[contenteditable=true]').filter({visible:true}).last();await editor.fill('LOCAL-DRAFT · 本机未同步正文');
 const stale=await entry();const other=await page.request.patch(`${base}/api/entries/${f.entryId}`,{multipart:{title:stale.title,contentMarkdown:'OTHER-WRITER · 服务器新正文',eventTimePrecision:'date',occurredAt:'2026-09-21',expectedUpdatedAt:stale.updatedAt,mediaOrder:JSON.stringify([{kind:'existing',id:f.attachmentId}]),newFileIds:'[]'}});assert.equal(other.status(),200);
 await page.getByRole('button',{name:'Save changes',exact:true}).click();await page.getByRole('region',{name:'正文冲突核对'}).waitFor();
 assert((await page.getByLabel('本机草稿对照').inputValue()).includes('LOCAL-DRAFT'));assert((await page.getByLabel('服务器正文对照').inputValue()).includes('OTHER-WRITER'));
 assert((await entry()).contentMarkdown.includes('OTHER-WRITER'));await page.screenshot({path:`${out}/entry-conflict-mobile.png`,fullPage:true});
 report.checks.push({name:'Two writers: stale body rejected; both drafts shown; server remains newer; no automatic revision rebase',result:'通过'});
 console.log('PASS Entry visible AI, original time/image, frozen experiment and result source, explicit reopen');
} catch(error){report.error=String(error);process.exitCode=1;await page.screenshot({path:`${out}/entry-failure.png`});}finally{await writeFile(`${out}/entry-browser-report.json`,JSON.stringify(report,null,2));await browser.close();}
