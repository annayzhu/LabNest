import {request} from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
const base='http://localhost:3232';
const fixture=JSON.parse(readFileSync('docs/stage-20260908/A/run-fixture.json'));
const api=await request.newContext({baseURL:base});
const endpoint=`/api/experiments/${fixture.experimentId}/materials`;
const id=crypto.randomUUID();
try {
 const saved=await api.post(endpoint,{headers:{Origin:base},data:{action:'save',id,name:'合成耗材：来源校验',unit:'mL',source:'manual'}});
 assert.equal(saved.status(),200,await saved.text());
 const rows=await (await api.get(endpoint)).json();
 assert.equal(rows.find(r=>r.id===id)?.name,'合成耗材：来源校验');
 const rejected=await api.post(endpoint,{headers:{Origin:'https://untrusted.example','x-forwarded-host':'untrusted.example'},data:{action:'save',id:crypto.randomUUID(),name:'不得保存',unit:'mL',source:'manual'}});
 assert.equal(rejected.status(),403);
 writeFileSync('docs/debug-20260909/evidence/origin-http.json',JSON.stringify({base,checks:['Browser Origin saves through HTTP and GET returns saved name','Untrusted Origin with forged forwarded host rejected'],fixture:fixture.experimentId},null,2));
} finally {await api.dispose();}
