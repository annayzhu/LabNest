import {request} from 'playwright';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const f=JSON.parse(readFileSync('docs/debug-20260909/evidence/run-fixture.json'));const api=await request.newContext({baseURL:'http://localhost:3232'});const url=`/api/experiments/${f.experimentId}/materials`;
try{
 const id=crypto.randomUUID();let r=await api.post(url,{data:{action:'save',id,name:'只记录名称'}});assert.equal(r.status(),200,await r.text());
 r=await api.post(url,{data:{action:'delete',id}});assert.equal(r.status(),200,await r.text());
 const rows=await(await api.get(url)).json();assert.equal(rows.some(x=>x.id===id),false);
 console.log('PASS name-only save, explicit delete and GET readback');
}finally{await api.dispose();}
