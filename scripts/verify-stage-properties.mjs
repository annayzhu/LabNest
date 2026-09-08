import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const base=process.env.LABNEST_ACCEPTANCE_URL??'http://localhost:3234';
if(!['http://localhost:3234','http://localhost:3235'].includes(base))throw Error('Isolated server only');
const browser=await chromium.launch();
try{
 const page=await browser.newPage();await page.goto(base+'/inventory/new');
 await page.getByRole('button',{name:'物料属性',exact:true}).click({timeout:5000});
 const panel=page.getByRole('complementary',{name:'物料属性'});
 await panel.getByLabel('Category',{exact:true}).selectOption('consumable');
 await panel.getByRole('button',{name:'收起属性'}).click();
 await page.getByRole('button',{name:'物料属性',exact:true}).click();
 assert.equal(await panel.getByLabel('Category',{exact:true}).inputValue(),'consumable');
 await panel.getByRole('button',{name:'固定展开'}).click();
 assert.equal(await panel.getAttribute('data-pinned'),'true');
 await panel.getByRole('button',{name:'收起属性'}).click();
 console.log('Properties close/reopen preserves draft; pin works');
}finally{await browser.close();}
