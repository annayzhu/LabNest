import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const base=process.env.LABNEST_ACCEPTANCE_URL??'http://localhost:3234';assert(['http://localhost:3234','http://localhost:3235'].includes(base));
const browser=await chromium.launch();const page=await browser.newPage();const tools=['qpcr-plate-layout','cnv-plate-layout','qpcr-analysis','cnv-analysis'];const checks=[];
try{for(const id of tools){await page.goto(base+'/tools/'+id);const iframe=page.locator('iframe');await iframe.waitFor({timeout:5000});const frame=page.frameLocator('iframe');await frame.locator('body').waitFor();checks.push({id,text:(await frame.locator('body').innerText()).slice(0,2000)});await page.getByRole('link',{name:'返回工具目录',exact:true}).click();await page.waitForURL(base+'/tools');}writeFileSync('docs/stage-20260908/D/evidence/tools-inventory.json',JSON.stringify(checks,null,2));}finally{await browser.close();}
