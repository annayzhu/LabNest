import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createCipheriv, randomBytes, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import pg from 'pg';
const base = process.env.LABNEST_E2E_BASE_URL ?? 'http://localhost:3338';
const dbURL = new URL(process.env.DATABASE_URL);
assert(['labnest_ai_module_acceptance_20261014','labnest_ai_provider_acceptance_20261008','labnest_ai_connection_20261014'].includes(dbURL.pathname.slice(1)));
assert(['127.0.0.1','localhost'].includes(dbURL.hostname));
assert.notEqual(new URL(base).port, '3001');
const db = new pg.Client({ connectionString: dbURL.href });
const dir = process.env.AI_MODULE_EVIDENCE_DIR ?? 'docs/ai/20261014/evidence';
await mkdir(dir, { recursive: true });
const report = { synthetic: true, liveProvider: false, checks: [] };
const call = async (path, data, method = 'POST') => fetch(base + path, {method, headers:{origin:base,'content-type':'application/json'}, body:JSON.stringify(data)});
const settings = async () => (await fetch(base+'/api/ai/settings')).json();
const setEnabled = async enabled => {const saved=await settings();const r=await call('/api/ai/settings',{kind:'enabled',revision:saved.revision,enabled},'PATCH');assert.equal(r.status,200,await r.text());};
const token='synthetic-cancellation-token';
const iv=randomBytes(12), cipher=createCipheriv('aes-256-gcm',Buffer.from(process.env.LABNEST_AI_ENCRYPTION_KEY,'hex'),iv);
const encrypted=Buffer.concat([cipher.update(token,'utf8'),cipher.final()]);
const stored=['v1',iv.toString('base64'),cipher.getAuthTag().toString('base64'),encrypted.toString('base64')].join(':');
let release, entered, calls=0;
const mock=createServer(async(req,res)=>{for await(const chunk of req){void chunk;}calls++;entered?.();await new Promise(resolve=>{release=resolve;});res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({model:'fixture',choices:[{message:{content:JSON.stringify([{sourceType:'ai',actionType:'create_experiment',reason:'Synthetic',payload:{title:'Synthetic only'}}])}}]}));});
try {
 await db.connect();await new Promise(resolve=>mock.listen(4850,'127.0.0.1',resolve));
 const id='ai-cancel-'+randomUUID();
 await db.query('INSERT INTO "AIProvider" (id,name,type,"baseUrl","apiKeyEncrypted","defaultModel",enabled,"updatedAt") VALUES ($1,$2,$3,$4,$5,$6,true,now())',[id,'Cancellation fixture','openai_compatible','http://127.0.0.1:4850/v1',stored,'fixture']);
 await db.query('INSERT INTO "AISettings" (id,enabled,"defaultProviderId","attachmentsEnabled","updatedAt") VALUES (\'default\',true,$1,true,now()) ON CONFLICT(id) DO UPDATE SET enabled=true,"defaultProviderId"=$1,"attachmentsEnabled"=true,"updatedAt"=now()',[id]);
 const entry=await fetch(base+'/api/entries',{method:'POST',body:(()=>{const f=new FormData();f.set('title','Synthetic cancellation');f.set('contentMarkdown','Synthetic text only.');f.set('occurredAt',new Date().toISOString());f.set('recordStatus','draft');return f;})()});
 assert.equal(entry.status,201);const {entryId}=await entry.json();
 const reached=new Promise(resolve=>{entered=resolve;});
 const pending=call('/api/ai/generate',{entryId,persist:true,clientMutationId:randomUUID()});
 await Promise.race([reached,new Promise((_,reject)=>{const t=setTimeout(()=>reject(Error('Model not reached')),20000);t.unref();})]);
 await setEnabled(false);
 await setEnabled(true); // Re-enable cannot revive the previous request's consent.
 release();
 const result=await pending;
 assert.equal(result.status,403,await result.text());
 const record=await (await fetch(base+'/api/entries/'+entryId)).json();
 assert.equal(record.entry.pendingActions.length,0);
 report.checks.push({name:'off/on rejects late result and publishes no suggestions',status:'passed'});
 for (const scenario of ['queued-duplicate','workbench','connection-test']) {
  console.log('Checking',scenario);
  await setEnabled(true);
  const reached = new Promise(resolve => { entered = resolve; });
  const mutation = randomUUID();
  const countBefore = calls;
  const payload = scenario === 'workbench' ? {entryTitle:'Synthetic',entryBody:'Synthetic'} : {entryId,persist:true,clientMutationId:mutation};
  const path = scenario === 'connection-test' ? `/api/ai/providers/${id}/test` : '/api/ai/generate';
  const first = call(path,payload);
  await Promise.race([reached,first.then(async response=>{throw Error('Before provider: '+response.status+' '+await response.clone().text());}),new Promise((_,reject)=>{const t=setTimeout(()=>reject(Error('Provider was not reached')),20000);t.unref();})]);
  const second = scenario === 'queued-duplicate' ? call(path,payload) : undefined;
  await new Promise(resolve => setTimeout(resolve,100));
  await setEnabled(false);
  const stopped = await Promise.race([first,new Promise((_,reject)=>{const t=setTimeout(()=>reject(Error('In-flight request was not cancelled')),5000);t.unref();})]);
  assert.equal(stopped.status,403,await stopped.text());
  if(second) {const next=await second;assert.equal(next.status,403,await next.text());}
  release();
  assert.equal(calls,countBefore+1,'Queued request/fallback must not reach the provider after disable');
  report.checks.push({name:`${scenario}: disable aborts active HTTP, rejects late output, blocks queued dispatch`,status:'passed'});
 }

 // Block publication on the existing source graph, then revoke the provider.
 // This exercises the real HTTP/transaction path, not a mocked persistence layer.
 console.log('Checking publication race');
 await setEnabled(true);
 const blocker=new pg.Client({connectionString:dbURL.href});await blocker.connect();
 try {
  await blocker.query('BEGIN');await blocker.query('SELECT pg_advisory_xact_lock(20261006)');
  const reached=new Promise(resolve=>{entered=resolve;});
  const pending=call('/api/ai/generate',{entryId,persist:true,clientMutationId:randomUUID()});
  await reached;release();
  let blocked=false;
  for(let i=0;i<100;i++){
   const locks=await db.query('SELECT 1 FROM pg_locks WHERE locktype=\'advisory\' AND objid=20261006 AND NOT granted');
   if(locks.rowCount){blocked=true;break;}await new Promise(resolve=>setTimeout(resolve,50));
  }
  assert(blocked,'Publication must reach the graph lock before revocation');
  await db.query('UPDATE "AIProvider" SET enabled=false,"updatedAt"=clock_timestamp() WHERE id=$1',[id]);
  await blocker.query('COMMIT');
  const rejected=await pending;assert.equal(rejected.status,403,await rejected.text());
  const readback=await (await fetch(base+'/api/entries/'+entryId)).json();
  assert.equal(readback.entry.pendingActions.length,0,'A disabled provider must not publish queued suggestions');
  report.checks.push({name:'provider revocation while publication waits leaves no suggestions',status:'passed'});
 } finally {await blocker.query('ROLLBACK');await blocker.end();}
 await setEnabled(false);
 const before=calls;
 for(const path of ['/api/ai/generate','/api/ai/manual/prompt','/api/ai/manual/parse',`/api/ai/providers/${id}/test`]) {
  const r=await call(path,{entryTitle:'Synthetic',entryBody:'Synthetic',rawResponse:'[]'});
  assert.equal(r.status,403,`${path}: ${await r.text()}`);
 }
 const r=await fetch(base+'/api/protocols/recognize',{method:'POST',headers:{origin:base,'content-type':'application/json'},body:JSON.stringify({sourceId:'missing'})});assert.equal(r.status,403,await r.text());
 assert.equal(calls,before);
 report.checks.push({name:'all five existing AI HTTP paths blocked while disabled; no upstream request',status:'passed'});
 const read=await settings();assert.equal(read.defaultProviderId,id);assert.equal(read.attachmentsEnabled,true);
 report.checks.push({name:'off/on preserves provider and attachment choice',status:'passed'});
 console.log(JSON.stringify(report));
} finally {release?.();mock.closeAllConnections();await new Promise(resolve=>mock.close(resolve));await db.end();await writeFile(`${dir}/cancellation.json`,JSON.stringify(report,null,2));}
