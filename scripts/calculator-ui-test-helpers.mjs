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
 const summary=page.locator('summary').filter({hasText:new RegExp('^'+name+'$')});
 if(await summary.count()&&await summary.first().isVisible()&&!(await summary.first().evaluate(el=>el.parentElement.open)))await summary.first().click();
}

export async function prepareCalculatorOffline(page) {
 await openCalculatorDisclosure(page,'Offline use');
 await page.getByRole('button',{name:/^(Prepare offline|Update offline content|Retry)$/}).click();
 await page.getByText(/^Available offline:/).waitFor({timeout:60000});
 const dialog=page.getByRole('dialog',{name:'Offline use',exact:true});
 if(await dialog.isVisible())await dialog.getByRole('button',{name:'Close',exact:true}).click();
}
