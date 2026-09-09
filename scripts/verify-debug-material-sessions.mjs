import {chromium} from 'playwright';import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';
const {experimentId}=JSON.parse(readFileSync('docs/debug-20260909/evidence/run-fixture.json'));const browser=await chromium.launch();const page=await browser.newPage();const base='http://localhost:3232';const endpoint=`${base}/api/experiments/${experimentId}/materials`;
try {
 const id=crypto.randomUUID(),name=`Synthetic original ${id.slice(0,6)}`;
 let response=await page.request.post(endpoint,{data:{action:'save',id,name}});assert.equal(response.status(),200);
 await page.goto(`${base}/experiments/${experimentId}/run`,{waitUntil:'networkidle'});
 const row=page.getByRole('row').filter({hasText:name});await row.getByRole('button',{name:'编辑',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByLabel('名称',{exact:true}).fill(name+' draft');await dialog.getByRole('button',{name:'关闭',exact:true}).click();
 await row.getByRole('button',{name:'编辑',exact:true}).click();assert.equal(await dialog.getByLabel('名称',{exact:true}).inputValue(),name+' draft');await dialog.getByRole('button',{name:'关闭',exact:true}).click();
 await page.getByRole('button',{name:'添加',exact:true}).click();assert.equal(await dialog.getByLabel('名称',{exact:true}).inputValue(),'');await dialog.getByLabel('名称',{exact:true}).fill(name+' new');await dialog.getByRole('button',{name:'保存使用记录',exact:true}).click();await page.getByText('使用记录已保存，尚未执行库存扣减。',{exact:true}).waitFor();
 const rows=await(await page.request.get(endpoint)).json();assert.equal(rows.find(r=>r.id===id).name,name);assert.ok(rows.some(r=>r.name===name+' new' && r.id!==id));
 await row.getByRole('button',{name:'编辑',exact:true}).click();assert.equal(await dialog.getByLabel('名称',{exact:true}).inputValue(),name+' draft');
 await page.route('**/api/experiments/*/materials',route=>route.request().method()==='POST'?route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'合成保存失败，请重试'})}):route.continue());await dialog.getByRole('button',{name:'保存使用记录',exact:true}).click();await dialog.getByRole('alert').filter({hasText:'合成保存失败'}).waitFor();assert.equal(await dialog.getByLabel('名称',{exact:true}).inputValue(),name+' draft');
 writeFileSync('docs/debug-20260909/evidence/material-sessions.json',JSON.stringify({checks:['Edit-close-add creates distinct identity','Original record unchanged','Unsubmitted edit draft restored','Save error visible inside modal and draft retained']},null,2));
}finally{await browser.close();}
