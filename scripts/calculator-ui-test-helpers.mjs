/** Navigate actual compact UI controls before testing canonical output. */
export async function showCalculatorResult(page) {
 const tab=page.locator('.calculator-pane-switch').first().getByRole('button',{name:'Result',exact:true});
 if(await tab.count()&&await tab.isVisible())await tab.click();
}
export async function showCalculatorInputs(page) {
 const tab=page.locator('.calculator-pane-switch').first().getByRole('button',{name:'Inputs',exact:true});
 if(await tab.count()&&await tab.isVisible())await tab.click();
}
export async function openCalculatorDisclosure(page,name) {
 if(name==='Offline use'&&await page.locator('.calculator-more').count()){
  const panel=page.getByRole('dialog',{name:'Offline use',exact:true});
  if(await panel.isVisible())return;
  await page.locator('.calculator-more > summary').click();
  await page.getByRole('button',{name:'Offline use',exact:true}).click();return;
 }
 const trigger=page.getByRole('button',{name,exact:true}).filter({has:page.locator('svg')});
 if(await trigger.count()&&await trigger.first().isVisible()&&await trigger.first().getAttribute('aria-expanded')!==null){
  if(await trigger.first().getAttribute('aria-expanded')==='false')await trigger.first().click();
  return;
 }
 const summary=page.locator('summary').filter({hasText:new RegExp('^'+name+'$')});
 if(await summary.count()&&await summary.first().isVisible()&&!(await summary.first().evaluate(el=>el.parentElement.open)))await summary.first().click();
}

/** Mode inputs may be native radios; units and longer lists remain native selects. */
export async function selectCalculatorOption(page,name,value){
 const select=page.getByRole('combobox',{name,exact:true});
 if(await select.count())return select.selectOption(value);
 const group=page.getByRole('group',{name,exact:true});
 await group.locator(`input[type="radio"][value="${value}"]`).locator('..').click();
}

export async function prepareCalculatorOffline(page) {
 await openCalculatorDisclosure(page,'Offline use');
 await page.getByRole('button',{name:/^(Prepare offline|Update offline content|Retry)$/}).click();
 await page.getByText(/^Available offline:/).waitFor({timeout:60000});
 const dialog=page.getByRole('dialog',{name:'Offline use',exact:true});
 if(await dialog.isVisible())await dialog.getByRole('button',{name:'Close',exact:true}).click();
}
