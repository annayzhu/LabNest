import {chromium, webkit} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';

const base=process.env.LABNEST_E2E_BASE_URL??'http://localhost:3001';
const phase=process.env.UI_PHASE??'before';
const root=process.env.UI_EVIDENCE_DIR??'docs/calculator/ui-consistency-20261007/evidence';
const dir=`${root}/${phase}`;
await mkdir(dir,{recursive:true});
const {catalog,aliases}=JSON.parse(execFileSync(process.execPath,['--require','tsx/cjs','-e',"const {getCalculatorCatalog}=require('./src/lib/calculators/catalog.ts');const {legacyTaskMap}=require('./src/lib/calculators/task-definitions.ts');console.log(JSON.stringify({catalog:getCalculatorCatalog(),aliases:legacyTaskMap}))"],{encoding:'utf8'}));
const report={base,phase,at:new Date().toISOString(),sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),tools:[],aliases,failures:[]};
const browsers=process.env.UI_BROWSER==='chromium'||phase==='before'?{chromium}:{chromium,webkit};
for(const [engine,type] of Object.entries(browsers)){
 const browser=await type.launch();
 try{
  for(const width of [1440,390]){
   const context=await browser.newContext({viewport:{width,height:width===390?844:900},reducedMotion:'no-preference'});
   await context.addInitScript(()=>localStorage.setItem('labnest.locale','zh'));
   const page=await context.newPage();
   for(const tool of catalog.filter(t=>!aliases[t.id])){
    const errors=[];const listen=e=>errors.push(e.message);page.on('pageerror',listen);
    await page.goto(`${base}/tools/calculator/${tool.id}`,{waitUntil:'networkidle'});
    await page.getByRole('heading',{name:tool.nameZh,exact:true}).waitFor();
    const visible=await page.locator('button,summary,select,label:has(input[type=radio])').evaluateAll(nodes=>nodes.filter(n=>n.getBoundingClientRect().width&&n.getBoundingClientRect().height).map(n=>({tag:n.tagName,text:n.textContent.trim(),label:n.getAttribute('aria-label'),height:n.getBoundingClientRect().height,transition:getComputedStyle(n).transitionDuration,appearance:getComputedStyle(n).appearance,paddingRight:getComputedStyle(n).paddingRight})));
    const entry={id:tool.id,name:tool.nameZh,route:`/tools/calculator/${tool.id}`,engine,width,empty:visible,errors};
    await page.screenshot({path:`${dir}/${engine}-${tool.id}-${width}-empty.png`,fullPage:true});
    const load=page.getByRole('button',{name:'载入示例',exact:true});
    if(await load.count()){
     await load.click();
     await page.getByRole('button',{name:'计算',exact:true}).click();
     entry.result=await page.locator('[data-calculator-result]').allTextContents();entry.numericResult=await page.locator('[data-calculator-result] dl, [data-calculator-result] table, .reaction-mix-summary').allTextContents();
     entry.alerts=await page.locator('[role=alert]').allTextContents();
     if(width<768&&await page.locator('.calculator-pane-switch').count()){
      const inputs=page.locator('.calculator-pane-switch').first().getByRole('button',{name:'配方 / 数据',exact:true});
      if(await inputs.isVisible())await inputs.click();
     }
    }
    entry.expansions=[];
    const panes=width<768&&await page.locator('.calculator-pane-switch').count()?['配方 / 数据','结果']:[null];
    for(const pane of panes){
     if(pane){const tab=page.locator('.calculator-pane-switch').first().getByRole('button',{name:pane,exact:true});if(await tab.isVisible())await tab.click();}

    const disclosures=page.locator('.calculator-workbench details, .calculator-workbench .calculator-disclosure');
    for(let index=0;index<await disclosures.count();index++){
     const disclosure=disclosures.nth(index),trigger=disclosure.locator(':scope > summary, :scope > button').first();
     if(!await trigger.isVisible())continue;
     const title=await trigger.innerText();
     if(/更多|导出|管理/.test(title))continue;
     await trigger.scrollIntoViewIfNeeded();
     const start=await trigger.boundingBox();await trigger.click();
     const data=await disclosure.evaluate(n=>({motionStyles:[n,...n.querySelectorAll('*')].filter(n=>n.getBoundingClientRect().height).map(n=>({transition:getComputedStyle(n).transitionDuration,animation:getComputedStyle(n).animationDuration})),open:n.open??n.querySelector('button')?.getAttribute('aria-expanded'),animations:n.getAnimations({subtree:true}).map(a=>a.constructor.name),text:n.textContent.trim()}));
     const end=await trigger.boundingBox();entry.expansions.push({pane,title,start,end,...data});
     await trigger.click();
    }
    }
    if(width<768&&await page.locator('.calculator-pane-switch').count())await page.locator('.calculator-pane-switch').first().getByRole('button',{name:'配方 / 数据',exact:true}).click();
    entry.selectors=await page.locator('.calculator-workbench select').evaluateAll(nodes=>nodes.map(n=>({name:n.getAttribute('aria-label')??n.closest('label')?.textContent,appearance:getComputedStyle(n).appearance,padding:getComputedStyle(n).paddingRight,position:getComputedStyle(n).backgroundPosition,value:n.value,disabled:n.disabled})));
    entry.overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
    await page.screenshot({path:`${dir}/${engine}-${tool.id}-${width}-example.png`,fullPage:true});
    if(phase!=='before'){
     try{assert.deepEqual(errors,[]);assert.equal(entry.overflow,false,tool.id);assert(entry.selectors.every(s=>s.appearance==='none'&&s.padding==='40px'&&s.position.includes('12px')),tool.id+' select gutter');assert(entry.expansions.every(x=>x.animations.length===0),tool.id+' running disclosure animation');assert(entry.expansions.every(x=>x.motionStyles.every(style=>style.transition.split(', ').every(t=>t==='0s')&&style.animation.split(', ').every(t=>t==='0s'))),tool.id+' residual motion');}catch(e){report.failures.push({id:tool.id,width,engine,error:e.message});}
    }
    report.tools.push(entry);page.off('pageerror',listen);
    console.log(`${phase} ${engine} ${width} ${tool.id}: opened / example / ${entry.expansions.length} disclosures`);
   }
   for(const [alias,mapping] of Object.entries(aliases)){await page.goto(`${base}/tools/calculator/${alias}`,{waitUntil:'networkidle'});report.tools.push({id:alias,engine,width,compatibility:true,mapping,title:await page.locator('h1').innerText()});}
   await context.close();
  }
 }finally{await browser.close();}
}
await writeFile(`${dir}/inventory.json`,JSON.stringify(report,null,2));
assert.deepEqual(report.failures,[]);
