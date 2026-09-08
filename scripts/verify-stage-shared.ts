import 'dotenv/config';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { prisma } from '../src/lib/db';
async function main(){
 if(new URL(process.env.DATABASE_URL!).pathname!=='/labnest_stage_a_acceptance')throw Error('Synthetic only');
 const base=process.env.LABNEST_ACCEPTANCE_URL??'http://localhost:3234';if(!['http://localhost:3234','http://localhost:3235'].includes(base))throw Error('Isolated server only');
 const stamp=Date.now();const project=await prisma.project.create({data:{name:'Synthetic B '+stamp}});
 const protocols=await Promise.all(Array.from({length:8},(_,i)=>prisma.protocol.create({data:{title:`Synthetic B ${stamp} P${i}`,humanCode:`B-${stamp}-${i}`}})));
 const plan=await prisma.researchPlan.create({data:{code:'RP-B-'+stamp,title:'Synthetic B plan '+stamp,projectId:project.id,protocols:{create:protocols.slice(0,6).map(p=>({protocolId:p.id}))}}});
 const browser=await chromium.launch();const page=await browser.newPage();const checks:string[]=[];
 try{
  await page.goto(base+'/inventory/new');await page.getByRole('button',{name:'物料属性',exact:true}).click();await page.getByLabel('Category',{exact:true}).selectOption('consumable');await page.getByRole('button',{name:'收起属性'}).click();await page.getByRole('button',{name:'物料属性',exact:true}).click();assert.equal(await page.getByLabel('Category',{exact:true}).inputValue(),'consumable');await page.getByRole('button',{name:'收起属性'}).click();
  await page.getByLabel('Opening quantity',{exact:true}).fill('180');await page.getByLabel('Opening quantity单位',{exact:true}).selectOption('µL');assert.equal(await page.getByLabel('Opening quantity',{exact:true}).inputValue(),'180000');
  await page.getByLabel('Opening quantity',{exact:true}).fill('1e');assert.equal(await page.getByLabel('Opening quantity',{exact:true}).inputValue(),'1e');assert.equal(await page.getByLabel('Opening quantity',{exact:true}).evaluate((e:HTMLInputElement)=>e.checkValidity()),false);
  await page.getByLabel('Opening quantity',{exact:true}).fill('-1');assert.equal(await page.getByLabel('Opening quantity',{exact:true}).evaluate((e:HTMLInputElement)=>e.checkValidity()),false);await page.getByLabel('Opening quantity',{exact:true}).fill('');assert.equal(await page.locator('input[name="currentQuantity"]').inputValue(),'');checks.push('Property draft retained;180mL→180000µL; incomplete exponent kept but invalid; negative rejected; empty stays empty');
  await page.goto(base+`/research-plans/${plan.id}/edit`);await page.getByLabel('Research Plan title',{exact:true}).fill('Synthetic unsaved B '+stamp);
  await page.getByRole('tab',{name:/Metadata|元数据/}).click(); await page.getByRole('region',{name:'关联 Protocol 摘要'}).waitFor({state:'visible'}); assert.equal(await page.getByRole('region',{name:'关联 Protocol 摘要'}).locator('li').count(),3);
  await page.getByRole('button',{name:'管理全部（6）'}).click();await page.getByLabel('搜索关联 Protocol').fill(String(stamp));await page.getByLabel('关联筛选').selectOption('available');await page.getByLabel('选择当前筛选全部').check();await page.getByRole('button',{name:'批量添加',exact:true}).click();assert.equal(await page.locator('input[name="protocolIds"]').count(),8);
  await page.getByLabel('关联筛选').selectOption('linked');await page.getByLabel(`选择 ${protocols[0].title}`,{exact:true}).check();await page.getByRole('button',{name:'解除所选关联'}).click();assert.equal(await page.locator('input[name="protocolIds"]').count(),7);await page.getByRole('button',{name:'完成管理'}).click();assert.equal(await page.getByLabel('Research Plan title',{exact:true}).inputValue(),'Synthetic unsaved B '+stamp);
   await page.getByRole('button',{name:/Save Research Plan|保存研究/}).click();await page.waitForURL(base+`/research-plans/${plan.id}`);
  const saved=await prisma.researchPlan.findUniqueOrThrow({where:{id:plan.id},include:{protocols:true}});assert.equal(saved.protocols.length,7);assert.equal(saved.title,'Synthetic unsaved B '+stamp);assert.equal(await prisma.protocol.count({where:{id:{in:protocols.map(p=>p.id)}}}),8);checks.push('Eight protocols: sidebar3, search/filter/bulk add/remove, unsaved title retained, save/reload7 associations and8 originals');
  writeFileSync('docs/stage-20260908/B/evidence/shared.json',JSON.stringify({planId:plan.id,checks},null,2));
 }catch(error){console.log(await page.locator('[role=alert]').allTextContents()); console.log(await page.locator('input[name=title],select[name=projectId],input[name=protocolIds]').evaluateAll(es=>es.map(e=>({name:(e as HTMLInputElement).name,form:(e as HTMLInputElement).form?.id,value:(e as HTMLInputElement).value}))));throw error;}finally{await browser.close();await prisma.$disconnect();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
