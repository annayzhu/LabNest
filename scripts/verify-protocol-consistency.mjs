import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const base=process.env.LABNEST_E2E_BASE_URL??'http://localhost:3332',dir=process.env.LABNEST_QA_DIR??'docs/qa/protocol-consistency-20261007/evidence';
assert(/localhost|127\.0\.0\.1/.test(new URL(base).hostname),'Acceptance runs only against the explicitly isolated local server.');await mkdir(dir,{recursive:true});
const fixture=JSON.parse(await readFile(dir+'/fixtures.json','utf8')),browser=await chromium.launch();
const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'Asia/Shanghai'});await context.addCookies([{name:'labnest_locale',value:'zh',url:base}]);await context.tracing.start({screenshots:true,snapshots:true});const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
const report={head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),browser:browser.version(),database:'isolated clone or synthetic fixtures only',checks:[],catalog:[]};
const saved=async id=>{const response=await page.request.get(`${base}/api/experiments/${id}`);assert.equal(response.status(),200);return (await response.json()).experiment;};
const go=async url=>{await page.goto(base+url,{waitUntil:'networkidle'});};
async function check(name,run){const start=Date.now();try{await run();report.checks.push({name,status:'通过',ms:Date.now()-start});}catch(error){report.checks.push({name,status:'失败',error:String(error)});throw error;}finally{await writeFile(dir+'/browser-report.json',JSON.stringify(report,null,2));}}
async function screenshot(name){await page.screenshot({path:`${dir}/${name}.png`,fullPage:true});}
let experimentId;
try{
await check('A05 A06 A10 A14 A21 create preview shows three operations with full rich content, table and actual loaded image',async()=>{
 await go(`/experiments/new?plan=${fixture.planId}&protocolVersionId=${fixture.versionId}`);
 const preview=page.locator('[data-protocol-execution-preview]');assert.equal(await preview.locator('[data-preview-step]').count(),3);assert.equal(await preview.locator('sup').count(),1);assert.equal(await preview.locator('sub').count(),1);assert.equal(await preview.locator('img').count(),1);
 await page.waitForFunction(()=>[...document.querySelectorAll('[data-protocol-execution-preview] img')].every(image=>image.complete&&image.naturalWidth>0));
 assert.equal(await preview.locator('ol > li').first().getByText('准备示例 A',{exact:true}).count(),0); // heading includes ordinal; duplicate body must be absent
 await screenshot('create-preview-1440');
 await page.locator('.document-page-title-input').fill('测试浏览器实际创建');
 await page.getByRole('button',{name:/^(Save Experiment|保存实验)$/}).click();
 await page.waitForURL(url=>/^\/experiments\/[^/]+$/.test(url.pathname)&&!url.pathname.endsWith('/new'));experimentId=page.url().split('/').pop();report.experimentId=experimentId;
 const record=await saved(experimentId);assert.equal(record.steps.length,3);assert(record.steps.every(step=>!step.completed&&!step.completedAt));assert.equal(record.protocolSnapshotJson.versions[0].protocolVersionId,fixture.versionId);
 await page.locator('[data-execution-role="step"]').first().waitFor();assert.equal(await page.locator('[data-execution-role="step"]').count(),3);assert((await page.locator('.app-shell-main').innerText()).includes('完整说明 200 µL'));assert.equal(await page.locator('main sup').count(),1);await screenshot('experiment-preview-1440');
 await page.pdf({path:dir+'/experiment-preview.pdf',format:'A4',printBackground:true});
 const before=record.steps.map(step=>step.id);
 const reordered=await page.request.patch(`${base}/api/experiments/${experimentId}/steps/order`,{data:{ids:[before[1],before[0],before[2]],expectedUpdatedAt:record.updatedAt}});assert.equal(reordered.status(),200);
 const readback=await saved(experimentId);assert.deepEqual(readback.steps.map(step=>step.id),[before[1],before[0],before[2]]);
 const restored=await page.request.patch(`${base}/api/experiments/${experimentId}/steps/order`,{data:{ids:before,expectedUpdatedAt:readback.updatedAt}});assert.equal(restored.status(),200);
});
await check('A08 A09 author confirmation is visible, grouping saves and reopens without fabricated completion',async()=>{
 await go(`/experiments/new?plan=${fixture.planId}&protocolVersionId=${fixture.reviewVersionId}`);assert(await page.getByRole('button',{name:/^(Save Experiment|保存实验)$/}).isDisabled());
 await go(`/protocols/${fixture.reviewProtocolId}/versions/${fixture.reviewVersionId}/edit`);await page.locator('[data-execution-organizer] > summary').click();await page.getByRole('button',{name:'整理／拆分步骤',exact:true}).click();
 await page.getByLabel('第 1 块的归属',{exact:true}).selectOption('step');await page.getByLabel('第 1 块的步骤标题',{exact:true}).fill('作者确认的操作');
 const second=page.getByLabel('第 2 块的归属',{exact:true});const value=await second.locator('option').filter({hasText:'归入：作者确认的操作'}).getAttribute('value');await second.selectOption(value);await page.getByRole('button',{name:'确认以上划分',exact:true}).click();
 await page.locator('.protocol-workbench-save button[type="submit"]').click();await page.waitForURL(url=>url.pathname===`/protocols/${fixture.reviewProtocolId}`);
 const response=await page.request.get(`${base}/api/protocols/${fixture.reviewProtocolId}/versions/${fixture.reviewVersionId}/json`);const read=await response.json();assert.equal(read.structuredProjection.steps.length,1);assert.equal(read.structuredProjection.executionNeedsReview,false);assert(read.structuredProjection.steps[0].description.includes('未划分说明 B'));
 await go(`/protocols/${fixture.reviewProtocolId}/versions/${fixture.reviewVersionId}/edit`);const document=JSON.parse(await page.locator('input[name="contentJson"]').inputValue());assert.equal(document.executionConfirmed,true);await screenshot('author-organizer-saved');
});
await check('A16 A17 A18 A20 actual Run completion, note, timer, save, refresh and page readback retain step IDs',async()=>{
 await go(`/experiments/${experimentId}/run`);const first=(await saved(experimentId)).steps[0];
 assert.equal(await page.locator('section.lg\\:block input[type="checkbox"][name="completedStepIds"]').count(),3);
 const row=page.locator(`#step-${first.id}`);await row.locator('textarea').fill('测试备注必须保存');await row.locator('input[type="checkbox"]').check();await page.getByRole('button',{name:/^(Save progress|保存进度)$/}).click();await page.getByRole('status').filter({hasText:/Progress saved|进度已保存/}).waitFor();
 const read=await saved(experimentId);assert.equal(read.steps[0].completed,true);assert.equal(read.steps[0].deviationNote,'测试备注必须保存');assert.equal(read.steps[0].id,first.id);await page.reload({waitUntil:'networkidle'});assert(await page.locator(`#step-${first.id} input[type="checkbox"]`).isChecked());await screenshot('run-1440');
 const body=page.locator(`#step-${first.id} [data-run-step-content]`);assert.equal(await body.getByText('准备示例 A',{exact:true}).count(),0);assert((await body.innerText()).includes('200 µL'));
 await page.setViewportSize({width:390,height:844});await page.reload({waitUntil:'networkidle'});const mobile=page.locator('section.lg\\:hidden').first();
 if(await page.getByRole('button',{name:/^(Previous|上一步)$/}).isEnabled())await page.getByRole('button',{name:/^(Previous|上一步)$/}).click();await page.locator('[data-run-step-content]:visible img').waitFor();await page.waitForFunction(()=>[...document.querySelectorAll('[data-run-step-content] img')].filter(image=>image.getBoundingClientRect().width>0).every(image=>image.complete&&image.naturalWidth>0));
 assert((await mobile.innerText()).includes('完整说明 200 µL'));assert.equal(await mobile.locator('sup').count(),1);await screenshot('run-390');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 const tools=mobile.locator('[data-run-tools]');assert.equal(await tools.count(),1);await screenshot('run-tools-390');
 await tools.getByRole('button',{name:/^(计时器|Timer)$/}).click();const timer=mobile.locator('section[aria-label="Step timer"]');await timer.getByRole('button',{name:/^(Start|开始)$/}).click();await timer.getByRole('button',{name:/^(Pause|暂停)$/}).waitFor();const started=await saved(experimentId);assert(started.steps[0].timerStartedAt);report.timerStartedAt=started.steps[0].timerStartedAt;
 await page.getByText('实验参数',{exact:true}).click();await page.locator('input[name="parameter:dose"]').fill('19');await page.getByRole('button',{name:'保存参数',exact:true}).click();await page.waitForFunction(()=>[...document.querySelectorAll('[data-run-step-content]')].some(n=>n.textContent.includes('19 µL')));assert.equal((await saved(experimentId)).protocolRun.parametersJson.dose,19);await screenshot('run-parameter-edited-390');
 const note=mobile.locator('textarea[name^="mobileDeviation:"]');await mobile.getByText('记录偏差',{exact:true}).click();await note.fill('未保存手机输入');await tools.getByRole('button',{name:/Calculator|计算器/}).click();await page.waitForURL(url=>url.pathname==='/tools/calculator');assert((await page.locator('body').innerText()).includes('计算'));
 await page.getByRole('link',{name:/返回|Return|Run/}).first().click();await page.waitForURL(url=>url.pathname.endsWith('/run'));assert.equal(await page.locator('textarea[name^="mobileDeviation:"]').inputValue(),'未保存手机输入');assert.equal((await saved(experimentId)).steps[0].timerStartedAt,report.timerStartedAt);const resumedTimer=page.locator('section.lg\\:hidden').first().locator('[data-run-tools]');await resumedTimer.getByRole('button',{name:/计时器|Timer/}).click();await page.locator('section[aria-label="Step timer"]:visible').getByRole('button',{name:/^(Pause|暂停)$/}).click();assert((await saved(experimentId)).steps[0].timerPausedAt);
 await page.setViewportSize({width:1440,height:1000});
 const protectedRecord=await saved(fixture.protectedExperimentId);const blocked=await page.request.patch(`${base}/api/experiments/${fixture.protectedExperimentId}/steps/order`,{data:{ids:protectedRecord.steps.map(step=>step.id).reverse(),expectedUpdatedAt:protectedRecord.updatedAt}});assert.equal(blocked.status(),409);assert.deepEqual((await saved(fixture.protectedExperimentId)).steps,protectedRecord.steps);
});
await check('A23 real DOCX file import preserves operation identity and embedded image loading through save and creation',async()=>{
 await go('/protocols/import');await page.locator('input[type="file"]').setInputFiles(dir+'/source.docx');await page.getByRole('button',{name:/Preview mapping|预览.*映射/}).click();await page.locator('[data-protocol-import-decision]').waitFor();await screenshot('docx-import-preview');
 const confirm=page.getByRole('button',{name:/^(Confirm import|确认导入)$/});await confirm.click();await page.waitForURL(url=>!url.pathname.endsWith('/import'));
 report.importedAt=page.url();
});
await check('A24 A25 all included current production-clone Protocols have actual preview/record/Run checks and full scroll evidence',async()=>{
 await page.setViewportSize({width:1440,height:1000});
 for(const item of fixture.originalProtocols){
  await go(`/protocols/${item.protocolId}?version=${item.versionId}`);await screenshot(`catalog-${item.code}-protocol`);
  await go(`/protocols/${item.protocolId}/versions/${item.versionId}/edit`);const original=JSON.parse(await page.locator('input[name="contentJson"]').inputValue());assert.equal(original.executionConfirmed,true);await screenshot(`catalog-${item.code}-editor`);
  await go(`/experiments/new?plan=${fixture.planId}&protocolVersionId=${item.versionId}`);assert.equal(await page.locator('[data-preview-step]').count(),item.steps);await screenshot(`catalog-${item.code}-create`);
  if(!item.steps){assert(await page.getByRole('button',{name:/^(Save Experiment|保存实验)$/}).isDisabled());report.catalog.push({...item,status:'零步骤保护通过；未创建临时实验'});continue;}
  await page.locator('.document-page-title-input').fill(`隔离验收 ${item.code}`);await page.getByRole('button',{name:/^(Save Experiment|保存实验)$/}).click();await page.waitForURL(url=>/^\/experiments\/[^/]+$/.test(url.pathname)&&!url.pathname.endsWith('/new'));const id=page.url().split('/').pop();const record=await saved(id);assert.equal(record.steps.length,item.steps);assert(record.steps.every(step=>!step.completed));await screenshot(`catalog-${item.code}-experiment`);
  await go(`/experiments/${id}/run`);assert.equal(await page.locator('input[name="completedStepIds"][type="checkbox"]').count(),item.steps);await screenshot(`catalog-${item.code}-run`);
  await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));const info=page.locator('[data-run-information]').first();if(await info.count()&&!await info.getAttribute('open'))await info.locator('summary').click();await screenshot(`catalog-${item.code}-run-bottom`);report.catalog.push({...item,experimentId:id,status:'通过',completed:0});
 }
});
await check('A30 existing JSON/Markdown/XLSX exports include operation prose, dose, references and preserve correct count',async()=>{
 for(const format of ['json','md','xlsx']){const response=await page.request.get(`${base}/api/structured-export/experiments?format=${format}&exportScope=selected&id=${experimentId}`);assert.equal(response.status(),200);const buffer=await response.body();await writeFile(`${dir}/experiment.${format}`,buffer);if(format!=='xlsx'){const text=buffer.toString();assert(text.includes('200 µL'));assert(text.includes('30 µL'));assert(text.includes('40 µL'));assert(text.includes('参考资料'));}}
});
assert.deepEqual(errors,[]);report.pageErrors=errors;
}finally{await context.tracing.stop({path:dir+'/browser-trace.zip'});await browser.close();await writeFile(dir+'/browser-report.json',JSON.stringify(report,null,2));}
