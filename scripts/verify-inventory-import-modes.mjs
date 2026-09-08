import {request} from 'playwright';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const f=JSON.parse(readFileSync('docs/stage-20260908/A/run-fixture.json'));const api=await request.newContext({baseURL:'http://localhost:3232'});
try{
 for(const [mode,quantity,expected] of [['balance',180,180],['arrival',20,200]]){
 const file={name:'inventory-'+mode+'.csv',mimeType:'text/csv',buffer:Buffer.from(`name,inventoryId,importMode,currentQuantity,unit\nSynthetic buffer,${f.inventoryItemId},${mode},${quantity},mL\n`)};
 const r=await api.post('/api/structured-import/inventory/preview',{multipart:{file}});const {preview}=await r.json();assert.ok(preview.canImport,JSON.stringify(preview));
 const confirmed=await api.post('/api/structured-import/inventory/confirm',{multipart:{file,checksum:preview.checksum,confirmationToken:preview.confirmationToken}});assert.equal(confirmed.status(),201,await confirmed.text());
 const stock=await (await api.get(`/api/inventory/${f.inventoryItemId}/containers`)).json();assert.equal(stock.currentQuantity,expected,mode+' updates explicit existing ID with correct meaning');
 }
}finally{await api.dispose();}
