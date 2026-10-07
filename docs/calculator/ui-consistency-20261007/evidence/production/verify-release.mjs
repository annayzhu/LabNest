import {chromium,webkit} from 'playwright';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.env.FORMAL_BASE_URL;
if(!base)throw new Error('Set verified production LAN URL');
const out='docs/calculator/ui-consistency-20261007/evidence/production';
await mkdir(out,{recursive:true});
const report={base,at:new Date().toISOString(),checks:[]};
for(const [engine,type] of Object.entries({chromium,webkit})){
 const browser=await type.launch();
 try{for(const width of [1440,390])for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width,height:width===390?844:900},colorScheme:theme});
  await context.addInitScript(()=>localStorage.setItem('labnest.locale','en'));
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${base}/tools`,{waitUntil:'networkidle'});
  await page.getByRole('link',{name:'Open Experimental Calculator',exact:true}).click();
  await page.waitForURL('**/tools/calculator');
  assert.equal(await page.locator('.calculator-category-tools svg[data-calculator-icon]').count(),31);
  await page.locator('a[href="/tools/calculator/master-mix"]').last().click();
  await page.getByRole('radio',{name:'Single group',exact:true}).waitFor({state:'attached'});
  await page.waitForLoadState('networkidle');
  if(width<1024){
   await page.getByRole('button',{name:'Open more navigation',exact:true}).click();
   const menu=page.locator('#mobile-more-navigation');
   await menu.getByRole('button',{name:'中文',exact:true}).click();
   await menu.getByRole('button',{name:'关闭菜单',exact:true}).click();
  }else await page.getByRole('button',{name:'中文',exact:true}).click();
  await page.locator(`html[data-labnest-mode=${theme}]`).waitFor({state:'attached'});
  await page.getByRole('radio',{name:'单组配液',exact:true}).waitFor({state:'attached'});
  await page.getByRole('button',{name:'载入示例',exact:true}).click();
  const trigger=page.getByRole('button',{name:'移液设置（可选）',exact:true});
  await trigger.click();await page.getByRole('textbox',{name:'设备下限（µL）',exact:true}).fill('1');
  await trigger.click();await trigger.click();assert.equal(await page.getByRole('textbox',{name:'设备下限（µL）',exact:true}).inputValue(),'1');
  await page.getByRole('textbox',{name:'设备下限（µL）',exact:true}).fill('');await trigger.click();
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`${out}/${engine}-${width}-${theme}-input.png`});
  await page.getByRole('button',{name:'计算',exact:true}).click();
  const result=page.locator('[data-calculator-result]');await result.waitFor();assert((await result.innerText()).includes('514.8'));
  if(width<768)assert.equal(await page.locator('.calculator-input-panel').isVisible(),false);
  await page.evaluate(()=>{window.__copyObserved='';document.addEventListener('copy',()=>{const n=document.activeElement;if(n instanceof HTMLTextAreaElement)window.__copyObserved=n.value;});});
  await page.getByRole('button',{name:'复制',exact:true}).click();
  const manual=page.getByRole('textbox',{name:'完整结果',exact:true});
  const copyMethod=await manual.count()?'manual panel':'native compatibility copy event observed';
  const copied=await manual.count()?await manual.inputValue():await page.evaluate(()=>window.__copyObserved);
  assert(copied.includes('2× Mix'));assert(copied.includes('Template'));assert(!copied.includes('Operations'));assert(!copied.includes('"samples"'));
  await page.locator('.reaction-result-toolbar summary').filter({hasText:'导出'}).click();
  const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'导出CSV',exact:true}).click()]);
  const csv=await readFile(await download.path(),'utf8');assert(csv.includes('2× Mix'));assert(csv.includes('286'));
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`${out}/${engine}-${width}-${theme}-result.png`});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  if(width<768)await page.locator('.calculator-pane-switch').first().getByRole('button',{name:'配方 / 数据',exact:true}).click();
  await page.locator('[data-field-key=reactionVolumeUl] input').fill('0');await page.getByRole('button',{name:'计算',exact:true}).click();
  assert.equal(await result.count(),0);assert.equal(await page.getByRole('button',{name:'复制',exact:true}).count(),0);assert.deepEqual(errors,[]);
  report.checks.push({engine,width,theme,actualMode:await page.evaluate(()=>document.documentElement.dataset.labnestMode),status:'passed',origin:base,secureContext:await page.evaluate(()=>isSecureContext),actualPremixUl:514.8,copy:copyMethod,copyScope:'outgoing text verified; OS paste not claimed',csv:'downloaded and read back',physicalPhone:'not executed'});
  await context.close();
 }}finally{await browser.close();await writeFile(`${out}/browser.json`,JSON.stringify(report,null,2));}
}
