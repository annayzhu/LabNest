import {acceptanceBase} from './stage-acceptance-env.mjs';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
const base=acceptanceBase;
const browser=await chromium.launch();const page=await browser.newPage();
const results=[];
try {
 await page.goto(base+'/inventory/new');
 await page.getByLabel('Item name *',{exact:true}).fill('Synthetic medium '+Date.now());
 await page.getByRole('button',{name:'物料属性',exact:true}).click();
 await page.getByLabel('管理方式 / Management',{exact:true}).selectOption('package');
 await page.getByLabel('Opening quantity单位',{exact:true}).selectOption('bottle');
 await page.getByLabel('Opening quantity',{exact:true}).fill('5');
 await page.getByRole('button',{name:'收起属性',exact:true}).click();
 await page.getByRole('button',{name:'Register Item',exact:true}).click();
 await page.waitForURL(url=>/^\/inventory\/[^/]+$/.test(url.pathname)&&url.pathname!=='/inventory/new');
 const itemId=new URL(page.url()).pathname.split('/').at(-1);
 async function request(data){return page.request.post(base+'/api/inventory/'+itemId+'/containers',{data});}
 const state=async()=> (await page.request.get(base+'/api/inventory/'+itemId+'/containers')).json();
 let inventory=await state();assert.equal(inventory.containers.length,5);
 const bottleId=inventory.containers[0].id;
 let key=crypto.randomUUID();
 let response=await request({action:'issue',containerId:bottleId,holder:'张三',location:'培养间',clientMutationId:key});assert.equal(response.status(),200);
 response=await request({action:'issue',containerId:bottleId,holder:'张三',location:'培养间',clientMutationId:key});assert.equal(response.status(),200);
 inventory=await state();assert.equal(inventory.warehouse,4);assert.equal(inventory.held,1);assert.equal(inventory.containers.find(c=>c.id===bottleId).openedAt,null);
 results.push('5 bottles -> warehouse 4, Zhang 1; replay does not issue twice or imply opened/consumed');
 const {experimentId}=JSON.parse(readFileSync('docs/debug-20260909/evidence/run-fixture.json'));const materialId=crypto.randomUUID();
 response=await page.request.post(`${base}/api/experiments/${experimentId}/materials`,{data:{action:'save',id:materialId,name:'Synthetic held bottle '+itemId,actual:5,unit:'mL',inventoryItemId:itemId,containerId:bottleId}});assert.equal(response.status(),200);
 response=await page.request.post(`${base}/api/experiments/${experimentId}/materials`,{data:{action:'confirm',ids:[materialId]}});assert.equal(response.status(),200);assert.equal((await state()).warehouse,4);
 await page.goto(`${base}/experiments/${experimentId}/run`);const material=page.getByRole('row').filter({hasText:'Synthetic held bottle '+itemId});await material.locator('summary').click();await material.getByText('持有人：张三',{exact:true}).waitFor();await material.getByRole('link',{name:'查看持有状态与余量观察'}).click();await page.waitForURL(`${base}/inventory/${itemId}`);
 results.push('Run held-bottle use retains Zhang holder and links to remaining observations; confirmation does not deduct another bottle');

 for(const data of [
  {action:'open',openedAt:'2026-09-08'},
  {action:'observe',remaining:250,unit:'mL',quality:'estimated',performedBy:'张三'},
  {action:'observe',remaining:180,unit:'mL',quality:'estimated',performedBy:'张三'},
  {action:'transfer',holder:'李四',location:'另一培养间'},
  {action:'return',location:'仓库'},
 ]) { response=await request({...data,containerId:bottleId,clientMutationId:crypto.randomUUID()});assert.equal(response.status(),200,await response.text()); }
 inventory=await state();assert.equal(inventory.warehouse,5);assert.equal(inventory.containers.length,5);
 const bottle=inventory.containers.find(c=>c.id===bottleId);assert.ok(bottle.openedAt);assert.equal(bottle.observations[0].remaining,180);assert.equal(bottle.observations.length,2);
 assert.equal(inventory.transactions.some(t=>t.quantityChange===-70),false);
 results.push('Opening, transfer and return preserve ID, opened date and both observations; 250 -> 180 never consumes 70');
 response=await request({action:'empty',containerId:bottleId,clientMutationId:crypto.randomUUID()});assert.equal(response.status(),200);
 inventory=await state();assert.equal(inventory.warehouse,4);assert.equal(inventory.empty,1);
 await page.reload();assert.ok(await page.getByText('余量未记录',{exact:false}).count());
 results.push('Empty bottle is unavailable but retained');
}finally{mkdirSync('docs/debug-20260909/evidence/inventory',{recursive:true});writeFileSync('docs/debug-20260909/evidence/inventory/containers.json',JSON.stringify({results},null,2));await browser.close();}
