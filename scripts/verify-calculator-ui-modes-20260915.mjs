import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {showCalculatorResult} from './calculator-ui-test-helpers.mjs';
const base=process.env.LABNEST_E2E_BASE_URL||'http://localhost:3240';const out='docs/calculator/ui-20260915/evidence/modes';await mkdir(out,{recursive:true});
const cases=JSON.parse(await readFile('docs/calculator/ui-20260915/evidence/mode-cases.json','utf8'));const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:390,height:844}}),checks=[];
try{for(const item of cases){
 await page.goto(`${base}/tools/calculator/${item.id}`);await page.getByRole('button',{name:'Load example',exact:true}).click();
 await page.evaluate(({id,inputs})=>{const key='labnest.calculators.v1',state=JSON.parse(localStorage.getItem(key));state.drafts[id]={inputs,example:false,updatedAt:new Date().toISOString()};localStorage.setItem(key,JSON.stringify(state));},item);
 await page.reload();await page.getByRole('button',{name:'Restore draft',exact:true}).click();
 const visible=await page.locator('.calculator-input-form input:visible,.calculator-input-form select:visible').evaluateAll(es=>es.map(el=>({label:el.getAttribute('aria-label')??el.closest('label')?.textContent,value:el.value})));
 await page.getByRole('button',{name:'Calculate',exact:true}).click();assert.equal(await page.locator('.calculator-input-form [role=alert]').count(),0,item.id+' '+item.name);
 await showCalculatorResult(page);await page.locator('[data-calculator-result]').waitFor();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,item.name);
 if(item.status!=='partial'){
  await page.getByRole('button',{name:'Save to local history',exact:true}).click();const actual=await page.evaluate(()=>JSON.parse(localStorage.getItem('labnest.calculators.v1')).history[0].snapshot.outputMap);assert.deepEqual(actual,item.outputs,item.name);
 }else{assert.equal(await page.getByRole('button',{name:'Save to local history',exact:true}).isDisabled(),true);assert.equal(await page.getByRole('button',{name:'Copy',exact:true}).isDisabled(),true);}
 const screenshot=`${out}/${item.id}-${item.name.replaceAll(/[^a-z0-9-]/gi,'-')}.png`;await page.screenshot({path:screenshot,fullPage:true});checks.push({id:item.id,mode:item.name,status:'passed',visibleInputs:visible,screenshot,fixture:'synthetic draft restored through UI; calculated and read back from local history'});console.log('passed',item.id,item.name);
}}finally{await writeFile(`${out}/report.json`,JSON.stringify({base,checks},null,2));await browser.close();}
