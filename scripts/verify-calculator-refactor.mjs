import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const base=process.env.LABNEST_E2E_BASE_URL??'http://localhost:3220';
const output='docs/calculator/evidence';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:390,height:844}});const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
const input=name=>page.getByRole('textbox',{name:new RegExp(`^${name}`)});
const fill=async(name,value)=>input(name).fill(String(value));
const checks=[];
try {
 await page.goto(`${base}/tools/calculator`,{waitUntil:'networkidle'});
 assert.equal(await page.getByRole('heading',{name:'Lab Calculations'}).count(),1);
 for(const id of ['dilution','molarity','seeding','master-mix','wb-loading','centrifuge'])assert(await page.locator(`a[href="/tools/calculator/${id}"]`).first().isVisible());
 await input('Search calculations').fill('抗体');assert(await page.locator('a[href="/tools/calculator/dilution"]').isVisible());checks.push('UX-01/02 default tasks and antibody alias');
 await page.goto(`${base}/tools/calculator/dilution`,{waitUntil:'networkidle'});
 assert.equal(await page.getByText('Valid conditions',{exact:true}).count(),0);
 await fill('Stock concentration',10);await fill('Target concentration',10);await fill('Final / initial volume',2);
 await page.getByText('Valid conditions',{exact:true}).waitFor();
 await page.getByRole('combobox',{name:'Stock concentration unit'}).selectOption('µM');assert.equal(await input('Stock concentration').inputValue(),'10000');
 await page.getByRole('button',{name:'Calculate',exact:true}).click();
 await page.getByRole('button',{name:'Save to local history'}).click();
 const snapshot=await page.evaluate(()=>JSON.parse(localStorage.getItem('labnest.calculators.v1')).history[0]);assert.equal(snapshot.snapshot.outputMap.stockVolumeUl,2);assert.equal(snapshot.inputUnits.stockConcentration,'µM');
 await fill('Target concentration','');assert.equal(await page.getByRole('button',{name:'Save to local history'}).count(),0);checks.push('UX-05/06 invalidation and physical unit preservation');
 await fill('Target concentration',10);await page.reload({waitUntil:'networkidle'});assert.equal(await input('Stock concentration').inputValue(),'');await page.getByRole('button',{name:'Restore draft'}).click();assert.equal(await input('Stock concentration').inputValue(),'10000');checks.push('draft explicit restoration');
 await page.goto(`${base}/tools/calculator/master-mix`,{waitUntil:'networkidle'});await page.getByRole('button',{name:'Load example'}).click();await page.getByRole('button',{name:'Calculate',exact:true}).click();assert(await page.getByRole('button',{name:'Save to local history'}).isDisabled());assert((await page.locator('main').innerText()).includes('514.8'));checks.push('NUM-20 UI and UX-16 example guard');
 for(const width of [360,390]){
  await page.setViewportSize({width,height:844});
  for(const id of ['dilution','molarity','seeding','master-mix','wb-loading','centrifuge','normalization','resuspension']){
   await page.goto(`${base}/tools/calculator/${id}`,{waitUntil:'networkidle'});
   await page.getByRole('button',{name:'Load example'}).click();await page.getByRole('button',{name:'Calculate',exact:true}).click();
   assert.equal(await page.locator('main').getByRole('alert').count(),0,`${id} must calculate its explicit example`);
   const layout=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));assert(layout.scroll<=layout.width+1,`${id} overflows at ${width}: ${layout.scroll}`);
   const clipped=await page.locator('main input, main select, main button').evaluateAll(elements=>elements.filter(element=>element.getClientRects().length).filter(element=>{const rect=element.getBoundingClientRect();return rect.left < -1 || rect.right > window.innerWidth+1;}).map(element=>({text:element.getAttribute('aria-label')??element.textContent,right:element.getBoundingClientRect().right})));assert.deepEqual(clipped,[],`${id} has clipped controls at ${width}`);
   if(width===390)await page.screenshot({path:`${output}/${id}-390.png`,fullPage:true});
  }
 }
 checks.push('UX-14 eight task flows at 360 and 390 CSS px');
 await page.goto(`${base}/tools/calculator/dilution`,{waitUntil:'networkidle'});await page.getByText('Offline use',{exact:true}).click();await page.getByRole('button',{name:'Cache this calculation page'}).click();await page.getByText('This page is cached; drafts can be restored offline.',{exact:true}).waitFor({timeout:30000});
 await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('heading',{name:'Dilution & dosing'}).waitFor();await page.getByRole('button',{name:'Restore draft'}).click();await fill('Target concentration',20);await page.getByText('Valid conditions',{exact:true}).waitFor();checks.push('UX-12 offline cached reload, restore and calculate');await context.setOffline(false);
 assert.deepEqual(errors,[]);
 await writeFile(`${output}/browser-report.json`,JSON.stringify({base,checks,errors,completedAt:new Date().toISOString()},null,2));console.log(JSON.stringify({checks,errors},null,2));
} finally {await browser.close();}

// Blocker acceptance runs in the same production CI server, after the legacy flows.
await import('./verify-calculator-blockers.mjs');
