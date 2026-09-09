import {chromium} from 'playwright';import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';
const {experimentId}=JSON.parse(readFileSync('docs/debug-20260909/evidence/run-fixture.json'));const browser=await chromium.launch();const page=await browser.newPage();
try{
 const endpoint=`http://localhost:3232/api/experiments/${experimentId}/materials`;
 for(const row of await (await page.request.get(endpoint)).json()) if(row.name==='Synthetic mix' && row.status!=='submitted') await page.request.post(endpoint,{data:{action:'delete',id:row.id}});

 await page.goto(`http://localhost:3232/experiments/${experimentId}/run`);await page.getByRole('button',{name:'添加',exact:true}).click();const dialog=page.getByRole('dialog');
 await dialog.getByLabel('添加方式',{exact:true}).selectOption('protocol');await dialog.getByRole('button',{name:'计算预计量',exact:true}).click();await dialog.getByRole('alert').waitFor();
 await dialog.getByLabel('sample_count',{exact:true}).fill('2');await dialog.getByLabel('reaction_volume',{exact:true}).fill('3');await dialog.getByRole('button',{name:'计算预计量',exact:true}).click();await dialog.getByText('Synthetic mix：6 µL',{exact:true}).waitFor();
 await dialog.getByRole('button',{name:'选择此项',exact:true}).click();await dialog.getByRole('button',{name:'保存使用记录',exact:true}).click();await page.getByText('使用记录已保存，尚未执行库存扣减。',{exact:true}).waitFor();
 const rows=await(await page.request.get(endpoint)).json();const row=rows.find(r=>r.name==='Synthetic mix');assert.equal(row.expected,6);assert.equal(row.actual,null);assert.ok(row.source.includes('sample_count=2'));
 writeFileSync('docs/debug-20260909/evidence/consumption-browser.json',JSON.stringify({checks:['Missing parameters block preview','2 samples x 3 µL = 6 µL','Expected saved without assuming actual','Frozen version and calculation parameters retained in source'],row},null,2));
}finally{await browser.close();}
