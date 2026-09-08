// Supplemental screenshots of already-validated synthetic template/Run records.
// Run after test:editor-repair:e2e with the isolated production server on 3227.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const dir='docs/editor-repair/evidence';
const fixtures=JSON.parse(readFileSync(`${dir}/fixtures.json`));
const run=JSON.parse(readFileSync(`${dir}/run.json`)).checks[0];
const browser=await chromium.launch();const page=await browser.newPage();
for (const width of [1440,390]) {
 await page.setViewportSize({width,height:1000});
 await page.goto('http://localhost:3227'+fixtures.cases.find(c=>c.name==='protocol').edit,{waitUntil:'networkidle'});
 const template=page.locator('.ln-protocol-result-template-editor').last();await template.locator('summary').first().click();
 await template.getByRole('img').evaluate(i=>i.decode());const close=page.getByRole('button',{name:'Close selected block settings',exact:true});if(await close.isVisible())await close.click();await page.evaluate(()=>Promise.all(document.getAnimations().map(a=>a.finished.catch(()=>{}))));await template.scrollIntoViewIfNeeded();await page.screenshot({path:`${dir}/template-${width}.png`});
 await page.goto(run.url,{waitUntil:'networkidle'});await page.locator('[data-run-step-content]:visible img').first().evaluate(i=>i.decode());await page.screenshot({path:`${dir}/run-${width}.png`});
}
await browser.close();
