import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const base=process.env.LABNEST_E2E_BASE_URL??'http://localhost:3338';
assert(['localhost','127.0.0.1'].includes(new URL(base).hostname)&&new URL(base).port!=='3001');
const out='docs/structured-protocol/20261014/followup-evidence'; await mkdir(out,{recursive:true});
const f=JSON.parse(await readFile(`${out}/groups-fixture.json`,'utf8'));
const browser=await chromium.launch(),context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
await context.addCookies([{name:'labnest_locale',value:'zh',url:base}]);
const report={head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),dirty:true,synthetic:true,checks:[]};
page.setDefaultTimeout(20000);
const read=async()=> (await (await page.request.get(`${base}/api/experiments/${f.experimentId}`)).json()).experiment;
const wait=async predicate=>{for(let n=0;n<150;n++){const e=await read();if(predicate(e))return e;await page.waitForTimeout(100);}throw Error('readback timeout');};
const check=async(name,run)=>{await run();report.checks.push({name,result:'通过'});console.log('PASS',name);};
try {
 await check('Visible multi-system Word download, import authoring and AI destinations',async()=>{
  await page.goto(base+'/protocols/import',{waitUntil:'networkidle'});
  const [file]=await Promise.all([page.waitForEvent('download'),page.getByRole('link',{name:'下载多体系 Word 模板'}).click()]);await file.saveAs(`${out}/multi-system-template.docx`);
  assert((await readFile(`${out}/multi-system-template.docx`)).length>2000);
  await page.screenshot({path:`${out}/import-template-desktop.png`});
  await page.goto(base+'/protocols/new',{waitUntil:'networkidle'});
  await page.getByRole('button',{name:'实验体系与参数',exact:true}).click();assert(await page.locator('#protocol-systems').getAttribute('open')!==null);
  await page.getByRole('button',{name:'步骤整理',exact:true}).click();assert(await page.locator('#protocol-operations').getAttribute('open')!==null);
  await page.screenshot({path:`${out}/authoring-entrances.png`});
  await page.goto(base+'/ai',{waitUntil:'networkidle'});for(const path of ['/actions/manual','/entries','/protocols/import','/actions/review'])assert(await page.locator(`a[href="${path}"]`).count());await page.screenshot({path:`${out}/ai-entrances.png`});
 });
 await check('Real Run configures two experimental groups; independent 50/80 quantities; shared operation counted once',async()=>{
  await page.goto(`${base}/experiments/${f.experimentId}/run`,{waitUntil:'networkidle'});
  await page.getByRole('button',{name:'设置多个实验组'}).click();await page.getByRole('button',{name:'确认分组',exact:true}).click();
  await wait(e=>e.protocolRun.executionPlanJson.groups?.length===2);await page.reload({waitUntil:'networkidle'});
  const forms=page.locator('[data-run-system-selection]');assert.equal(await forms.count(),2);
  for(let index=0;index<2;index++){
   const form=forms.nth(index);if(!await form.isVisible())await form.locator('..').locator('summary').first().click();await form.getByLabel('裂解体积').selectOption(index?'large':'small');await form.getByLabel('样本性质').selectOption('normal');await form.getByLabel('目标终浓度',{exact:true}).fill('10');await form.getByRole('button',{name:'计算并确认采用',exact:true}).click();
   await wait(e=>Object.keys(e.protocolRun.executionPlanJson.versions).length===index+1);await page.reload({waitUntil:'networkidle'});
  }
  const e=await read(),plan=e.protocolRun.executionPlanJson;assert.equal(e.steps.length,7);
  const a=e.steps.find(s=>plan.stepGroups[s.id]===plan.groups[0].id&&s.protocolStepRef.endsWith(':dose')),b=e.steps.find(s=>plan.stepGroups[s.id]===plan.groups[1].id&&s.protocolStepRef.endsWith(':dose'));
  assert((await page.locator(`#step-${a.id}`).innerText()).includes('50 µL'));assert((await page.locator(`#step-${b.id}`).innerText()).includes('80 µL'));
  assert.equal(Object.values(plan.stepGroups).filter(id=>id==='shared').length,1);
  for(const mode of ['light','dark'])for(const width of [1440,390,244]) {await page.setViewportSize({width,height:1000});await page.evaluate(mode=>document.documentElement.dataset.labnestMode=mode,mode);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`overflow ${width}`);await page.screenshot({path:`${out}/groups-${mode}-${width}.png`,fullPage:true});}
  report.fixture={...f,steps:{a:a.id,b:b.id}};
 });
 await check('Frozen cross-step reference remains accessible; copying groups keeps source and resets execution',async()=>{
  await page.setViewportSize({width:1440,height:1000});await page.goto(`${base}/experiments/${f.experimentId}/run`,{waitUntil:'networkidle'});
  const reference=page.locator('[data-run-reference]');await reference.locator(':scope > summary').click();const frozen=reference.locator('details').filter({has:page.locator('summary').filter({hasText:'合成多组体系'})}).first();await frozen.locator(':scope > summary').click();assert((await frozen.innerText()).includes('Proteinase K'));
  const active=page.locator(`#step-${report.fixture.steps.a}`);assert.equal(await active.getByText('加入试剂',{exact:true}).count(),1);await page.screenshot({path:`${out}/frozen-reference.png`});
  await page.goto(`${base}/experiments/${f.experimentId}`,{waitUntil:'networkidle'});await page.getByRole('button',{name:/More actions|更多操作/}).click();await page.getByRole('button',{name:/Copy as new experiment|复制为新实验/}).click();await page.waitForURL(u=>u.pathname.startsWith('/experiments/')&&u.pathname!==`/experiments/${f.experimentId}`);
  const copyId=page.url().split('/').pop(),copy=(await (await page.request.get(`${base}/api/experiments/${copyId}`)).json()).experiment;assert.equal(copy.protocolRun.executionPlanJson.groups.length,2);assert.equal(copy.steps.length,7);assert.deepEqual(copy.protocolRun.executionPlanJson.versions,{});assert.deepEqual(copy.protocolRun.executionPlanJson.actualValues,{});assert(copy.steps.every(s=>!s.completed));
  await page.goto(`${base}/experiments/${copyId}/run`,{waitUntil:'networkidle'});assert.equal(await page.locator('[data-run-system-selection]').count(),2);assert((await page.locator('body').innerText()).includes('尚未确认'));await page.screenshot({path:`${out}/copied-groups-unconfirmed.png`});report.copiedExperimentId=copyId;
 });
} catch(error) {report.error=String(error.stack??error);await page.screenshot({path:`${out}/failure.png`});process.exitCode=1;}
finally{await writeFile(`${out}/browser-report.json`,JSON.stringify(report,null,2));await browser.close();}
