import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const base=process.env.LABNEST_E2E_BASE_URL||'http://localhost:3240';
const phase=process.env.LABNEST_UI_PHASE||'after';
const dir=`docs/calculator/ui-20260915/evidence/${phase}`;await mkdir(dir,{recursive:true});
const ids='hemocytometer,seeding,hydrogel,split,freezing,transfection,viability,dilution,serial-dilution,molarity,percent-solution,media-recipe,buffer-recipe,master-mix,resuspension,normalization,kill-curve,ligation,tm,dna-rna-conversion,bradford-bca,elisa-4pl,ic50-ec50,wb-loading,od600,cfu,colony-counter,moi,virus-titer,unit-converter,centrifuge,reagent-dosing,fold-dilution'.split(',');
const browser=await chromium.launch();const context=await browser.newContext({recordVideo:{dir:`${dir}/video`,size:{width:1440,height:900}}});const page=await context.newPage();const checks=[];
try {
 for(const width of [1440,390])for(const id of ids){
  await page.setViewportSize({width,height:width===1440?900:844});
  await page.goto(`${base}/tools/calculator/${id}`,{waitUntil:'networkidle'});
  const initialResult=await page.locator('[data-calculator-result]').count();assert.equal(initialResult,0,id+' initial');
  await page.screenshot({path:`${dir}/${id}-${width}-initial.png`,fullPage:true});
  if(id!=='colony-counter'){
   const load=page.getByRole('button',{name:/^(Load example|载入示例)$/});await load.click();
   await page.getByRole('button',{name:/^(Calculate|计算)$/}).click();
  }
  await page.evaluate(()=>scrollTo(0,0));
  const positions=await page.evaluate(()=>{const box=s=>{const r=document.querySelector(s)?.getBoundingClientRect();return r?{top:r.top,bottom:r.bottom,left:r.left,right:r.right}:null;};return{viewport:{width:innerWidth,height:innerHeight},scrollHeight:document.documentElement.scrollHeight,scrollWidth:document.documentElement.scrollWidth,input:box('.calculator-input-form input'),calculate:box('button[type="submit"]'),result:box('[data-calculator-result]')||box('.calculator-result-panel'),overflow:document.documentElement.scrollWidth>innerWidth+1};});
  const error=(await page.locator('[role="alert"]').allTextContents()).filter(Boolean);
  await page.screenshot({path:`${dir}/${id}-${width}-input.png`,fullPage:true});
  if(width===390){const switcher=page.locator('.calculator-pane-switch').first().getByRole('button',{name:/^(Result|结果)$/});if(await switcher.count()){await switcher.click();await page.screenshot({path:`${dir}/${id}-${width}-result.png`,fullPage:true});}}
  let invalidChecked=false;
  if(id!=='colony-counter'){
   const inputTab=page.locator('.calculator-pane-switch').first().getByRole('button',{name:/^(Inputs|输入)$/});if(await inputTab.count()&&await inputTab.isVisible())await inputTab.click();
   const editable=page.locator('.calculator-input-form input[inputmode=decimal]:visible').first();
   if(await editable.count()){
    await editable.fill('invalid');await page.getByRole('button',{name:/^(Calculate|计算)$/}).click();
    assert.equal(await page.locator('[data-calculator-result]').count(),0,id+' invalid result removed');
    assert.ok(await page.locator('[role=alert]').count(),id+' invalid feedback');invalidChecked=true;
    await page.screenshot({path:`${dir}/${id}-${width}-invalid.png`,fullPage:true});
   }
  }
  checks.push({id,width,error,initialResult,invalidChecked,...positions});
  console.log(id,width,positions.overflow?'OVERFLOW':'ok',error.join(';'));
 }
 await writeFile(`${dir}/report.json`,JSON.stringify({base,phase,at:new Date().toISOString(),sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),checks},null,2));
}finally{await context.close();await browser.close();}
