import {chromium} from 'playwright';import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';
const f=JSON.parse(readFileSync('docs/editor-repair/evidence/fixtures.json'));const browser=await chromium.launch();const checks=[];
try{for(const [name,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
 console.log('Testing',name);
 const context=await browser.newContext({viewport,recordVideo:{dir:'docs/debug-20260909/evidence/motion',size:viewport}});const page=await context.newPage();await page.goto('http://localhost:3232'+f.cases.find(c=>c.name==='experiment').edit,{waitUntil:'networkidle'});
 await page.getByRole('tab',{name:'Metadata',exact:true}).focus();await page.keyboard.press('Enter');const panel=page.locator('.context-properties:not([hidden])');console.log(name,await page.locator('.context-properties').evaluateAll(es=>es.map(e=>({hidden:e.hidden,label:e.getAttribute('aria-label')}))));await page.screenshot({path:`docs/debug-20260909/evidence/motion-open-${name}.png`});await panel.waitFor();await panel.evaluate(el=>Promise.all(el.getAnimations().map(a=>a.finished)));
 const field=panel.locator('[name=purpose]');await field.fill('动效切换草稿');
 for(let n=0;n<3;n++){await page.getByRole('button',{name:'收起属性',exact:true}).click();await page.getByRole('tab',{name:'Metadata',exact:true}).focus();await page.keyboard.press('Enter');}
 assert.equal(await field.inputValue(),'动效切换草稿');
 if(name==='mobile')assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');
 await page.getByRole('button',{name:'收起属性',exact:true}).click();assert.notEqual(await page.evaluate(()=>document.body.style.overflow),'hidden');
 await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('tab',{name:'Metadata',exact:true}).focus();await page.keyboard.press('Enter');assert.equal(await panel.evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
 checks.push({name,draft:'preserved',reducedMotion:'0s',video:await page.video().path()});await context.close();}
 writeFileSync('docs/debug-20260909/evidence/motion.json',JSON.stringify(checks,null,2));
}finally{await browser.close();}
