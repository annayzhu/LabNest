import {chromium,webkit} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {startStandalonePlateServer} from './test-helpers/standalone-plate-server.mjs';

const base=process.env.LABNEST_E2E_BASE_URL??'http://localhost:3221';
const dir=process.env.UI_ENTRY_EVIDENCE_DIR??'docs/calculator/ui-consistency-20261007/evidence/entries';
await mkdir(dir,{recursive:true});
const standalone=await startStandalonePlateServer();
const report={base,standaloneBase:standalone.base,at:new Date().toISOString(),checks:[],errors:[]};
try{
for(const [engine,type] of Object.entries({chromium,webkit})){
 const browser=await type.launch();
 try{for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:width===390?844:900},reducedMotion:'no-preference'});
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push({engine,width,url:page.url(),message:e.message,stack:e.stack}));
  const alternatePrefetches=[];
  page.on('request',request=>{
   if(new URL(request.url()).pathname==='/tools/calculator/transfection'&&request.headers()['next-router-prefetch']==='1')alternatePrefetches.push(request.url());
  });
  await page.goto(`${base}/tools`,{waitUntil:'networkidle'});
  const entry=page.getByRole('link',{name:'Open Experimental Calculator',exact:true});
  assert.equal(await entry.getAttribute('href'),'/tools/calculator');
  await entry.click();await page.waitForURL('**/tools/calculator');
  assert.equal(await page.locator('.calculator-category-tools svg[data-calculator-icon]').count(),31);
  await page.screenshot({path:`${dir}/${engine}-${width}-tools-entry.png`,fullPage:true});
  await page.goto(base,{waitUntil:'networkidle'});
  await page.locator('a[href="/tools/calculator"]:visible').first().click();
  await page.waitForURL('**/tools/calculator');
  await page.locator('a[href="/tools/calculator/master-mix"]').last().click();
  await page.getByRole('radio',{name:'Single group',exact:true}).waitFor({state:'attached'});
  await page.waitForLoadState('networkidle');
  assert.deepEqual(alternatePrefetches,[],'Do not preload an unselected paired tool during entry/Run navigation');
  await page.getByRole('navigation',{name:'Reaction modes'}).getByRole('link',{name:'Transfection',exact:true}).click();
  await page.waitForURL('**/tools/calculator/transfection');
  const newPlan=page.getByRole('button',{name:'New transfection plan',exact:true});
  if(await newPlan.count())await newPlan.click();
  await page.getByRole('group',{name:'Preparation mode',exact:true}).waitFor();
  await page.getByRole('navigation',{name:'Reaction modes'}).getByRole('link',{name:'PCR / Master Mix',exact:true}).click();
  await page.getByRole('radio',{name:'Single group',exact:true}).waitFor({state:'attached'});
  report.checks.push({engine,width,status:'passed',name:'paired reaction tools navigate on demand without alternate-tool prefetch',alternatePrefetches});
  report.checks.push({engine,width,status:'passed',name:'Tools and Today use the current catalog and segmented reaction-mix workspace'});
  if(width===1440){
   const fixture=JSON.parse(await readFile('docs/calculator/v1.2/evidence/run-browser-report.json','utf8'));
   assert.equal(new URL(fixture.runUrl).origin,new URL(base).origin,'Run fixture must belong to this isolated test server');
   await page.goto(fixture.runUrl,{waitUntil:'networkidle'});
   await page.getByRole('button',{name:'Calculator',exact:true}).first().click();
   const drawer=page.getByRole('dialog',{name:'Step calculations',exact:true});await drawer.waitFor();
   assert.equal(await page.getByRole('button',{name:'Calculator',exact:true}).first().locator('svg[data-calculator-icon=calculator]').count(),1);
   const task=drawer.getByRole('combobox',{name:'Calculation task',exact:true});
   const padding=await task.evaluate(n=>getComputedStyle(n).paddingRight);assert.equal(padding,'40px');
   await task.selectOption('master-mix');
   const embedded=page.frameLocator('iframe[title="Step calculation"]');
   await embedded.getByRole('radio',{name:'Single group',exact:true}).waitFor({state:'attached'});
   const pairedHref=await embedded.getByRole('navigation',{name:'Reaction modes'}).getByRole('link',{name:'Transfection',exact:true}).getAttribute('href');
   const pairedUrl=new URL(pairedHref,base);
   assert(pairedUrl.searchParams.get('experimentId')&&pairedUrl.searchParams.get('experimentStepId'),'Paired tool links retain Run context');
   await page.screenshot({path:`${dir}/${engine}-run-drawer.png`,fullPage:true});
   await drawer.getByRole('button',{name:'关闭 / Close',exact:true}).click();
   assert.deepEqual(alternatePrefetches,[],'Run iframe also avoids unselected alternate-tool prefetch');
   report.checks.push({engine,width,status:'passed',name:'actual Run desktop drawer uses solid trigger, shared selector gutter and current embedded workspace'});
  }
  await page.goto(`${base}/tools/calculator/colony-counter`,{waitUntil:'networkidle'});
  await page.keyboard.press('Tab');
  const file=page.locator('input[type=file]').first();await file.focus();
  const outline=await file.locator('..').evaluate(n=>({width:getComputedStyle(n).outlineWidth,style:getComputedStyle(n).outlineStyle,color:getComputedStyle(n).outlineColor}));
  assert.equal(outline.width,'2px');assert.equal(outline.style,'solid');assert(!outline.color.includes('rgba')||!outline.color.endsWith(', 0)')); 
  await page.screenshot({path:`${dir}/${engine}-${width}-colony-keyboard-focus.png`,fullPage:true});
  report.checks.push({engine,width,status:'passed',name:'native image upload input exposes visible focus on its label'});
  await page.goto(`${standalone.base}/index.html`,{waitUntil:'networkidle'});
  await page.locator('[data-well="A1"]').click();
  for(const id of ['seeding','hydrogel','kill-curve','fold-dilution','master-mix','moi']){
   await page.locator(`[data-plate-calculator="${id}"]`).first().click();
   const form=page.locator('#standalonePlateCalculatorForm');await form.waitFor();
   assert.equal(await page.locator('#plateCalculatorHost h3 svg[data-calculator-icon]').count(),1);
   await form.locator('button[type=submit]').click();
   const result=page.locator('#standalonePlateResult');
   assert.equal(await result.locator('[data-plate-result-action=copy]').count(),1);
   const styles=await page.locator('#plateCalculatorHost select').evaluateAll(nodes=>nodes.map(n=>({padding:getComputedStyle(n).paddingRight,position:getComputedStyle(n).backgroundPosition,appearance:getComputedStyle(n).appearance})));
   assert(styles.every(s=>s.padding==='40px'&&s.position.includes('12px')&&s.appearance==='none'),id);
   await page.screenshot({path:`${dir}/${engine}-${width}-standalone-${id}.png`,fullPage:true});
   const input=form.locator('input:not([readonly]):not([type=hidden])').first();
   await input.fill('0');assert.equal(await result.locator('[data-plate-result-action]').count(),0,id+' stale actions');
   await page.locator('.standalone-appearance-preview summary').click();
   const select=page.locator('[data-standalone-icon-pack]');await select.focus();await page.keyboard.press('Escape');
   assert.equal(await page.locator('.standalone-appearance-preview').evaluate(n=>n.open),false);
   assert(await page.locator('.standalone-appearance-preview summary').evaluate(n=>n===document.activeElement));
   assert.equal(await page.locator('#plateCalculatorHost').evaluate(n=>n.getAnimations({subtree:true}).length),0);
   report.checks.push({engine,width,id,status:'passed',name:'independent plate adapter: solid icon, actual default calculation, selectors, stale result protection, safe collapse'});
   await page.locator('#closeLiquidDrawerButton').click();
  }
  assert.deepEqual(alternatePrefetches,[],'No alternate-tool prefetch through the complete entry and Run flow');
  await context.close();
 }}finally{await browser.close();await writeFile(`${dir}/report.json`,JSON.stringify(report,null,2));}
}
assert.deepEqual(report.errors,[]);
}finally{await standalone.close();}
