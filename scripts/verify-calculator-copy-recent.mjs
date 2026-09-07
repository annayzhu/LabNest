import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const dir='docs/calculator/v1.3/evidence/copy-recent';mkdirSync(dir,{recursive:true});
const browser=await chromium.launch();const context=await browser.newContext({permissions:['clipboard-read','clipboard-write']});const page=await context.newPage();const base=process.env.LABNEST_E2E_BASE_URL||'http://localhost:3224';
const report={base,at:new Date().toISOString(),checks:[],unexecuted:['Real phone 160% pinch zoom']};
try{
 await page.goto(base+'/tools/calculator');await page.waitForSelector('.calculator-categories');
 const ids=await page.locator('.calculator-category-tools .calculator-tool-tile').evaluateAll(nodes=>nodes.slice(0,7).map(n=>new URL(n.href).pathname.split('/').at(-1)));
 await page.evaluate(ids=>{localStorage.setItem('labnest.calculators.v1',JSON.stringify({version:2,favorites:[],presets:[],history:[],drafts:{},recent:[...ids.map((calculatorId,i)=>({calculatorId,visitedAt:new Date(2026,0,i+1).toISOString(),summary:'DO NOT SHOW'})),{calculatorId:ids[0],visitedAt:'2026-02-01',summary:'duplicate'}]}));},ids);
 await page.reload();await page.waitForSelector('.calculator-recent a');assert.equal(await page.locator('.calculator-recent a').count(),6);assert.equal(await page.locator('.calculator-recent p').count(),0);assert((await page.locator('.calculator-recent a').first().getAttribute('href')).includes(ids[0]));
 for(const [name,width] of [['desktop',1280],['phone',390],['narrow-zoom-equivalent',244]]){
  await page.setViewportSize({width,height:900});const geometry=await page.locator('.calculator-recent a').evaluateAll(nodes=>nodes.map(n=>({width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height,icon:!!n.querySelector('.task-icon')})));
  assert(geometry.every(g=>g.icon&&Math.abs(g.width-geometry[0].width)<1));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`${dir}/${name}.png`,fullPage:true});report.checks.push({name,geometry});
 }
 await page.setViewportSize({width:1000,height:900});await page.goto(base+'/tools/calculator/dilution');await page.getByRole('button',{name:'Load example',exact:true}).click();await page.getByRole('button',{name:'Calculate',exact:true}).click();await page.getByRole('button',{name:'Copy',exact:true}).click();const text=await page.evaluate(()=>navigator.clipboard.readText());assert(text.length>0);assert(!/Operations|Context|Inputs|EXAMPLE|Warnings|Assumptions|Method:|Status:/.test(text));report.clipboard=text;
 await page.screenshot({path:`${dir}/copy-result.png`,fullPage:true});
 await page.goto(base+'/tools/calculator');await page.evaluate(()=>localStorage.removeItem('labnest.calculators.v1'));await page.reload();await page.waitForSelector('.calculator-categories');assert.equal(await page.locator('.calculator-recent').count(),0);report.emptyHidden=true;
 const allIds=await page.locator('.calculator-category-tools .calculator-tool-tile').evaluateAll(nodes=>nodes.map(n=>new URL(n.href).pathname.split('/').at(-1)));report.tools=[];
 for(const id of allIds.filter(id=>id!=='colony-counter')){
  await page.goto(base+'/tools/calculator/'+id);await page.getByRole('button',{name:'Load example',exact:true}).click();await page.getByRole('button',{name:'Calculate',exact:true}).click();const copy=page.getByRole('button',{name:'Copy',exact:true});await copy.waitFor();
  if(await copy.isDisabled()){report.tools.push({id,copy:'disabled for invalid result'});continue;}
  await copy.click();const text=await page.evaluate(()=>navigator.clipboard.readText());assert(text.trim());assert(!/Operations|Context|Inputs|EXAMPLE|Warnings|Assumptions|Method:|Status:/.test(text),id);report.tools.push({id,text});
 }

}finally{writeFileSync(`${dir}/browser.json`,JSON.stringify(report,null,2));await browser.close();}
