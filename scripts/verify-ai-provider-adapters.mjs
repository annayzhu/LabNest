import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {chromium,webkit} from 'playwright';
import pg from 'pg';

const database=new URL(process.env.DATABASE_URL??'');
assert.equal(database.pathname,'/labnest_ai_provider_acceptance_20261008','Only the isolated acceptance database is permitted');
assert(['localhost','127.0.0.1'].includes(database.hostname));
const db=new pg.Client({connectionString:database.toString()});
const base=process.env.LABNEST_E2E_BASE_URL??'http://localhost:3338';
const mockPort=Number(process.env.AI_MOCK_PORT??4848);
const mockBase=process.env.AI_MOCK_BASE_URL??`http://127.0.0.1:${mockPort}/v1`;
const dir=process.env.AI_EVIDENCE_DIR??'docs/ai/20261008/evidence/browser';
await mkdir(dir,{recursive:true});
const report={sha:process.env.AI_APPLICATION_SHA??execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),base,at:new Date().toISOString(),synthetic:true,liveProviders:false,checks:[],failures:[]};
const token='acceptance-fake-token';
const proposal={sourceType:'ai',actionType:'create_experiment',reason:'Synthetic follow-up only.',payload:{title:'Synthetic density follow-up'}};
let mode='valid', calls=0, release, entered;
const requests=[];
const mock=createServer(async(req,res)=>{
 const chunks=[];for await(const chunk of req)chunks.push(chunk);const text=Buffer.concat(chunks).toString();
 requests.push({path:req.url,body:text?JSON.parse(text):undefined});
 const reply=(data,status=200)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(data));};
 if(mode==='error')return reply({error:{message:`Invalid credential: ${token}`}},401);
 if(mode==='plain-error'){res.writeHead(401,{'content-type':'text/plain'});return res.end('x'.repeat(295)+token);}
 if(req.url.endsWith('/models'))return reply({data:[{id:'fixture-model'}]});
 if(req.url.endsWith('/parameters'))return reply({});
 calls++;
 if(mode==='hold'){entered?.();await new Promise(resolve=>{release=resolve;});}
 let content=JSON.stringify([proposal,{...proposal,payload:{title:'Synthetic second follow-up'}}]);
 if(mode==='invalid')content='[{"invalid":true}]';
 if(mode==='empty')content='[]';
 if(mode==='subset')content=JSON.stringify([{...proposal,actionType:'receive_purchase'}]);
 if(mode==='many')content=JSON.stringify(Array.from({length:51},()=>proposal));
 if(req.url.endsWith('/messages'))return reply({model:'fixture-model',content:[{type:'text',text:content}]});
 if(req.url.endsWith('/chat-messages'))return reply({answer:content});
 return reply({model:'fixture-model',choices:[{message:{content}}]});
});
const api=(page,path,data,headers={})=>page.request.post(base+path,{data,headers:{origin:base,'content-type':'application/json',...headers}});
async function check(name,run){try{await run();report.checks.push({name,status:'passed'});}catch(e){report.failures.push({name,error:String(e)});throw e;}finally{await writeFile(`${dir}/report.json`,JSON.stringify(report,null,2));}}
async function entry(page,name){const r=await page.request.post(base+'/api/entries',{multipart:{title:name,contentMarkdown:'Synthetic cells looked dense; plan a comparison.',occurredAt:new Date().toISOString(),recordStatus:'draft'}});assert.equal(r.status(),201,await r.text());return (await r.json()).entryId;}
async function provider(page,type,name){await page.goto(base+'/settings',{waitUntil:'networkidle'});const form=page.locator('form:has(input[name="apiKey"])');await form.locator('[name="type"]').selectOption(type);await form.locator('[name="name"]').fill(name);await form.locator('[name="baseUrl"]').fill(mockBase);await form.locator('[name="defaultModel"]').fill('fixture-model');await form.locator('[name="apiKey"]').fill(token);await Promise.all([page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/settings'),form.getByRole('button',{name:'Add provider',exact:true}).click()]);await page.goto(base+'/settings',{waitUntil:'networkidle'});return (await db.query('SELECT id FROM "AIProvider" WHERE name=$1',[name])).rows[0].id;}
async function settings(page,id,enabled=true){await page.goto(base+'/settings',{waitUntil:'networkidle'});const form=page.locator('form:has(select[name="defaultProviderId"])');await form.locator('[name="enabled"]').setChecked(enabled);await form.locator('[name="defaultProviderId"]').selectOption(id??'');await Promise.all([page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/settings'),form.getByRole('button',{name:'Save AI settings',exact:true}).click()]);await page.goto(base+'/settings',{waitUntil:'networkidle'});}
async function count(id){return Number((await db.query('SELECT count(*) FROM "ProposedAction" WHERE "sourceId"=$1',[id])).rows[0].count);}
try{
 await db.connect();await new Promise(resolve=>mock.listen(mockPort,'0.0.0.0',resolve));
 for(const [engine,type] of Object.entries({chromium,webkit})){
  const browser=await type.launch();
  try{const context=await browser.newContext({viewport:{width:1440,height:900}});await context.addInitScript(()=>{localStorage.setItem('labnest.locale','en');});const page=await context.newPage();
   const id=await entry(page,`AI acceptance ${engine}`);
   const providerId=await provider(page,'openai_compatible',`Fixture ${engine}`);
   await check(`${engine}: master off blocks generation and connection tests`,async()=>{await settings(page,providerId,false);assert.equal((await api(page,'/api/ai/generate',{entryId:id})).status(),403);assert.equal((await api(page,`/api/ai/providers/${providerId}/test`,{})).status(),403);});
   await settings(page,providerId,true);
   await check(`${engine}: UI connection, encrypted save and blank-key edit`,async()=>{
    const row=page.getByRole('row').filter({hasText:`Fixture ${engine}`});await row.getByRole('button',{name:'Test',exact:true}).click();await row.getByRole('status').filter({hasText:'Connected.'}).waitFor();
    const before=(await db.query('SELECT "apiKeyEncrypted" FROM "AIProvider" WHERE id=$1',[providerId])).rows[0].apiKeyEncrypted;assert(before.startsWith('v1:')&&!before.includes(token));assert(!(await page.content()).includes(token));
    await row.getByRole('link',{name:'Edit',exact:true}).click();const form=page.locator('form:has(input[name="apiKey"])');assert.equal(await form.locator('[name="apiKey"]').inputValue(),'');await Promise.all([page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/settings'),form.getByRole('button',{name:'Save provider',exact:true}).click()]);assert.equal((await db.query('SELECT "apiKeyEncrypted" FROM "AIProvider" WHERE id=$1',[providerId])).rows[0].apiKeyEncrypted,before);
    await page.goto(base+'/settings#providers',{waitUntil:'networkidle'});await page.screenshot({path:`${dir}/${engine}-settings-desktop.png`,fullPage:true});
   });
   const stale=await context.newPage();await stale.goto(base+`/entries/${id}`,{waitUntil:'networkidle'});await stale.getByRole('button',{name:'More actions',exact:true}).click();await stale.getByRole('button',{name:'Delete / archive',exact:true}).click();await stale.locator('input[name="confirmation"]').fill(`AI acceptance ${engine}`);
   await check(`${engine}: real entry button saves pending only and stale deletion is blocked`,async()=>{
    await page.goto(base+`/entries/${id}`,{waitUntil:'networkidle'});const request=page.waitForRequest(r=>r.url().endsWith('/api/ai/generate'));await page.getByRole('button',{name:'Propose with AI',exact:true}).click();const payload=(await request).postDataJSON();assert(payload.clientMutationId);await page.getByRole('status').filter({hasText:'2 proposed actions added for review'}).waitFor();assert.equal(await count(id),2);
    const records=(await db.query('SELECT "sourceType",status FROM "ProposedAction" WHERE "sourceId"=$1',[id])).rows;assert(records.every(x=>x.sourceType==='ai'&&x.status==='pending'));assert.equal(Number((await db.query('SELECT count(*) FROM "Experiment"')).rows[0].count),0);
    await stale.getByRole('button',{name:'Move to Recycle Bin',exact:true}).click();await stale.getByRole('alert').filter({hasText:'only be archived'}).waitFor();assert.equal(Number((await db.query('SELECT count(*) FROM "Entry" WHERE id=$1',[id])).rows[0].count),1);
    await page.screenshot({path:`${dir}/${engine}-entry-desktop.png`,fullPage:true});await page.goto(base+'/actions',{waitUntil:'networkidle'});await page.getByText('Synthetic density follow-up',{exact:false}).first().waitFor();await page.screenshot({path:`${dir}/${engine}-inbox-desktop.png`,fullPage:true});
   });await stale.close();
   await check(`${engine}: concurrent replay saves once and calls the model once`,async()=>{const mutation=randomUUID(),n=await count(id),start=calls;const responses=await Promise.all([api(page,'/api/ai/generate',{entryId:id,persist:true,clientMutationId:mutation}),api(page,'/api/ai/generate',{entryId:id,persist:true,clientMutationId:mutation})]);for(const r of responses)assert.equal(r.status(),200,await r.text());assert.equal(calls-start,1);assert.equal(await count(id),n+2);assert.equal((await api(page,'/api/ai/generate',{entryId:id,persist:true,clientMutationId:mutation})).status(),200);assert.equal(await count(id),n+2);});
   await check(`${engine}: foreign/missing origin and text/plain never call the model`,async()=>{const n=calls;assert.equal((await api(page,'/api/ai/generate',{entryId:id},{origin:'https://foreign.example'})).status(),403);assert.equal((await page.request.post(base+'/api/ai/generate',{data:{entryId:id}})).status(),403);assert.equal((await api(page,'/api/ai/generate',{entryId:id},{'content-type':'text/plain'})).status(),415);assert.equal(calls,n);});
   await check(`${engine}: invalid, oversized and disallowed output saves nothing; errors hide credentials`,async()=>{const n=await count(id);for(const value of ['invalid','many','subset']){mode=value;const r=await api(page,'/api/ai/generate',{entryId:id,persist:true,clientMutationId:randomUUID(),allowedActionTypes:['create_experiment']});assert.equal(r.status(),422,await r.text());assert.equal(await count(id),n);}for(const errorMode of ['error','plain-error']){mode=errorMode;const r=await api(page,`/api/ai/providers/${providerId}/test`,{});assert.equal(r.status(),502);const text=await r.text();assert(!text.includes(token)&&!text.includes('accep'));}mode='valid';});
   await check(`${engine}: empty actions replay without duplicate audit or suggestions`,async()=>{mode='empty';const mutation=randomUUID(),n=await count(id),start=calls;const a=await api(page,'/api/ai/generate',{entryId:id,persist:true,clientMutationId:mutation});assert.equal(a.status(),200);assert.equal((await a.json()).count,0);await api(page,'/api/ai/generate',{entryId:id,persist:true,clientMutationId:mutation});assert.equal(calls,start+1);assert.equal(await count(id),n);mode='valid';});
   await check(`${engine}: changed source during generation rejects publishing`,async()=>{const source=await entry(page,`Changed ${engine}`);mode='hold';const reached=new Promise(resolve=>{entered=resolve;});const pending=api(page,'/api/ai/generate',{entryId:source,persist:true,clientMutationId:randomUUID()});await Promise.race([reached,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(new Error('Mock model not reached within 30s')),30000);timer.unref();})]);const current=(await(await page.request.get(base+`/api/entries/${source}`)).json()).entry;const r=await page.request.patch(base+`/api/entries/${source}`,{multipart:{title:current.title,contentMarkdown:'Changed after the explicit request.',occurredAt:current.occurredAt,expectedUpdatedAt:current.updatedAt,recordStatus:'draft'}});assert.equal(r.status(),200,await r.text());release();assert.equal((await pending).status(),409);assert.equal(await count(source),0);mode='valid';entered=undefined;});
   await check(`${engine}: deleted source during generation saves no orphan`,async()=>{const name=`Deleted ${engine}`,source=await entry(page,name);mode='hold';const reached=new Promise(resolve=>{entered=resolve;});const pending=api(page,'/api/ai/generate',{entryId:source,persist:true,clientMutationId:randomUUID()});await Promise.race([reached,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(new Error('Mock model not reached within 30s')),30000);timer.unref();})]);await page.goto(base+`/entries/${source}`,{waitUntil:'networkidle'});await page.getByRole('button',{name:'More actions',exact:true}).click();await page.getByRole('button',{name:'Delete / archive',exact:true}).click();await page.locator('input[name="confirmation"]').fill(name);await Promise.all([page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname===`/entries/${source}`),page.getByRole('button',{name:'Move to Recycle Bin',exact:true}).click()]);assert.equal(Number((await db.query('SELECT count(*) FROM "Entry" WHERE id=$1',[source])).rows[0].count),0);release();assert.equal((await pending).status(),409);assert.equal(await count(source),0);mode='valid';entered=undefined;});
   await check(`${engine}: explicit workbench text returns drafts without database writes`,async()=>{const n=await count(id);await page.goto(base+'/actions/manual',{waitUntil:'networkidle'});await page.getByLabel('Entry title',{exact:true}).fill('Synthetic workbench');await page.getByLabel(/^Entry body/).fill('Only this synthetic text is submitted.');await page.getByRole('button',{name:`Ask Fixture ${engine}`,exact:true}).click();await page.getByText(/2 proposed actions returned/).waitFor();assert.equal(await count(id),n);assert(requests.some(x=>x.body?.messages?.some(m=>m.content?.includes('Only this synthetic text'))));});
   for(const providerType of ['anthropic','dify']){const another=await provider(page,providerType,`${providerType} ${engine}`);await settings(page,another);await check(`${engine}: ${providerType} through real Settings and HTTP adapter`,async()=>{const r=await api(page,`/api/ai/providers/${another}/test`,{});assert.equal(r.status(),200,await r.text());const g=await api(page,'/api/ai/generate',{entryTitle:'Synthetic direct',entryBody:'Synthetic protocol-independent text.'});assert.equal(g.status(),200,await g.text());assert.equal((await g.json()).count,2);});}
   await check(`${engine}: provider disable and delete via real Settings`,async()=>{await page.goto(base+'/settings',{waitUntil:'networkidle'});const row=page.getByRole('row').filter({hasText:`dify ${engine}`});await Promise.all([page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/settings'),row.getByRole('button',{name:'Disable',exact:true}).click()]);assert.equal((await db.query('SELECT enabled FROM "AIProvider" WHERE name=$1',[`dify ${engine}`])).rows[0].enabled,false);assert.equal((await api(page,'/api/ai/generate',{entryTitle:'Synthetic',entryBody:'Synthetic'})).status(),409);await page.goto(base+'/settings',{waitUntil:'networkidle'});await Promise.all([page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/settings'),page.getByRole('row').filter({hasText:`dify ${engine}`}).getByRole('button',{name:'Delete',exact:true}).click()]);assert.equal(Number((await db.query('SELECT count(*) FROM "AIProvider" WHERE name=$1',[`dify ${engine}`])).rows[0].count),0);assert.equal((await db.query('SELECT "defaultProviderId" FROM "AISettings" WHERE id=\'default\'')).rows[0].defaultProviderId,null);});
   await settings(page,providerId);await page.setViewportSize({width:390,height:844});await page.goto(base+'/settings#providers',{waitUntil:'networkidle'});await page.screenshot({path:`${dir}/${engine}-settings-mobile.png`,fullPage:true});await page.goto(base+`/entries/${id}`,{waitUntil:'networkidle'});await page.screenshot({path:`${dir}/${engine}-entry-mobile.png`,fullPage:true});
   await check(`${engine}: mobile HTTP UUID fallback and pending save`,async()=>{await page.evaluate(()=>Object.defineProperty(crypto,'randomUUID',{value:undefined,configurable:true}));await page.getByRole('button',{name:'Propose with AI',exact:true}).click();await page.getByRole('status').filter({hasText:'2 proposed actions added for review'}).waitFor();});
   await settings(page,providerId,false);await context.close();
  }finally{await browser.close();}
 }
}finally{release?.();mock.closeAllConnections();await new Promise(resolve=>mock.close(resolve));await db.end();await writeFile(`${dir}/report.json`,JSON.stringify(report,null,2));}
assert.equal(report.failures.length,0);console.log(JSON.stringify({checks:report.checks.length,failures:report.failures.length,synthetic:true,liveProviders:false}));
