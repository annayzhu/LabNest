import {acceptanceBase} from './stage-acceptance-env.mjs';
import {request} from 'playwright';import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';
const f=JSON.parse(readFileSync('docs/debug-20260909/evidence/material-boundary-fixture.json'));const api=await request.newContext({baseURL:acceptanceBase});const endpoint=`/api/experiments/${f.experimentId}/materials`;const checks=[];
try{
 const create=async data=>{const r=await api.post(endpoint,{data:{action:'save',...data}});assert.equal(r.status(),200,await r.text());return r.json();};
 const free=await create({id:crypto.randomUUID(),name:'Unmanaged water',expected:15,actual:12,unit:'mL',source:'manual'});
 const managed=await create({id:crypto.randomUUID(),name:'Buffer',expected:10,actual:12000,unit:'µL',inventoryItemId:f.inventoryItemId,source:'manual'});
 let r=await api.post(endpoint,{data:{action:'confirm',ids:[free.id,managed.id]}});assert.equal(r.status(),200);let results=await r.json();assert.equal(results.find(r=>r.id===managed.id).status,'submitted');
 r=await api.post(endpoint,{data:{action:'confirm',ids:[managed.id]}});assert.equal(r.status(),200);
 const failed=await create({id:crypto.randomUUID(),name:'Buffer excessive',actual:200,unit:'mL',inventoryItemId:f.inventoryItemId,source:'manual'});
 r=await api.post(endpoint,{data:{action:'confirm',ids:[failed.id]}});results=await r.json();assert.equal(results[0].status,'pending');
 const rows=await (await api.get(endpoint)).json();assert.equal(rows.find(r=>r.id===managed.id).expected,10);assert.equal(rows.find(r=>r.id===managed.id).actual,12000);assert.equal(rows.find(r=>r.id===free.id).status,'recorded');assert.equal(rows.length,3);
 const incompatible=await create({id:crypto.randomUUID(),name:'Synthetic incompatible mass',actual:1,unit:'mg',inventoryItemId:f.inventoryItemId,source:'manual'});r=await api.post(endpoint,{data:{action:'confirm',ids:[incompatible.id]}});assert.equal((await r.json())[0].status,'pending');checks.push('Incompatible mass/volume units stay pending');
 checks.push('Mixed unmanaged and precise rows save independently; 12000µL confirms once; insufficient 200mL stays pending without losing rows');
}finally{writeFileSync('docs/debug-20260909/evidence/material-boundaries.json',JSON.stringify({checks},null,2));await api.dispose();}
