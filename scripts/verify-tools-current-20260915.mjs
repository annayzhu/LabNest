import {chromium} from 'playwright';import assert from 'node:assert/strict';import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.LABNEST_E2E_BASE_URL||'http://localhost:3240',out='docs/calculator/ui-20260915/evidence/tools';await mkdir(out,{recursive:true});const browser=await chromium.launch(),page=await browser.newPage(),checks=[];
try{for(const width of [1440,390])for(const id of ['calculator','qpcr-plate-layout','cnv-plate-layout','qpcr-analysis','cnv-analysis','free-plate-layout','visualization']){
 await page.setViewportSize({width,height:900});await page.goto(base+'/tools');const href=id==='free-plate-layout'?'/tools/free-plate-layout/index.html?v=20260826-2':'/tools/'+id;
 const link=page.locator(`a[href="${href}"]`).first();assert.ok(await link.count(),id+' Tools link');await link.click();await page.waitForLoadState('networkidle');
 const errors=[];const iframe=page.locator('iframe[src^="/tools/"]');if(['qpcr-plate-layout','cnv-plate-layout','qpcr-analysis','cnv-analysis'].includes(id)){
  assert.equal(await iframe.count(),1);const box=await iframe.boundingBox();assert(box.width>=width-2,id+' full width');assert.equal(await page.locator('aside').count(),0,id+' no shell sidebar');
  const frame=page.frames().find(frame=>frame.url().includes('/index.html'));assert(frame,id+' actual inner page');const text=await frame.locator('body').innerText();assert(text.length>200,id+' loaded real tool');assert(!text.includes('404: This page could not be found'));
  if(id==='qpcr-plate-layout')assert.equal(await frame.locator('textarea.sample-batch-box').count(),1);if(id==='cnv-plate-layout')assert.equal(await frame.locator('textarea.bulk-input').count(),1);
 }
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,id+' outer overflow');await page.screenshot({path:`${out}/${id}-${width}.png`,fullPage:false});checks.push({id,width,url:page.url(),status:'passed',errors});console.log('passed',id,width);
}}finally{await writeFile(`${out}/report.json`,JSON.stringify({base,at:new Date().toISOString(),checks},null,2));await browser.close();}
