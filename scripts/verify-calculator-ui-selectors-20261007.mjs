import {chromium,webkit} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.LABNEST_E2E_BASE_URL??'http://localhost:3221';
const out='docs/calculator/ui-consistency-20261007/evidence/selectors';
await mkdir(out,{recursive:true});
const report={base,checks:[]};
const style=n=>({appearance:getComputedStyle(n).appearance,padding:getComputedStyle(n).paddingRight,position:getComputedStyle(n).backgroundPosition,outline:getComputedStyle(n).outlineStyle});
for(const [engine,type] of Object.entries({chromium,webkit})){
 const browser=await type.launch();
 try{for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:900}});
  await context.addInitScript(()=>localStorage.setItem('labnest.locale','zh'));
  const page=await context.newPage();
  await page.goto(`${base}/tools/calculator/master-mix`);
  await page.getByRole('button',{name:'载入示例',exact:true}).click();
  await page.getByRole('combobox',{name:'计算依据',exact:true}).first().selectOption('concentration');
  const stock=page.locator('[data-mix-field=stock]').first();
  const units=page.getByRole('combobox',{name:'stock unit',exact:true}).first();
  const normal=await units.evaluate(style);
  await units.focus();const focused=await units.evaluate(style);
  assert.equal(focused.position,normal.position);assert.notEqual(focused.outline,'none');
  await stock.fill('1e');assert(await units.isDisabled());
  const disabled=await units.evaluate(style);
  await page.getByRole('button',{name:'计算',exact:true}).click();
  assert(await page.locator('.calculator-input-form [role=alert]').count()>0);
  const error=await units.evaluate(style);
  for(const state of [normal,focused,disabled,error]){assert.equal(state.appearance,'none');assert.equal(state.padding,'40px');assert.equal(state.position,normal.position);assert(state.position.includes('12px'));}
  await stock.fill('10');assert.equal(await units.isDisabled(),false);
  // Native type-ahead works across macOS and Linux without relying on OS popup keys.
  await units.focus();const before=await units.inputValue();await page.keyboard.press('n');
  const after=await units.inputValue();assert.notEqual(after,before);
  await page.screenshot({path:`${out}/${engine}-${width}.png`,fullPage:true});
  report.checks.push({engine,width,status:'passed',normal,focused,disabled,error,keyboard:{before,after,key:'n (native type-ahead)'},description:'real incomplete numeric input disables native unit select; focus/error geometry and keyboard selection retained'});
  await context.close();
 }}finally{await browser.close();await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));}
}
