import {chromium} from 'playwright';
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const fixture=JSON.parse(await readFile('docs/debug-20260910/evidence/synthetic-run.json','utf8'));
const browser=await chromium.launch();let page;const report=[];
try {
 for(const [width,height] of [[320,568],[360,640],[390,844],[430,932],[844,390],[1440,1000]]) {
  page=await browser.newPage({viewport:{width,height}});await page.goto(fixture.runUrl,{waitUntil:'networkidle'});
  const content=page.locator('[data-run-step-content]:visible').first();await content.waitFor();
  const text=await content.innerText();assert(text.includes('10 µL'));assert(text.includes('Table note'));assert(!text.includes('Material table belongs to step B'));
  await content.locator('img').evaluate(image=>new Promise((resolve,reject)=>{if(image.complete&&image.naturalWidth>0)return resolve(true);const timeout=setTimeout(()=>reject(Error('Image load timeout')),10000);image.addEventListener('load',()=>{clearTimeout(timeout);if(image.naturalWidth>0)resolve(true);else reject(Error('Empty image'));},{once:true});image.addEventListener('error',()=>{clearTimeout(timeout);reject(Error('Image request failed'));},{once:true});}));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:`docs/debug-20260910/evidence/run-${width}.png`,fullPage:true});
  report.push({width,height,firstTableRows:await content.locator('table tr').count(),bodyY:await content.evaluate(el=>el.getBoundingClientRect().y),status:'passed'});
  if(width<1024){await page.getByRole('button',{name:'Next',exact:true}).click();assert((await content.innerText()).includes('Material table belongs to step B'));assert(!(await content.innerText()).includes('Table note'));await page.getByRole('button',{name:'Next',exact:true}).click();const table=content.locator('table');assert.equal(await table.locator('tbody tr').count(),25);assert((await table.locator('tr').last().innerText()).includes('Row 24 col 7'));const scroll=content.locator('.editorial-scrollbar');const metrics=await scroll.evaluate(el=>{el.scrollLeft=el.scrollWidth;return{scroll:el.scrollLeft,width:el.clientWidth,total:el.scrollWidth}});assert(metrics.scroll>0);report.push({width,wideTable:metrics,status:'passed'});}
 }
} catch(error){report.push({status:'failed',error:String(error)});throw error;}finally{await writeFile('docs/debug-20260910/evidence/run-browser.json',JSON.stringify(report,null,2));await browser.close();}
