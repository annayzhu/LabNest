import 'dotenv/config';
import { request } from 'playwright';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { readSheet } from 'read-excel-file/node';
import { prisma } from '../src/lib/db';
async function main(){
 if(new URL(process.env.DATABASE_URL!).pathname!=='/labnest_stage_a_acceptance')throw new Error('Synthetic only');
 const base=process.env.LABNEST_ACCEPTANCE_URL??'http://localhost:3232';if(!['http://localhost:3232','http://localhost:3233'].includes(base))throw new Error('Isolated server only');
 const api=await request.newContext();const supplier='Synthetic export '+Date.now();const inquiry=await prisma.procurementInquiry.create({data:{title:supplier}});
 const line=await prisma.procurementQuoteLine.create({data:{inquiryId:inquiry.id,supplierName:supplier,productName:'Synthetic tube',quantity:2,packageUnit:'box',status:'selected'}});
 try{
  const url=base+'/purchases/school-template?supplier='+encodeURIComponent(supplier);
  assert.equal((await api.get(url)).status(),422,'Required template fields cannot silently become zero');
  await prisma.procurementQuoteLine.update({where:{id:line.id},data:{productCategory:'耗材',amountExclTax:100,taxAmount:13}});
  const response=await api.get(url);assert.equal(response.status(),200);const bytes=await response.body();const rows=await readSheet(bytes);assert.ok(rows.some(r=>r.includes('Synthetic tube')&&r.includes(100)&&r.includes(13)&&r.includes(2)));
  const snapshot=response.headers()['x-export-snapshot'];assert.ok(snapshot);
  await prisma.procurementQuoteLine.update({where:{id:line.id},data:{amountExclTax:200}});
  assert.deepEqual(await (await api.get(base+'/purchases/school-template?snapshot='+snapshot)).body(),bytes);
  writeFileSync('docs/stage-20260908/A/evidence/school-export.xlsx',bytes);
  writeFileSync('docs/stage-20260908/A/evidence/school-export.json',JSON.stringify({checks:['Missing category/money rejected at export','XLSX parsed: product, quantity2, ex-tax100 and tax13 match','After price change, snapshot returns identical bytes']},null,2));
 }finally{await api.dispose();await prisma.$disconnect();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
