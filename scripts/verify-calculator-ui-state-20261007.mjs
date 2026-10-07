import {chromium,webkit} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';

const base=process.env.LABNEST_E2E_BASE_URL??'http://localhost:3334';
const root=process.env.UI_STATE_EVIDENCE_DIR??'docs/calculator/ui-consistency-20261007/evidence/state';
await mkdir(root,{recursive:true});
const report={base,at:new Date().toISOString(),checks:[]};
const types=process.env.UI_BROWSER==='chromium'?{chromium}:{chromium,webkit};
for(const [engine,type] of Object.entries(types)){
 const browser=await type.launch();
 try{for(const width of [1440,390])for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width,height:width===390?844:900},colorScheme:theme,reducedMotion:'no-preference',recordVideo:{dir:`${root}/videos`}});
  await context.addInitScript(()=>localStorage.setItem('labnest.locale','zh'));
  const page=await context.newPage();
  await context.tracing.start({screenshots:true,snapshots:true,sources:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const check=(name,data={})=>report.checks.push({engine,width,theme,name,status:'passed',...data});
  const mode=value=>page.getByRole('group',{name:'配液模式',exact:true}).locator(`input[value="${value}"]`).locator('..').click();
  const field=key=>page.locator(`[data-field-key="${key}"] input`);
  await page.goto(`${base}/tools/calculator/master-mix`,{waitUntil:'networkidle'});
  assert.equal(await page.locator('[data-calculator-result]').count(),0);
  await page.getByRole('button',{name:'载入示例',exact:true}).click();
  await field('samples').fill('3');await field('replicates').fill('2');await field('controls').fill('1');
  await page.locator('[data-mix-field=name]').first().fill('中文缓冲液');
  const original=await page.locator('[data-mix-field=name]').evaluateAll(nodes=>nodes.map(n=>n.value));
  await mode('multiple');await page.locator('[data-group-reactions]').fill('8');
  await page.getByRole('button',{name:'添加分组',exact:true}).click();
  await page.locator('[data-group-name]').fill('中文处理组B');await page.locator('[data-group-reactions]').fill('4');
  await page.getByRole('button',{name:'添加组分',exact:true}).click();
  await page.locator('[data-mix-field=name]').fill('DNA模板B');await page.locator('[data-mix-field=volume]').fill('2');
  await mode('single');assert.equal(await field('samples').inputValue(),'3');assert.equal(await field('replicates').inputValue(),'2');assert.equal(await field('controls').inputValue(),'1');
  assert.deepEqual(await page.locator('[data-mix-field=name]').evaluateAll(nodes=>nodes.map(n=>n.value)),original);
  await mode('multiple');await page.getByRole('button',{name:'中文处理组B',exact:true}).click();assert.equal(await page.locator('[data-group-reactions]').inputValue(),'4');assert.equal(await page.locator('[data-mix-field=name]').inputValue(),'DNA模板B');
  check('single/multiple independently preserve reaction counts, Chinese rows and all groups');
  const single=page.getByRole('radio',{name:'单组配液',exact:true});await page.getByRole('radio',{name:'多组配液',exact:true}).focus();await page.keyboard.press('ArrowLeft');
  assert(await single.isChecked());assert.equal(await field('replicates').inputValue(),'2');
  check('native radio arrow keyboard changes mode and retains the original counts');
  const trigger=page.getByRole('button',{name:'移液设置（可选）',exact:true});
  await trigger.scrollIntoViewIfNeeded();
  const start=await trigger.locator('span').boundingBox();const scroll=await page.evaluate(()=>scrollY);
  await trigger.click();
  const minimum=page.getByRole('textbox',{name:'设备下限（µL）',exact:true}),step=page.getByRole('textbox',{name:'移液步进（µL）',exact:true});
  const motion=await page.locator('.calculator-disclosure').evaluateAll(nodes=>nodes.flatMap(n=>[n,...n.querySelectorAll('*')]).map(n=>({transition:getComputedStyle(n).transitionDuration,animation:getComputedStyle(n).animationDuration})));
  assert(motion.every(x=>x.transition==='0s'&&x.animation==='0s'));
  const end=await trigger.locator('span').boundingBox();assert(Math.abs(start.x-end.x)<.5);assert(Math.abs(start.y-end.y)<.5);
  assert.equal(await page.evaluate(()=>scrollY),scroll);
  await minimum.fill('1');await step.fill('0.5');await step.focus();await page.keyboard.press('Escape');
  assert.equal(await trigger.getAttribute('aria-expanded'),'false');assert(await trigger.evaluate(n=>n===document.activeElement));
  assert((await page.locator('.calculator-setting-summary').innerText()).includes('1 µL'));
  await trigger.click();assert.equal(await minimum.inputValue(),'1');assert.equal(await step.inputValue(),'0.5');
  const frames=await page.evaluate(async()=>{
   const button=[...document.querySelectorAll('button')].find(n=>n.textContent.trim()==='移液设置（可选）');
   const frames=[];for(let i=0;i<8;i++){button.click();await new Promise(requestAnimationFrame);const r=button.querySelector('span').getBoundingClientRect();frames.push({open:button.getAttribute('aria-expanded'),x:r.x,y:r.y,animations:button.closest('section').getAnimations({subtree:true}).length});}return frames;
  });
  assert(frames.every(f=>f.animations===0));assert(frames.every(f=>Math.abs(f.x-frames[0].x)<.5&&Math.abs(f.y-frames[0].y)<.5));
  check('immediate disclosure, stable title and scroll, retained settings, safe Escape focus',{start,end,frames});
  await page.screenshot({path:`${root}/${engine}-${width}-${theme}-input.png`,fullPage:true});
  await minimum.fill('');await step.fill('');await trigger.click();
  await page.getByRole('button',{name:'计算',exact:true}).click();
  await page.locator('[data-calculator-result]').waitFor();
  if(width<768)assert.equal(await page.locator('.calculator-input-panel').isVisible(),false);
  const result=await page.locator('[data-calculator-result]').innerText();assert(result.includes('7 个反应'));assert(result.includes('中文缓冲液'));
  const operation=page.getByRole('button',{name:'操作步骤',exact:true});await operation.click();assert((await page.locator('[data-liquid-operations]').innerText()).includes('7 个反应'));
  await operation.click();
  const units=page.getByRole('combobox',{name:'表格单位',exact:true});await units.selectOption('mL');assert((await page.locator('[data-calculator-result]').innerText()).includes('mL'));
  const selectStyle=await units.evaluate(n=>({appearance:getComputedStyle(n).appearance,paddingRight:getComputedStyle(n).paddingRight,backgroundPosition:getComputedStyle(n).backgroundPosition}));
  assert.equal(selectStyle.appearance,'none');assert.equal(selectStyle.paddingRight,'40px');assert(selectStyle.backgroundPosition.includes('12px'));
  check('7 actual reactions unchanged, narrow successful calculation shows result, output units and native selector gutter work',{selectStyle});
  await page.screenshot({path:`${root}/${engine}-${width}-${theme}-result.png`,fullPage:true});
  if(width<768)await page.locator('.calculator-pane-switch').first().getByRole('button',{name:'配方 / 数据',exact:true}).click();
  await field('reactionVolumeUl').fill('0');await page.getByRole('button',{name:'计算',exact:true}).click();
  assert.equal(await page.locator('[data-calculator-result]').count(),0);assert.equal(await page.getByRole('button',{name:'复制',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'导出CSV',exact:true}).count(),0);
  if(width<768)assert(await page.locator('.calculator-input-panel').isVisible());
  check('invalid input removes current result, copy and export and leaves narrow inputs visible');
  await page.getByRole('button',{name:'重置',exact:true}).click();
  assert.equal(await field('samples').inputValue(),'');assert.equal(await page.locator('.calculator-mode-source').count(),0);
  const fixture={reactionVolumeUl:20,overagePercent:10,groups:[{name:'实验A',reactions:'2',rows:[{name:'Mix',volume:'10',premix:true}]},{name:'实验B',reactions:'4',rows:[{name:'DNA',volume:'2',premix:false}]}]};
  await page.evaluate(inputs=>{const key='labnest.calculators.v1',s=JSON.parse(localStorage.getItem(key));s.drafts['master-mix']={inputs,updatedAt:new Date().toISOString(),example:false};localStorage.setItem(key,JSON.stringify(s));},fixture);
  await page.reload({waitUntil:'networkidle'});await page.getByRole('button',{name:'恢复上次草稿',exact:true}).click();
  await mode('single');assert(await page.getByRole('radio',{name:'多组配液',exact:true}).isChecked());
  await page.getByRole('combobox',{name:'选择用于单组的配液组',exact:true}).selectOption('1');await page.getByRole('button',{name:'使用所选组',exact:true}).click();
  assert.equal(await field('samples').inputValue(),'4');assert.equal(await page.locator('[data-mix-field=name]').inputValue(),'DNA');
  await mode('multiple');assert.equal(await page.getByRole('button',{name:'实验A',exact:true}).count(),1);assert.equal(await page.getByRole('button',{name:'实验B',exact:true}).count(),1);
  check('multi-only restored fixture requires explicit source group, and all groups survive the conversion');
  const scales=[];
  for(const size of ['compact','standard','comfortable']){
   await page.evaluate(size=>document.documentElement.dataset.labnestUiScale=size,size);
   const fonts=await page.locator('.calculator-action').first().evaluate(n=>({actual:getComputedStyle(n).fontSize,token:getComputedStyle(n).getPropertyValue('--ln-control-font-size-md').trim()}));
   assert.equal(fonts.actual,fonts.token);scales.push({size,...fonts});
  }
  check('new controls follow all existing interface font scales',{scales});
  for(const w of [1280,768,320]){await page.setViewportSize({width:w,height:w===1280?800:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await page.screenshot({path:`${root}/${engine}-${theme}-stress-${w}.png`,fullPage:true});}
  check('1280, 768 and 320 CSS pixel layout has no horizontal page overflow');
  await page.goto(`${base}/tools/calculator/dilution`,{waitUntil:'networkidle'});
  const second=page.getByRole('button',{name:'移液设置（可选）',exact:true});
  await second.click();const secondMinimum=page.getByRole('textbox',{name:'设备下限（µL）',exact:true});
  await secondMinimum.fill('0.5');await secondMinimum.focus();await page.keyboard.press('Escape');
  assert(await second.evaluate(n=>n===document.activeElement));await second.click();assert.equal(await secondMinimum.inputValue(),'0.5');
  const secondFrames=await page.evaluate(async()=>{
   const button=[...document.querySelectorAll('button')].find(n=>n.textContent.trim()==='移液设置（可选）'),frames=[];
   for(let i=0;i<8;i++){button.click();await new Promise(requestAnimationFrame);frames.push({expanded:button.getAttribute('aria-expanded'),animations:button.closest('section').getAnimations({subtree:true}).length});}return frames;
  });
  assert(secondFrames.every(f=>f.animations===0));
  check('second real calculator retains optional settings with safe Escape and eight no-motion frames',{secondFrames});
  await page.screenshot({path:`${root}/${engine}-${width}-${theme}-dilution-settings.png`,fullPage:true});
  assert.deepEqual(errors,[]);
  await context.tracing.stop({path:`${root}/${engine}-${width}-${theme}-trace.zip`});await context.close();
 }
 }finally{await browser.close();await writeFile(`${root}/report.json`,JSON.stringify(report,null,2));}
}
