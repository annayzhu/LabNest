import {acceptanceBase} from './stage-acceptance-env.mjs';
import {request} from 'playwright';import assert from 'node:assert/strict';import {writeFileSync} from 'node:fs';
const api=await request.newContext({baseURL:acceptanceBase});const checks=[];
try{
 let r=await api.post('/api/purchases',{data:{title:'Synthetic independent purchase '+Date.now(),quantity:5,unit:'瓶',status:'ordered',actualAmount:'420.00',invoiceStatus:'pending',clientMutationId:crypto.randomUUID()}});assert.equal(r.status(),201);const purchase=await r.json();
 const key=crypto.randomUUID();const data={action:'receive',quantity:2,inventory:'none',clientMutationId:key};r=await api.post('/api/purchases/'+purchase.id,{data});assert.equal(r.status(),200);r=await api.post('/api/purchases/'+purchase.id,{data});assert.equal(r.status(),200);
 let saved=await (await api.get('/api/purchases/'+purchase.id)).json();assert.equal(saved.receipts.length,1);assert.equal(saved.receipts[0].inventoryItemId,null);assert.equal(saved.status,'ordered');
 r=await api.post('/api/purchases/'+purchase.id,{data:{action:'receive',quantity:3,inventory:'new',clientMutationId:crypto.randomUUID()}});assert.equal(r.status(),200);
 saved=await (await api.get('/api/purchases/'+purchase.id)).json();assert.equal(saved.status,'received');assert.equal(saved.invoiceStatus,'pending');assert.equal(saved.receipts.length,2);
 checks.push('Independent order: receive 2 without stock then 3 into new stock; replay is idempotent; invoice remains pending');
 r=await api.get('/api/purchases/export');assert.equal(r.status(),200);const csv=await r.text();assert.ok(csv.includes('420.00'));assert.ok(csv.includes(purchase.id));checks.push('Actual purchasing export includes actual amount and stable record ID');
}finally{writeFileSync('docs/stage-20260908/A/evidence/purchases.json',JSON.stringify({checks},null,2));await api.dispose();}
