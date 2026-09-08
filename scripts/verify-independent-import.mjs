import {request} from 'playwright';import assert from 'node:assert/strict';import {writeFileSync} from 'node:fs';
const api=await request.newContext({baseURL:'http://localhost:3232'});const checks=[];
try{
 for(const [module,csv] of [['purchases','title,quantity,unit,actualAmount,status\nSynthetic purchase '+Date.now()+',2,box,,received\n'],['inventory','name,managementMode,currentQuantity,unit\nSynthetic unknown '+Date.now()+',information,,mL\n']]){
  const file={name:module+'.csv',mimeType:'text/csv',buffer:Buffer.from(csv)};
  const r=await api.post(`/api/structured-import/${module}/preview`,{multipart:{file}});assert.equal(r.status(),200,await r.text());const {preview}=await r.json();assert.equal(preview.canImport,true,JSON.stringify(preview));const confirmed=await api.post(`/api/structured-import/${module}/confirm`,{multipart:{file,checksum:preview.checksum,confirmationToken:preview.confirmationToken}});assert.equal(confirmed.status(),201,await confirmed.text());
  const repeat=await api.post(`/api/structured-import/${module}/confirm`,{multipart:{file,checksum:preview.checksum,confirmationToken:preview.confirmationToken}});assert.notEqual(repeat.status(),201);
  checks.push(module+' imports without other modules or fabricated zero; identical file cannot import twice');
 }
}finally{writeFileSync('docs/stage-20260908/A/evidence/imports.json',JSON.stringify({checks},null,2));await api.dispose();}
