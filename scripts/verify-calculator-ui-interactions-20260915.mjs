import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.LABNEST_E2E_BASE_URL||'http://localhost:3240';
const out='docs/calculator/ui-20260915/evidence/interactions';await mkdir(out,{recursive:true});
const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1366,height:768}});const checks=[];
async function check(name,fn){await fn();checks.push({name,status:'passed'});console.log('passed',name);}
async function example(id){await page.goto(`${base}/tools/calculator/${id}`);await page.getByRole('button',{name:'Load example',exact:true}).click();}
try{
 await check('Master Mix first screen at 1366 × 768',async()=>{
  await example('master-mix');await page.evaluate(()=>scrollTo(0,0));
  const box=await page.getByRole('button',{name:'Calculate',exact:true}).boundingBox();assert.ok(box.y+box.height<=768,JSON.stringify(box));
  await page.screenshot({path:`${out}/master-mix-1366.png`,fullPage:true});
 });
 await check('Recipe continuous rows, new row focus, cancellation preserves filled row',async()=>{
  await example('buffer-recipe');assert.ok(await page.getByRole('columnheader',{name:'Amount / unit'}).count());
  await page.getByRole('button',{name:'Add component',exact:true}).click();assert.equal(await page.locator('[data-recipe-name]').last().evaluate(el=>el===document.activeElement),true);
  await page.locator('[data-recipe-name]').last().fill('Keep me');page.once('dialog',dialog=>dialog.dismiss());await page.getByRole('button',{name:'Remove row',exact:true}).last().click();assert.equal(await page.locator('[data-recipe-name]').last().inputValue(),'Keep me');
 });
 await check('Curve staged paste, row/column error, cancel, duplicate/order and units retained',async()=>{
  await example('bradford-bca');await page.getByText('Paste data',{exact:true}).click();const paste=page.locator('details').filter({has:page.getByText('Paste data',{exact:true})});
  const original=await page.locator('[data-curve-column="0"]').evaluateAll(elements=>elements.map(el=>el.value));
  await paste.locator('textarea').fill('0,0.1\n0,invalid');await paste.getByRole('button',{name:'Apply data',exact:true}).click();assert.match(await paste.innerText(),/Row 2, column 2/);assert.deepEqual(await page.locator('[data-curve-column="0"]').evaluateAll(elements=>elements.map(el=>el.value)),original);
  await paste.getByRole('button',{name:'Cancel',exact:true}).click();assert.deepEqual(await page.locator('[data-curve-column="0"]').evaluateAll(elements=>elements.map(el=>el.value)),original);
  await page.getByText('Paste data',{exact:true}).click();await paste.locator('textarea').fill('0,0.1\n0,0.12\n1,0.5\n2,1');await paste.getByRole('button',{name:'Apply data',exact:true}).click();assert.deepEqual(await page.locator('[data-curve-column="0"]').evaluateAll(elements=>elements.map(el=>el.value)),['0','0','1','2']);assert.ok(await page.getByRole('columnheader',{name:'Concentration (mg/mL)',exact:true}).count());
 });
 await check('TCID50 has distinct accessible column labels',async()=>{
  await example('virus-titer');await page.getByRole('combobox',{name:'Method',exact:true}).selectOption('tcid50');await page.getByRole('button',{name:'Add point',exact:true}).click();assert.ok(await page.getByRole('textbox',{name:'Positive wells row 1',exact:true}).count());assert.ok(await page.getByRole('textbox',{name:'Total wells row 1',exact:true}).count());
 });
 await check('Mobile hidden B tube error automatically locates field',async()=>{
  await page.setViewportSize({width:390,height:844});await example('transfection');
  await page.getByRole('button',{name:'B tube',exact:true}).click();await page.getByRole('textbox',{name:'Prepared total per well',exact:true}).last().fill('1');await page.getByRole('button',{name:'A tube',exact:true}).click();
  await page.getByRole('button',{name:'Calculate',exact:true}).click();assert.equal(await page.getByRole('button',{name:'B tube',exact:true}).getAttribute('aria-pressed'),'true');assert.equal(await page.locator('.transfection-volume input').last().evaluate(el=>el===document.activeElement),true);
  await page.screenshot({path:`${out}/transfection-error-390.png`,fullPage:true});
 });
 await check('Mobile B custom basis amount and A auxiliary amount errors retain the correct tube',async()=>{
  await example('transfection');await page.getByRole('button',{name:'B tube',exact:true}).click();
  await page.getByRole('combobox',{name:'Dose basis',exact:true}).selectOption('custom');
  await page.getByRole('textbox',{name:'Reagent amount',exact:true}).fill('1');
  await page.getByRole('textbox',{name:'Applicable object / basis',exact:true}).fill('Cells');
  await page.getByRole('textbox',{name:'Basis unit',exact:true}).fill('10000 cells');
  await page.getByRole('button',{name:'A tube',exact:true}).click();await page.getByRole('button',{name:'Calculate',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'B tube',exact:true}).getAttribute('aria-pressed'),'true');
  assert.equal(await page.getByRole('textbox',{name:'Basis quantity per well',exact:true}).evaluate(el=>el===document.activeElement),true);
  await example('transfection');await page.getByRole('button',{name:'+ Auxiliary reagent',exact:true}).click();
  await page.locator('[data-auxiliary]').getByRole('textbox',{name:'Reagent name',exact:true}).fill('Auxiliary');
  await page.getByRole('button',{name:'B tube',exact:true}).click();await page.getByRole('button',{name:'Calculate',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'A tube',exact:true}).getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('[data-auxiliary]').getByRole('textbox',{name:'Reagent amount',exact:true}).evaluate(el=>el===document.activeElement),true);
 });
 await check('CFU optional efficiency can be enabled then disabled without blocking CFU',async()=>{
  await example('cfu');const checkbox=page.getByRole('checkbox',{name:'Calculate transformation efficiency',exact:true});
  await checkbox.check();await page.getByRole('textbox',{name:/DNA/}).fill('1');await page.getByRole('button',{name:'Calculate',exact:true}).click();
  await checkbox.uncheck();await page.getByRole('button',{name:'Calculate',exact:true}).click();
  assert.equal(await page.locator('.calculator-input-form [role=alert]').count(),0);assert.ok(await page.locator('[data-calculator-result]').count());assert.equal(await page.getByRole('textbox',{name:/DNA/}).count(),0);
 });
}finally{await writeFile(`${out}/report.json`,JSON.stringify({base,checks},null,2));await browser.close();}
