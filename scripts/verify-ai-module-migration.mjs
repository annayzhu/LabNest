import assert from 'node:assert/strict';
import { chromium, webkit } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import pg from 'pg';
const base = process.env.LABNEST_E2E_BASE_URL ?? 'http://localhost:3338';
const dbURL = new URL(process.env.DATABASE_URL);
assert(['labnest_ai_module_acceptance_20261014','labnest_ai_provider_acceptance_20261008'].includes(dbURL.pathname.slice(1)));
assert(['127.0.0.1','localhost'].includes(dbURL.hostname));
assert.notEqual(new URL(base).port,'3001','Never mutate production');
const db=new pg.Client({connectionString:dbURL.href});
const dir=process.env.AI_MODULE_EVIDENCE_DIR??'docs/ai/20261014/evidence';
await mkdir(dir,{recursive:true});
const report={revision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),synthetic:true,liveProvider:false,checks:[],failures:[]};
const read=async()=>{const r=await fetch(base+'/api/ai/settings');assert.equal(r.status,200);return r.json();};
const patch=async data=>fetch(base+'/api/ai/settings',{method:'PATCH',headers:{origin:base,'content-type':'application/json'},body:JSON.stringify(data)});
async function check(name,run){try{await run();report.checks.push({name,status:'passed'});}catch(e){report.failures.push({name,error:String(e)});throw e;}finally{await writeFile(`${dir}/migration.json`,JSON.stringify(report,null,2));}}
async function eventually(run){let error;for(let i=0;i<60;i++){try{return await run();}catch(e){error=e;await new Promise(r=>setTimeout(r,100));}}throw error;}
try {
 await db.connect();
 await db.query('DELETE FROM "AISettings" WHERE id=\'default\'');
 await check('B02 new workspace defaults off without creating an opt-in',async()=>{const saved=await read();assert.equal(saved.enabled,false);assert.equal(saved.revision,'unset');});
 for(const enabled of [true,false]){
  await db.query('INSERT INTO "AISettings" (id,enabled,"attachmentsEnabled","updatedAt") VALUES (\'default\',$1,true,now()) ON CONFLICT(id) DO UPDATE SET enabled=$1,"attachmentsEnabled"=true,"updatedAt"=now()',[enabled]);
  await check(`B02 historic synthetic enabled=${enabled} preserved`,async()=>{const saved=await read();assert.equal(saved.enabled,enabled);assert.equal(saved.attachmentsEnabled,true);});
 }
 const fixtureId='ai-module-historic-manual';
 await db.query('INSERT INTO "AIProvider" (id,name,type,enabled,"updatedAt") VALUES ($1,\'Historic manual fixture\',\'manual_copy_paste\',false,now()) ON CONFLICT(id) DO NOTHING',[fixtureId]);
 const saved=await read();assert.equal((await patch({kind:'configuration',revision:saved.revision,defaultProviderId:fixtureId,attachmentsEnabled:true})).status,200);
 await check('B04 concurrent updates reject stale revision rather than overwrite',async()=>{const prior=await read();const results=await Promise.all([patch({kind:'enabled',revision:prior.revision,enabled:true}),patch({kind:'enabled',revision:prior.revision,enabled:false})]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);});
 await check('B07 missing/foreign Origin cannot mutate settings',async()=>{const value=await read();for(const origin of [undefined,'https://foreign.example']){const r=await fetch(base+'/api/ai/settings',{method:'PATCH',headers:{'content-type':'application/json',...(origin?{origin}:{})},body:JSON.stringify({kind:'enabled',revision:value.revision,enabled:!value.enabled})});assert.equal(r.status,403);}assert.equal((await read()).revision,value.revision);});
 for(const [engine,type] of Object.entries({chromium,webkit})) {
  const browser=await type.launch();
  try {
   const context=await browser.newContext({viewport:{width:1440,height:900}});
   await context.addInitScript(()=>localStorage.setItem('labnest.locale','en'));
   const page=await context.newPage();
   const backgroundRoutes=[];page.on('request',r=>{if(new URL(r.url()).searchParams.has('_rsc'))backgroundRoutes.push(r.url());});
   const pageErrors=[];page.on('pageerror',e=>{pageErrors.push(e.message);console.log('Page error',engine,page.url(),e.message);});
   let inferenceRequests=0;page.on('request',r=>{if(/\/api\/ai\/(generate|protocol-extraction|manual|providers)/.test(r.url()))inferenceRequests++;});
   await page.goto(base+'/ai',{waitUntil:'networkidle'});
   const toggle=page.getByRole('switch',{name:'启用 AI',exact:true});
   await check(`${engine} AI page does not prefetch historical records or navigation data`,async()=>{assert.deepEqual(backgroundRoutes,[]);});
   await check(`${engine} A01/A03 old review/settings anchors and provider editing links`,async()=>{
    for(const [old,expected] of [['/actions','/ai'],['/settings#ai-access','/ai#ai-access'],['/settings#providers','/ai#providers'],[`/settings?provider=${fixtureId}#providers`,`/ai?provider=${fixtureId}#providers`],['/actions?status=pending','/actions/review?status=pending']]){await page.goto(base+old,{waitUntil:'networkidle'});await eventually(()=>assert.equal(page.url(),base+expected));}
    await page.goto(base+'/settings',{waitUntil:'networkidle'});assert.equal(await page.locator('input[name="apiKey"]').count(),0);await page.getByRole('link',{name:'AI 设置 →'}).click();await toggle.waitFor();
    assert.equal(await page.getByText('AI review',{exact:true}).count(),0);
   });
   await check(`${engine} B03/B06 switch is immediate and never submits configuration drafts`,async()=>{
    await page.goto(base+'/ai',{waitUntil:'networkidle'});const before=await read();
    await page.locator('[name="defaultProviderId"]').selectOption('');await page.locator('[name="attachmentsEnabled"]').uncheck();
    await Promise.all([page.waitForResponse(r=>r.request().method()==='PATCH'),toggle.click()]);
    const after=await read();assert.equal(after.enabled,!before.enabled);assert.equal(after.defaultProviderId,before.defaultProviderId);assert.equal(after.attachmentsEnabled,true);
    assert.equal(await page.locator('[name="defaultProviderId"]').inputValue(),'');assert.equal(await page.locator('[name="attachmentsEnabled"]').isChecked(),false);
    await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('[name="defaultProviderId"]').inputValue(),fixtureId);assert.equal(await page.locator('[name="attachmentsEnabled"]').isChecked(),true);
   });
   await check(`${engine} A06/B04 keyboard toggle and refreshed database state`,async()=>{const before=await read();await toggle.focus();assert.equal(await toggle.evaluate(e=>document.activeElement===e),true);await Promise.all([page.waitForResponse(r=>r.request().method()==='PATCH'),page.keyboard.press('Space')]);await page.reload({waitUntil:'networkidle'});assert.equal((await read()).enabled,!before.enabled);assert.equal(await toggle.getAttribute('aria-checked'),String(!before.enabled));});
   await check(`${engine} B05 failed switch write rolls back and reports failure`,async()=>{
    const before=await read();await page.route('**/api/ai/settings',async route=>route.request().method()==='PATCH'?route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Synthetic save failure'})}):route.continue());
    await toggle.click();await page.getByRole('alert').filter({hasText:'Synthetic save failure'}).waitFor();assert.equal(await toggle.getAttribute('aria-checked'),String(before.enabled));assert.equal((await read()).revision,before.revision);
    await page.screenshot({path:`${dir}/${engine}-save-failure.png`,fullPage:true});await page.unroute('**/api/ai/settings');await page.getByRole('button',{name:'重新读取',exact:true}).click();
   });
   await check(`${engine} B05 failed initial read is unknown/disabled and can retry`,async()=>{
    await page.route('**/api/ai/settings',async route=>route.request().method()==='GET'?route.fulfill({status:503,contentType:'application/json',body:'{"error":"Synthetic read failure"}'}):route.continue());
    await page.reload({waitUntil:'networkidle'});await page.getByRole('alert').filter({hasText:'无法读取 AI 设置'}).waitFor();assert.equal(await toggle.isDisabled(),true);
    await page.screenshot({path:`${dir}/${engine}-read-failure.png`,fullPage:true});await page.unroute('**/api/ai/settings');await page.getByRole('button',{name:'重新读取',exact:true}).click();await eventually(async()=>assert.equal(await toggle.isDisabled(),false));
   });
   await check(`${engine} B07 another tab and focus re-read the same saved state`,async()=>{
    const other=await context.newPage();await other.goto(base+'/ai',{waitUntil:'networkidle'});const before=await read();await Promise.all([other.waitForResponse(r=>r.request().method()==='PATCH'),other.getByRole('switch',{name:'启用 AI'}).click()]);
    await page.bringToFront();await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await eventually(async()=>assert.equal(await toggle.getAttribute('aria-checked'),String(!before.enabled)));await other.close();
   });
   await check(`${engine} B06/C04 pending configuration, disabled test, no implicit requests`,async()=>{
    if(!(await read()).enabled) await Promise.all([page.waitForResponse(r=>r.request().method()==='PATCH'),toggle.click()]);
    await page.locator('[data-ai-state]').filter({hasText:'已开启 · 待配置'}).waitFor();
    await page.locator('[name="defaultProviderId"]').selectOption(fixtureId);await Promise.all([page.waitForResponse(r=>r.request().method()==='PATCH'),page.getByRole('button',{name:'保存功能设置'}).click()]);
    assert.equal(inferenceRequests,0);
    await Promise.all([page.waitForResponse(r=>r.request().method()==='PATCH'),toggle.click()]);
    for(const b of await page.getByRole('button',{name:'Test',exact:true}).all())await eventually(async()=>assert.equal(await b.isDisabled(),true));
   });
   for(const width of [1440,1024,390]) await check(`${engine} A04/A05 ${width}px layout and visible first-screen switch`,async()=>{
    await page.setViewportSize({width,height:900});await page.goto(base+'/ai',{waitUntil:'networkidle'});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    const box=await toggle.boundingBox();assert(box&&box.y+box.height<900);
    const inputs=await page.locator('input:not([type="hidden"]),select').evaluateAll(elements=>elements.filter(e=>e.getBoundingClientRect().width>0).map(e=>({right:e.getBoundingClientRect().right,left:e.getBoundingClientRect().left})));
    assert(inputs.every(x=>x.left>=0&&x.right<=width));
    await page.screenshot({path:`${dir}/${engine}-ai-${width}.png`,fullPage:true});
    if(width===390){await page.getByRole('button',{name:'Open more navigation',exact:true}).click();await page.getByRole('link',{name:'AI',exact:true}).waitFor();await page.screenshot({path:`${dir}/${engine}-mobile-navigation.png`,fullPage:true});}
   });
   await check(`${engine} no unhandled page errors`,async()=>assert.deepEqual(pageErrors,[]));
   await context.close();
  } finally {await browser.close();}
 }
 console.log(JSON.stringify({checks:report.checks.length,failures:report.failures.length}));
} finally {await db.end();await writeFile(`${dir}/migration.json`,JSON.stringify(report,null,2));}
