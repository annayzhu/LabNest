import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {chromium,webkit} from 'playwright';
import pg from 'pg';

const database=new URL(process.env.DATABASE_URL??'');
assert(['/labnest_ai_connection_20261014','/labnest_ai_provider_acceptance_20261008'].includes(database.pathname));
assert(['localhost','127.0.0.1'].includes(database.hostname));
const base=process.env.LABNEST_E2E_BASE_URL??'http://localhost:3338';assert.notEqual(new URL(base).port,'3001');
const dir=process.env.AI_DRAFT_EVIDENCE_DIR??'docs/modules/ai/20261014-v1.1/evidence';await mkdir(dir,{recursive:true});
const db=new pg.Client({connectionString:database.href});
const report={revision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),synthetic:true,liveProvider:false,checks:[]};
let currentCheck='setup';
const requests=[];const token='synthetic-draft-key';let hold=false,entered,releases=[];
const mock=createServer(async(req,res)=>{
 const chunks=[];for await(const c of req)chunks.push(c);const body=chunks.length?JSON.parse(Buffer.concat(chunks).toString()):{};
 requests.push({path:req.url,body,authenticated:req.headers.authorization===`Bearer ${token}`||req.headers['x-api-key']===token});
 if(hold){entered?.();await new Promise(resolve=>releases.push(resolve));}
 const reply=(data,status=200)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify(data));};
 if(req.url.endsWith('/models'))return reply({data:[{id:'invalid-model'}]});
 if(body.model==='invalid-model')return reply({error:{code:'model_not_found',message:'Unknown requested model'}},404);
 if(body.model==='html'){res.writeHead(200,{'content-type':'text/html'});return res.end('<html>Login</html>');}
 if(body.model==='empty')return reply({});
 if(req.url.endsWith('/chat-messages'))return reply({answer:'OK'});
 if(req.url.endsWith('/messages'))return reply({model:body.model,content:[{type:'text',text:'OK'}]});
 return reply({model:body.model==='alias'?'actual-version':body.model,choices:[{message:{content:'OK'},finish_reason:'stop'}]});
});
const api=(path,data,method='POST',origin=base)=>fetch(base+path,{method,headers:{origin,'content-type':'application/json'},body:JSON.stringify(data)});
const settings=async()=>{const r=await fetch(base+'/api/ai/settings');assert.equal(r.status,200);return r.json();};
async function enabled(value){const saved=await settings();const r=await api('/api/ai/settings',{kind:'enabled',enabled:value,revision:saved.revision},'PATCH');assert.equal(r.status,200,await r.text());}
async function check(name,run){currentCheck=name;try{await run();report.checks.push({name,status:'passed'});}catch(e){report.checks.push({name,status:'failed',error:String(e)});throw e;}finally{await writeFile(`${dir}/draft-report.json`,JSON.stringify(report,null,2));}}
async function eventually(run){let error;for(let i=0;i<80;i++){try{return await run();}catch(e){error=e;await new Promise(r=>setTimeout(r,100));}}throw error;}
const reached=()=>new Promise((resolve,reject)=>{entered=resolve;const timer=setTimeout(()=>reject(Error('Mock not reached')),15000);timer.unref();});
const release=()=>{hold=false;for(const r of releases)r();releases=[];entered=undefined;};
const snapshot=async()=>JSON.stringify((await db.query(`SELECT (SELECT count(*) FROM "AIProvider") AS providers,(SELECT count(*) FROM "Entry") AS entries,(SELECT count(*) FROM "Experiment") AS experiments,(SELECT count(*) FROM "ProposedAction") AS proposals,(SELECT row_to_json(s)::text FROM "AISettings" s WHERE id='default') AS settings`)).rows[0]);
const address='http://127.0.0.1:4852/custom/v1';
const draft={name:'Unsaved synthetic provider',type:'openai_compatible',baseUrl:address,defaultModel:'fixture-model',apiKey:token,enabled:true};
try{
 await db.connect();await new Promise(resolve=>mock.listen(4852,'127.0.0.1',resolve));
 await db.query('DELETE FROM "AIProvider" WHERE name LIKE \'Draft %\' AND "baseUrl"=$1',[address]);
 await enabled(false);
 await check('E03/E09 master-off, disabled and manual drafts never contact a provider',async()=>{
  const count=requests.length;assert.equal((await api('/api/ai/providers/test',draft)).status,403);await enabled(true);
  assert.equal((await api('/api/ai/providers/test',{...draft,enabled:false})).status,409);
  assert.equal((await api('/api/ai/providers/test',{...draft,type:'manual_copy_paste'})).status,400);assert.equal(requests.length,count);
 });
 await check('E04/E09 unsaved current draft generates fixed text without persistence or a default provider',async()=>{
  const before=await snapshot();const response=await api('/api/ai/providers/test',draft);assert.equal(response.status,200,await response.clone().text());
  const data=await response.json();assert.equal(data.saved,false);assert.equal(data.requestedModel,'fixture-model');assert.equal(await snapshot(),before);
  assert.equal(requests.at(-1).path,'/custom/v1/chat/completions');assert.equal(requests.at(-1).authenticated,true);
  assert.deepEqual(requests.at(-1).body.messages,[{role:'system',content:'Reply with the single word OK.'},{role:'user',content:'Connection test only. No business data.'}]);
 });
 await check('E06/E07 real HTTP rejects unknown model, HTML and empty responses; retains custom prefix and returned model',async()=>{
  for(const model of ['invalid-model','html','empty']){const response=await api('/api/ai/providers/test',{...draft,defaultModel:model});assert.equal(response.status,502);assert.equal((await response.json()).ok,false);}
  const response=await api('/api/ai/providers/test',{...draft,defaultModel:'alias'});const result=await response.json();assert.equal(result.requestedModel,'alias');assert.equal(result.returnedModel,'actual-version');assert.match(result.message,/不同|differs/);
  assert(!requests.some(r=>r.path.endsWith('/models')));
 });
 await check('E05/E09 server boundary validates URL and origin before sending keys',async()=>{
  const n=requests.length;
  for(const url of [address+'/chat/completions',address+'?key=private','https://name:password@example.com/v1'])assert.equal((await api('/api/ai/providers/test',{...draft,baseUrl:url})).status,400);
  assert.equal((await api('/api/ai/providers/test',draft,'POST','https://foreign.example')).status,403);assert.equal(requests.length,n);
 });
 for(const [engine,type] of Object.entries({chromium,webkit})){
  const browser=await type.launch();try{
   const context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();const errors=[];page.on('pageerror',error=>{errors.push(error.message);console.error(JSON.stringify({pageError:error.message,stack:error.stack,stage:currentCheck,url:page.url()}));});page.on('requestfailed',request=>console.error(JSON.stringify({failed:request.url(),reason:request.failure(),stage:currentCheck})));
   await page.goto(base+'/ai',{waitUntil:'networkidle'});const form=page.locator('form:has(input[name="apiKey"])');
   await check(`${engine} E01/E02 DeepSeek preset and draft field validation`,async()=>{
    await form.getByRole('button',{name:/^(使用 DeepSeek|Use DeepSeek)$/,exact:true}).click();assert.equal(await form.locator('[name="type"]').inputValue(),'openai_compatible');assert.equal(await form.locator('[name="baseUrl"]').inputValue(),'https://api.deepseek.com');assert.equal(await form.locator('[name="defaultModel"]').inputValue(),'deepseek-flash');
    await form.getByRole('button',{name:/^(测试连接|Test connection)$/,exact:true}).click();assert.equal(await form.locator('[name="apiKey"]').evaluate(e=>document.activeElement===e),true);
   });
   const name=`Draft ${engine} ${randomUUID().slice(0,8)}`;
   await form.locator('[name="name"]').fill(name);await form.locator('[name="baseUrl"]').fill(address);await form.locator('[name="defaultModel"]').fill('fixture-model');await form.locator('[name="apiKey"]').fill(token);
   await check(`${engine} E03/E04 draft test is clickable before save and leaves configuration untouched`,async()=>{
    const before=await snapshot();await form.getByRole('button',{name:/^(测试连接|Test connection)$/,exact:true}).click();await form.getByRole('status').filter({hasText:/配置尚未保存|settings not saved yet/}).waitFor();assert.equal(await snapshot(),before);await page.screenshot({path:`${dir}/${engine}-draft-success.png`,fullPage:true});
   });
   await check(`${engine} E05 changing a draft target or protocol clears its typed key`,async()=>{
    await form.locator('[name="baseUrl"]').fill(address+'/other');assert.equal(await form.locator('[name="apiKey"]').inputValue(),'');
    await form.locator('[name="baseUrl"]').fill(address);await form.locator('[name="apiKey"]').fill(token);
    await form.locator('[name="type"]').selectOption('anthropic');assert.equal(await form.locator('[name="apiKey"]').inputValue(),'');
    await form.locator('[name="type"]').selectOption('openai_compatible');await form.locator('[name="apiKey"]').fill(token);
   });
   await check(`${engine} E08 editing in flight cancels only this test and invalidates late success`,async()=>{
    hold=true;const wait=reached();await form.getByRole('button',{name:/^(测试连接|Test connection)$/,exact:true}).click();await wait;assert.equal(await form.getByRole('button',{name:/^(正在测试…|Testing…)$/}).isDisabled(),true);
    await form.locator('[name="defaultModel"]').fill('invalid-model');release();await eventually(async()=>assert.equal(await form.getByRole('status').count(),0));
    await form.getByRole('button',{name:/^(测试连接|Test connection)$/,exact:true}).click();await form.getByRole('alert').filter({hasText:/模型不存在|model.*not found|Model.*not found/}).waitFor();assert.equal(await form.getByRole('status').count(),0);
   });
   await form.locator('[name="defaultModel"]').fill('fixture-model');
   currentCheck=`${engine} saving provider`;
   await Promise.all([page.waitForURL(/saved=provider/),form.getByRole('button',{name:/^(添加服务|Add service)$/,exact:true}).click()]);
   // Wait for the completed save page before opening its edit link. A forced
   // second navigation during hydration unloads WebKit's pending effect reads.
   await page.waitForLoadState('networkidle');
   const record=(await db.query('SELECT id,"updatedAt","apiKeyEncrypted" FROM "AIProvider" WHERE name=$1',[name])).rows[0];assert(record.apiKeyEncrypted.startsWith('v1:'));assert(!record.apiKeyEncrypted.includes(token));
   currentCheck=`${engine} opening saved provider`;
   await page.locator(`[data-provider-row="${record.id}"]`).getByRole('link',{name:/^(编辑|Edit)$/,exact:true}).click();
   await page.waitForURL(`**/ai?provider=${record.id}#providers`);await page.waitForLoadState('networkidle');record.revision=await form.locator('[name="revision"]').inputValue();
   await check(`${engine} E05 edit reuses saved key only for the same protocol and target`,async()=>{
    assert.equal(await form.locator('[name="apiKey"]').inputValue(),'');await form.getByRole('button',{name:/^(测试连接|Test connection)$/,exact:true}).click();await form.getByRole('status').filter({hasText:/配置尚未保存|settings not saved yet/}).waitFor();
    const stored={...draft,id:record.id,revision:record.revision,apiKey:''};const n=requests.length;
    for(const change of [{baseUrl:address+'/other'},{type:'anthropic'}]){const response=await api('/api/ai/providers/test',{...stored,...change});assert.equal(response.status,400);assert.equal((await response.json()).field,'apiKey');}assert.equal(requests.length,n);
    await form.locator('[name="baseUrl"]').fill(address+'/other');await form.getByRole('button',{name:/^(测试连接|Test connection)$/,exact:true}).click();assert.equal(await form.locator('[name="apiKey"]').evaluate(e=>document.activeElement===e),true);
    await form.locator('[name="apiKey"]').fill(token);await form.getByRole('button',{name:/^(测试连接|Test connection)$/,exact:true}).click();await form.getByRole('status').filter({hasText:/配置尚未保存|settings not saved yet/}).waitFor();assert.equal(requests.at(-1).path,'/custom/v1/other/chat/completions');
    await form.locator('[name="baseUrl"]').fill(address);await form.locator('[name="apiKey"]').fill('');assert(!(await page.content()).includes(token));
   });
   for(const width of [1440,1024,390])for(const theme of ['light','dark'])await check(`${engine} ${theme} ${width}px actual API form`,async()=>{
    await page.setViewportSize({width,height:1000});await page.evaluate(value=>document.documentElement.dataset.labnestMode=value,theme);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));const bounds=await form.locator('input:not([type="hidden"]),select,button').evaluateAll(elements=>elements.filter(e=>e.getBoundingClientRect().width).map(e=>({left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right})));assert(bounds.every(b=>b.left>=0&&b.right<=width));
    await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:`${dir}/${engine}-${theme}-${width}.png`,fullPage:true});
   });
   await check(`${engine} E08 master-off while testing blocks the late response`,async()=>{
    hold=true;const wait=reached();await form.getByRole('button',{name:/^(测试连接|Test connection)$/,exact:true}).click();await wait;await page.getByRole('switch',{name:/^(启用 AI|Enable AI)$/,exact:true}).click();await eventually(async()=>assert.equal((await settings()).enabled,false));release();await eventually(async()=>assert.equal(await form.getByRole('button',{name:/^(测试连接|Test connection)$/,exact:true}).isDisabled(),true));assert.equal(await form.getByRole('status').count(),0);await enabled(true);await page.reload({waitUntil:'networkidle'});
   });
   await check(`${engine} E08 a saved-provider change rejects an in-flight draft without changing another request`,async()=>{
    hold=true;const wait=reached();const pending=api('/api/ai/providers/test',{...draft,id:record.id,revision:record.revision,apiKey:''});await wait;
    await db.query('UPDATE "AIProvider" SET "defaultModel"=\'new-model\',"updatedAt"=now() WHERE id=$1',[record.id]);release();assert.equal((await pending).status,403);
    const stale=await api('/api/ai/providers/test',{...draft,id:record.id,revision:record.revision});assert.equal(stale.status,409);
    const unaffected=await api('/api/ai/providers/test',draft);assert.equal(unaffected.status,200);
    await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await form.getByRole('alert').filter({hasText:/配置已在其他页面改变|setup changed on another page/}).waitFor();assert.equal(await form.getByRole('button',{name:/^(保存服务|Save service)$/}).isDisabled(),true);
   });
   await check(`${engine} no unhandled page errors`,async()=>assert.deepEqual(errors,[]));await context.close();
  }finally{release();await browser.close();}
 }
 await check('E09 Dify tests actual application generation; Anthropic uses its own message contract',async()=>{
  for(const type of ['dify','anthropic']){const response=await api('/api/ai/providers/test',{...draft,type});assert.equal(response.status,200,await response.clone().text());const data=await response.json();assert.equal(data.verification,type==='dify'?'application':'model');}
 });
}finally{release();mock.closeAllConnections();await new Promise(resolve=>mock.close(resolve));await db.end();await writeFile(`${dir}/draft-report.json`,JSON.stringify(report,null,2));}
console.log(JSON.stringify({checks:report.checks.length,failures:report.checks.filter(c=>c.status==='failed').length,synthetic:true,liveProvider:false}));
