import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import pg from 'pg';
import { mkdir,writeFile } from 'node:fs/promises';
const base=process.env.LABNEST_E2E_BASE_URL??'http://localhost:3338';
const url=new URL(process.env.DATABASE_URL);
assert(['labnest_ai_module_acceptance_20261014','labnest_ai_provider_acceptance_20261008','labnest_ai_connection_20261014'].includes(url.pathname.slice(1)));
assert(['localhost','127.0.0.1'].includes(url.hostname));assert.notEqual(new URL(base).port,'3001');
const db=new pg.Client({connectionString:url.href});
const dir=process.env.AI_MODULE_EVIDENCE_DIR??'docs/modules/ai/20261014/evidence';await mkdir(dir,{recursive:true});
const results=[];const browser=await chromium.launch();
async function eventually(fn){let error;for(let i=0;i<50;i++){try{return await fn();}catch(e){error=e;await new Promise(r=>setTimeout(r,100));}}throw error;}
async function check(name,fn){try{await fn();results.push({name,status:'passed'});}catch(e){results.push({name,status:'failed',error:String(e)});}}
try{
 await db.connect();
 const id='review-sync-fixture';
 await db.query('INSERT INTO "AIProvider" (id,name,type,"baseUrl","apiKeyEncrypted","defaultModel",enabled,"updatedAt") VALUES ($1,\'Review sync fixture\',\'openai_compatible\',\'http://127.0.0.1:4850/v1\',\'v1:synthetic:synthetic:synthetic\',\'fixture\',true,now()) ON CONFLICT(id) DO UPDATE SET enabled=true,"apiKeyEncrypted"=EXCLUDED."apiKeyEncrypted","updatedAt"=now()',[id]);
 await db.query('UPDATE "AISettings" SET enabled=true,"defaultProviderId"=$1,"attachmentsEnabled"=true,"updatedAt"=now() WHERE id=\'default\'',[id]);
 const context=await browser.newContext({viewport:{width:1440,height:900}});await context.addInitScript(()=>localStorage.setItem('labnest.locale','en'));
 const page=await context.newPage();await page.goto(base+'/ai',{waitUntil:'networkidle'});
 await check('provider disable and enable immediately refresh availability without reload/focus',async()=>{
  const state=page.locator('[data-ai-state]');await eventually(async()=>assert.equal(await state.textContent(),'On · fully set up'));
  const row=page.locator(`[data-provider-row="${id}"]`);
  await row.getByRole('button',{name:/^(停用|Disable service)$/,exact:true}).click();
  await row.getByRole('button',{name:/^(启用|Enable service)$/,exact:true}).waitFor();
  await eventually(async()=>assert.equal(await state.textContent(),'On · setup incomplete'));
  await row.getByRole('button',{name:/^(启用|Enable service)$/,exact:true}).click();
  await row.getByRole('button',{name:/^(停用|Disable service)$/,exact:true}).waitFor();
  await eventually(async()=>assert.equal(await state.textContent(),'On · fully set up'));
 });
 await page.reload({waitUntil:'networkidle'});
 await check('pending configuration save prevents a later draft from being silently discarded',async()=>{
  let release,entered;const reached=new Promise(r=>{entered=r;});
  await page.route('**/api/ai/settings',async route=>{
   if(route.request().method()!=='PATCH')return route.continue();
   const response=await route.fetch();entered();await new Promise(r=>{release=r;});await route.fulfill({response});
  });
  try{
   const input=page.locator('[name="attachmentsEnabled"]');await input.uncheck();
   await page.getByRole('button',{name:/^(保存功能设置|Save feature settings)$/}).click();await reached;
   assert.equal(await input.isDisabled(),true,'Pending save must not discard a newly edited draft');
   assert.equal(await page.locator('[name="defaultProviderId"]').isDisabled(),true);
  }finally{release?.();await page.unrouteAll({behavior:'wait'});}
 });
}finally{await browser.close();await db.end();await writeFile(`${dir}/review-regressions.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results));}
if(results.some(r=>r.status==='failed'))process.exitCode=1;
