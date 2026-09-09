import {chromium} from 'playwright';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const f=JSON.parse(readFileSync('docs/debug-20260909/evidence/run-fixture.json'));const browser=await chromium.launch();const page=await browser.newPage();
try{
 await page.goto(`http://localhost:3232/experiments/${f.experimentId}/run`);
 const area=page.locator('section').filter({has:page.getByRole('heading',{name:'本次使用的试剂与耗材',exact:true})}).last();
 await page.screenshot({path:'docs/debug-20260909/evidence/material-before.png',fullPage:true});
 await area.getByRole('button',{name:'添加',exact:true}).click({timeout:4000});
 const dialog=page.getByRole('dialog',{name:'添加耗材'});
 await dialog.getByLabel('名称',{exact:true}).fill('合成中文名称');
 await dialog.getByRole('button',{name:'保存使用记录',exact:true}).click();
 await page.getByText('使用记录已保存，尚未执行库存扣减。',{exact:true}).waitFor();
 await page.reload();assert.ok(await page.getByText('合成中文名称',{exact:true}).count());
 console.log('PASS dialog name-only save and browser refresh');
}finally{await browser.close();}
