import {showCalculatorResult,showCalculatorInputs,openCalculatorDisclosure} from './calculator-ui-test-helpers.mjs';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const base=process.env.LABNEST_E2E_BASE_URL??'http://localhost:3221';
const browser=await chromium.launch();
const page=await browser.newPage();
const checks=[];
try {
 for(const width of [360,390,1280]) {
  await page.setViewportSize({width,height:844});
  for(const task of ['dilution','master-mix','buffer-recipe']) {
   await page.goto(`${base}/tools/calculator/${task}`,{waitUntil:'networkidle'});
   await page.getByRole('button',{name:'Load example',exact:true}).click();
   if(task==='master-mix') {
    await page.getByRole('combobox',{name:'Calculation basis',exact:true}).first().selectOption('concentration');
   }
   if(task==='buffer-recipe')await page.getByRole('combobox',{name:'Basis',exact:true}).first().selectOption('concentration');
   const pairs=await page.locator('form select').evaluateAll(selects=>selects.filter(select=>select.getClientRects().length).flatMap(select=>{
    const parent=select.parentElement;
    if(!parent.className.includes('grid-cols-[')&&!parent.classList.contains('calculator-quantity'))return [];
    const input=parent.querySelector('input');if(!input)return [];
    const a=input.getBoundingClientRect(),b=select.getBoundingClientRect();
    return [{sameLine:Math.abs(a.top-b.top)<2,inside:a.left>=0&&b.right<=innerWidth+1,inputWidth:a.width,unitWidth:b.width}];
   }));
   assert(pairs.length>0,`Missing number/unit pairs: ${task}`);
   assert(pairs.every(pair=>pair.sameLine&&pair.inside),JSON.stringify({task,width,pairs}));
   checks.push({task,width,pairs});
   if(width===390)await page.screenshot({path:`docs/calculator/evidence/${task}-compact-390.png`,fullPage:true});
  }
 }
 await writeFile('docs/calculator/evidence/compact-ui-report.json',JSON.stringify({completedAt:new Date().toISOString(),checks},null,2));
 console.log('Number/unit pairs remain on one line at 360, 390 and 1280 px, including structured concentrations.');
} finally {await browser.close();}
