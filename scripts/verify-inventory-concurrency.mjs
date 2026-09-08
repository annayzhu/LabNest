import {acceptanceBase} from './stage-acceptance-env.mjs';
import {request} from 'playwright';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const f=JSON.parse(readFileSync('docs/stage-20260908/A/run-fixture.json'));const api=await request.newContext({baseURL:acceptanceBase});
try{
 for(let i=0;i<12;i++){
  const id=crypto.randomUUID();const endpoint=`/api/experiments/${f.experimentId}/materials`;const data={action:'save',id,name:'Synthetic concurrent material',actual:1,unit:'mL',source:'manual',inventoryItemId:f.inventoryItemId};
  assert.equal((await api.post(endpoint,{data})).status(),200);
  await Promise.all([api.post(endpoint,{data:{action:'confirm',ids:[id]}}),api.post(endpoint,{data:{...data,actual:2}})]);
  const rows=await (await api.get(endpoint)).json();const row=rows.find(r=>r.id===id);const stock=await (await api.get(`/api/inventory/${f.inventoryItemId}/containers`)).json();const tx=stock.transactions.find(t=>t.clientMutationId===id);
  assert.ok(tx,"Every iteration must execute a transaction");
  if(tx){assert.equal(row.status,'submitted','Existing transaction never returns to pending');assert.equal(tx.quantityChange,-row.actual,'Stored actual equals executed amount');}
 }
 for(let i=0;i<12;i++){
  const p=await (await api.post('/api/purchases',{data:{title:'Synthetic concurrency purchase',quantity:5,unit:'box',status:'ordered',clientMutationId:crypto.randomUUID()}})).json();
  const responses=await Promise.all([api.post('/api/purchases/'+p.id,{data:{action:'receive',quantity:5,inventory:'none',clientMutationId:crypto.randomUUID()}}),api.post('/api/purchases/'+p.id,{data:{action:'details',quantity:2,actualAmount:'2.00',clientMutationId:crypto.randomUUID()}})]);
  assert.ok(responses.some(r=>r.ok()),"At least one competing purchase operation succeeds");
  const saved=await (await api.get('/api/purchases/'+p.id)).json();assert.ok(saved.receipts.reduce((sum,r)=>sum+r.quantity,0)<=saved.quantity,'Receipt count never exceeds corrected order');
 }
 console.log('12 material save/confirm races and 12 purchase correction/receipt races preserve invariants');
}finally{await api.dispose();}
