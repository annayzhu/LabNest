import {request} from 'playwright';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const f=JSON.parse(readFileSync('docs/stage-20260908/A/run-fixture.json'));const api=await request.newContext({baseURL:'http://localhost:3232'});const url=`/api/experiments/${f.experimentId}/materials`;
try {
 const post=async data=>{const r=await api.post(url,{data});assert.equal(r.status(),200,await r.text());return r.json();};
 const original=crypto.randomUUID();await post({action:'save',id:original,name:'更正回归',actual:10,unit:'mL',inventoryItemId:f.inventoryItemId});
 assert.equal((await post({action:'confirm',ids:[original]}))[0].status,'submitted');
 const corrections=[crypto.randomUUID(),crypto.randomUUID()];
 const saves=await Promise.all(corrections.map(id=>api.post(url,{data:{action:'save',id,name:'更正回归',actual:5,unit:'mL',inventoryItemId:f.inventoryItemId,correctionOfId:original}})));
 assert.deepEqual(saves.map(r=>r.status()).sort(),[200,409]);
 const correction=await saves.find(r=>r.status()===200).json();
 const outcomes=await Promise.all([post({action:'confirm',ids:[correction.id]}),post({action:'confirm',ids:[correction.id]})]);
 assert.ok(outcomes.flat().every(x=>x.status==='submitted'));
 const deletion=await api.post(url,{data:{action:'delete',id:original}});assert.equal(deletion.status(),409);
 console.log('PASS concurrent sibling correction cannot duplicate stock adjustment; posted original cannot be deleted');
} finally {await api.dispose();}
