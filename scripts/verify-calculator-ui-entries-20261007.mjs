import {chromium,webkit} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';

const base=process.env.LABNEST_E2E_BASE_URL??'http://localhost:3221';
const dir=process.env.UI_ENTRY_EVIDENCE_DIR??'docs/calculator/ui-consistency-20261007/evidence/entries';
await mkdir(dir,{recursive:true});
const report={base,at:new Date().toISOString(),checks:[],errors:[]};
for(const [engine,type] of Object.entries({chromium,webkit})){
 const browser=await type.launch();
 try{for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:width===390?844:900},reducedMotion:'no-preference'});
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
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
  report.checks.push({engine,width,status:'passed',name:'Tools and Today use the current catalog and segmented reaction-mix workspace'});
  await page.goto(`${base}/tools/free-plate-layout/index.html`,{waitUntil:'networkidle'});
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
  await context.close();
 }}finally{await browser.close();await writeFile(`${dir}/report.json`,JSON.stringify(report,null,2));}
}
assert.deepEqual(report.errors,[]);
