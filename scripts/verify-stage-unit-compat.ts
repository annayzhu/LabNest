import 'dotenv/config';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFileSync,readFileSync} from 'node:fs';
import {prisma} from '../src/lib/db';
async function main(){
 assert.equal(new URL(process.env.DATABASE_URL!).pathname,'/labnest_stage_a_acceptance');
 const base='http://localhost:3235';const stamp=Date.now();
 const bottle=await prisma.inventoryItem.create({data:{name:'Synthetic bottle '+stamp,unit:'bottle',currentQuantity:5}});
 const unknown=await prisma.inventoryItem.create({data:{name:'Synthetic unknown '+stamp,unit:'未指定',currentQuantity:0,quantityRecorded:false,managementMode:'information'}});
 const browser=await chromium.launch();const page=await browser.newPage();
 try{
  await page.goto(base+`/inventory/${bottle.id}/edit`);assert.equal(await page.locator('input[name=currentQuantity]').inputValue(),'5');await page.getByRole('button',{name:/Save Item|Save Inventory|保存/}).last().click();await page.waitForURL(u=>!u.pathname.endsWith('/edit'));assert.equal((await prisma.inventoryItem.findUniqueOrThrow({where:{id:bottle.id}})).currentQuantity,5);
  await page.goto(base+`/inventory/${unknown.id}/edit`);await page.getByLabel('Current quantity单位',{exact:true}).selectOption('mL');await page.getByLabel('Current quantity',{exact:true}).fill('180');await page.locator('[name=countedAt]').fill('2026-09-08');await page.locator('[name=countedBy]').fill('Synthetic');await page.locator('[name=countSource]').fill('Synthetic physical count');await page.getByRole('button',{name:/Save Item|Save Inventory|保存/}).last().click();await page.waitForURL(u=>!u.pathname.endsWith('/edit'));const saved=await prisma.inventoryItem.findUniqueOrThrow({where:{id:unknown.id}});assert.equal(saved.unit,'mL');assert.equal(saved.currentQuantity,180);assert.equal(saved.quantityRecorded,true);
  await page.goto(base+'/inventory/new');await page.getByLabel('Opening quantity单位',{exact:true}).selectOption('mg');await page.getByLabel('Opening quantity',{exact:true}).fill('5');assert.equal(await page.locator('[name=currentQuantity]').inputValue(),'5');await page.getByLabel('Opening quantity',{exact:true}).fill('');await page.getByLabel('Opening quantity单位',{exact:true}).selectOption('__custom');await page.getByLabel('Opening quantity自定义单位').fill('支');await page.getByLabel('Opening quantity',{exact:true}).fill('3');assert.equal(await page.locator('[name=unit]').inputValue(),'支');
  const run=JSON.parse(readFileSync('docs/stage-20260908/A/run-fixture.json','utf8'));await page.goto(base+`/experiments/${run.experimentId}/run`);const area=page.getByRole('heading',{name:'本次使用的试剂与耗材'}).locator('..');await area.getByLabel('名称',{exact:true}).fill('Synthetic mass '+stamp);await area.getByLabel('实际单位',{exact:true}).selectOption('mg');await area.getByLabel('实际',{exact:true}).fill('5');const savedMaterial=page.waitForResponse(r=>r.url().includes('/materials')&&r.request().method()==='POST');await area.getByRole('button',{name:'保存使用记录',exact:true}).click();assert((await savedMaterial).ok());await page.reload();await page.getByText('Synthetic mass '+stamp,{exact:true}).waitFor();const response=await page.request.get(base+`/api/experiments/${run.experimentId}/materials`);const mass=(await response.json()).find((row:{name:string})=>row.name==='Synthetic mass '+stamp);assert.equal(mass.unit,'mg');assert.equal(mass.actual,5);
  writeFileSync('docs/stage-20260908/B/evidence/unit-compat.json',JSON.stringify({checks:['Run manual5mg save/reload/API readback','Existing5bottle save/read retains5','Unknown first count establishes180mL and preserves audit','Empty quantity chooses mass or custom units without fabricated conversion']},null,2));
 }finally{await browser.close();await prisma.$disconnect();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
