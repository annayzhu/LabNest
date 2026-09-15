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
 const summary=page.locator('summary').filter({hasText:new RegExp('^'+name+'$')});
 if(await summary.count()&&await summary.first().isVisible()&&!(await summary.first().evaluate(el=>el.parentElement.open)))await summary.first().click();
}
