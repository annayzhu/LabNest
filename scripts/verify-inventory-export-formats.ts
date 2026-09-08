import 'dotenv/config';
import { request } from 'playwright';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { readSheet } from 'read-excel-file/node';
import { prisma } from '../src/lib/db';
async function main(){
 if(new URL(process.env.DATABASE_URL!).pathname!=='/labnest_stage_a_acceptance')throw new Error('Synthetic only');
 const base=process.env.LABNEST_ACCEPTANCE_URL??'http://localhost:3232';if(!['http://localhost:3232','http://localhost:3233'].includes(base))throw new Error('Isolated server only');
 const api=await request.newContext();const checks:string[]=[];
 const stock=await prisma.inventoryItem.create({data:{name:'Synthetic format stock',currentQuantity:180,unit:'mL',brand:'Brand A',lotNumber:'LOT-1'}});
 const purchase=await prisma.purchaseRequest.create({data:{title:'Synthetic format purchase',quantity:2,unit:'box',status:'received',actualAmount:'123.45'}});
 try{for(const [key,id,name,amount,unit] of [['inventory',stock.id,stock.name,'180','mL'],['purchases',purchase.id,purchase.title,'123.45','box']])for(const format of ['csv','xlsx','json']){
  const r=await api.get(`${base}/api/structured-export/${key}?format=${format}&exportScope=selected&id=${id}`);assert.equal(r.status(),200,await r.text());const bytes=await r.body();let content=bytes.toString();if(format==='xlsx'){const rows=await readSheet(bytes);assert.equal(rows.length,2);content=JSON.stringify(rows);}if(format==='json')assert.equal(JSON.parse(content).records.length,1);if(format==='csv')assert.equal(content.trim().split('\n').length,2);assert.ok(content.includes(name));assert.ok(content.includes(amount));assert.ok(content.includes(unit));if(key==='inventory'){assert.ok(content.includes('Brand A'));assert.ok(content.includes('LOT-1'));}
  writeFileSync(`docs/stage-20260908/A/evidence/${key}-selected.${format}`,bytes);checks.push(`${key} ${format}: selected scope, name, quantity/amount, unit and stock identity match`);
 }}finally{writeFileSync('docs/stage-20260908/A/evidence/export-formats.json',JSON.stringify({checks},null,2));await api.dispose();await prisma.$disconnect();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
