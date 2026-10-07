import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {chromium,webkit} from 'playwright';
import {unzipSync,strFromU8} from 'fflate';
import {DOMParser} from '@xmldom/xmldom';

const base=process.env.LABNEST_E2E_BASE_URL??'http://localhost:3221';
const dir=process.env.PLATE_EVIDENCE_DIR??'docs/calculator/plate-integration-20261007/evidence';
await mkdir(dir,{recursive:true});
const report={base,sha:process.env.PLATE_APPLICATION_SHA??execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),at:new Date().toISOString(),fixture:'Synthetic local browser workspaces; no production database writes',toolChecks:[],checks:[],failures:[]};
const key='plate-layout-studio:workspace:v2';
const toolFixtures=JSON.parse(execFileSync(process.execPath,['--require','tsx/cjs','-e',"const {getCalculatorDefinition}=require('./src/lib/calculators/calculator-engine.ts');console.log(JSON.stringify(['seeding','hydrogel','kill-curve','fold-dilution','moi'].map(id=>getCalculatorDefinition(id))))"],{encoding:'utf8'}));
async function saved(page){return page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);}
async function open(page){await page.locator('.plate-calculator-launch[data-plate-calculator="master-mix"]').click();const f=page.frameLocator('.plate-calculator-frame');await f.getByRole('button',{name:'添加组分',exact:true}).waitFor();return f;}
async function recipe(f,n){
 for(const [label,value] of [['样本数',String(n)],['每样本重复数','1'],['额外对照反应数','0'],['预混余量','10'],['单反应总体积','20']])await f.getByRole('textbox',{name:new RegExp(`^${label}`)}).fill(value);
 await recipeRows(f);
}
async function recipeRows(f){
 for(const [index,row] of [['SYBR','10',true],['Forward','0.5',true],['Reverse','0.5',true],['Template','1',false]].entries()){
  await f.getByRole('button',{name:'添加组分',exact:true}).click();
  const r=f.locator(`tr[data-mix-row="${index}"]`).first();
  await r.getByRole('textbox',{name:'组分名称',exact:true}).fill(row[0]);
  await r.getByRole('textbox',{name:'每反应体积',exact:true}).fill(row[1]);
  await r.getByRole('checkbox',{name:'加入预混',exact:true}).setChecked(row[2]);
 }
}
async function calculateAndSave(page,f){assert.notEqual(await f.getByRole('textbox',{name:/^预混余量/}).inputValue(),'','reserve input must remain after editing');await f.getByRole('button',{name:'计算',exact:true}).click();await f.getByRole('button',{name:'保存为当前板方案',exact:true}).click();await page.locator('#liquidDrawer').waitFor({state:'hidden'});}

for(const [engine,type] of Object.entries(process.env.PLATE_BROWSER==='chromium'?{chromium}:{chromium,webkit})){
 const browser=await type.launch();
 try{
  const toolsContext=await browser.newContext({viewport:{width:1440,height:900}});const toolsPage=await toolsContext.newPage();
  await toolsPage.goto(`${base}/tools/free-plate-layout/index.html?v=20261008-main-calculator`,{waitUntil:'networkidle'});
  for(const definition of toolFixtures){
   try{
    await toolsPage.locator(`.plate-calculator-launch[data-plate-calculator="${definition.id}"]`).click();
    const frame=toolsPage.frameLocator('.plate-calculator-frame');await frame.locator(`[data-calculator="${definition.id}"]`).waitFor();
    const inputs={...definition.exampleInputs};if('wells' in inputs)inputs.wells=24;
    for(const field of [...definition.fields.filter(f=>f.type==='select'),...definition.fields.filter(f=>f.type!=='select')]){
     if(inputs[field.key]===undefined)continue;
     const target=frame.locator(`[data-field-key="${field.key}"]`).locator(field.type==='select'?'select':'input,textarea').first();
     if(!await target.count())continue;
     if(field.type==='select')await target.selectOption(String(inputs[field.key]));else await target.fill(String(inputs[field.key]));
    }
    await frame.getByRole('button',{name:'计算',exact:true}).click();await frame.getByRole('button',{name:'保存为当前板方案',exact:true}).click();await toolsPage.locator('#liquidDrawer').waitFor({state:'hidden'});
    const current=(await saved(toolsPage)).plates[0].liquidPlans;assert.equal(current.length,1);assert.equal(current[0].calculatorId,definition.id);assert(current[0].contributions.length>0);
    report.toolChecks.push({engine,calculatorId:definition.id,scope:current[0].scopeWellIds.length,methodVersion:current[0].resultSnapshot.methodVersion,outputs:current[0].resultSnapshot.outputs,passed:'Actual editor inputs → calculate → save → current plan and typed contributions'});
   }catch(error){report.failures.push({engine,calculatorId:definition.id,message:error.message});await toolsPage.locator('#closeLiquidDrawerButton').click().catch(()=>{});}
  }
  await toolsContext.close();
  for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:900},acceptDownloads:true});
  await context.addInitScript(()=>localStorage.setItem('labnest.locale','zh'));
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const id=`${engine}-${width}`;
  try{
   await page.goto(`${base}/tools`,{waitUntil:'networkidle'});
   const launch=page.locator('a[href*="/tools/free-plate-layout/index.html"]').first();
   assert(await launch.count(),'Tools must expose the planner');const href=await launch.getAttribute('href');assert(href.includes('v=20261008-main-calculator'));
   // Follow exactly the link exposed by Tools in an isolated browser context.
   await page.goto(new URL(href,base).href,{waitUntil:'networkidle'});
   let f=await open(page);await recipe(f,24);
   assert.equal(await f.getByRole('navigation',{name:'Reaction modes'}).count(),0);
   assert.equal(await f.getByRole('combobox',{name:'计算依据',exact:true}).count(),4);
   await page.screenshot({path:`${dir}/${id}-editor-light.png`,fullPage:true});
   await f.getByRole('button',{name:'计算',exact:true}).click();
   // Same-origin messages from other windows, and stale session tokens, must not publish.
   const forged=await page.evaluate(()=>{
     const params=new URL(document.querySelector('.plate-calculator-frame').src).searchParams;
     const plateContext={workspaceId:params.get('workspaceId'),plateId:params.get('plateId'),plateName:params.get('plateName'),plateSize:Number(params.get('plateSize')),wellIds:params.get('wellIds').split(','),requestId:params.get('requestId')};
     const inputs={samples:24,replicates:1,controls:0,overagePercent:10,reactionVolumeUl:20,rows:[{name:'Fake',volume:'10',premix:true}]};
     const payload={...window.LabNestCalculations.calculate({calculatorId:'master-mix',inputs}),type:'labnest:calculator-result',calculatorId:'master-mix',plateContext,inputs};
     window.postMessage(payload,location.origin);return payload;
   });
   await f.locator('body').evaluate((node,payload)=>node.ownerDocument.defaultView.parent.postMessage({...payload,plateContext:{...payload.plateContext,requestId:'stale-token'}},location.origin),forged);
   assert.equal((await saved(page))?.plates[0].liquidPlans.length??0,0);
   await f.locator('body').evaluate(node=>{const parent=node.ownerDocument.defaultView.parent;const original=parent.postMessage;parent.postMessage=function(message,origin){original.call(parent,message,origin);if(message?.type==='labnest:calculator-result'){original.call(parent,message,origin);parent.postMessage=original;}};});
   await f.getByRole('button',{name:'保存为当前板方案',exact:true}).click();await page.locator('#liquidDrawer').waitFor({state:'hidden'});
   let ws=await saved(page),plan=ws.plates[0].liquidPlans[0];assert.equal(ws.plates[0].liquidPlans.length,1);assert.equal(plan.input.rows.length,4);assert.equal(plan.resultSnapshot.operations.length,6);
   assert(Math.abs(plan.contributions.filter(c=>c.applyOverage).reduce((n,c)=>n+c.savedPreparedVolume,0)-501.6)<1e-8);
   assert.equal(plan.contributions.find(c=>!c.applyOverage).baseVolume,24);
   assert.equal((await saved(page)).plates[0].calculationLog.length,1,'duplicate apply must not write twice');
   await page.reload({waitUntil:'networkidle'});await page.locator('[data-liquid-plan-action="edit"]').click();
   f=page.frameLocator('.plate-calculator-frame');await f.getByRole('textbox',{name:'组分名称',exact:true}).first().waitFor();
   assert.equal(await f.getByRole('textbox',{name:'组分名称',exact:true}).first().inputValue(),'SYBR');assert.equal(await f.getByRole('checkbox',{name:'加入预混',exact:true}).last().isChecked(),false);
   // Concentration editor and full source inputs survive save/reopen, not just a text rendering.
   await f.getByRole('combobox',{name:'计算依据',exact:true}).first().selectOption('concentration');
   await f.locator('input[data-mix-field="stock"]').fill('2');await f.locator('input[data-mix-field="target"]').fill('1');
   await calculateAndSave(page,f);ws=await saved(page);assert.equal(ws.plates[0].liquidPlans.length,1);assert.equal(ws.plates[0].liquidPlans[0].id,plan.id);assert.equal(ws.plates[0].liquidPlans[0].input.rows[0].stock,'2');
   await page.locator('#undoButton').click();assert.equal((await saved(page)).plates[0].liquidPlans[0].input.rows[0].inputMode,undefined);
   await page.locator('#redoButton').click();assert.equal((await saved(page)).plates[0].liquidPlans[0].input.rows[0].stock,'2');
   // Keep the scientific recipe equal for cross-board aggregation.
   await page.locator('[data-liquid-plan-action="edit"]').click();f=page.frameLocator('.plate-calculator-frame');await f.locator('input[data-mix-field="stock"]').waitFor();
   await f.getByRole('combobox',{name:'计算依据',exact:true}).first().selectOption('volume');await calculateAndSave(page,f);
   await page.locator('#addPlateButton').click();
   // A new board has no plan; select twelve wells using normal multi-select.
   for(const well of ['A1','A2','A3','A4','A5','A6','B1','B2','B3','B4','B5','B6'])await page.locator(`[data-well="${well}"]`).click({modifiers:['ControlOrMeta']});
   f=await open(page);await recipe(f,12);await calculateAndSave(page,f);
   await page.locator('#projectLiquidScope').selectOption('all');await page.locator('#projectLiquidSummaryButton').click();
   ws=await saved(page);const summary=ws.latestLiquidSummary;assert(summary);
   const premixes=summary.groups.filter(g=>g.tubeRole==='premix');assert.equal(premixes.length,1);
   assert(Math.abs(premixes[0].components.reduce((n,c)=>n+c.preparedVolume,0)-752.4)<1e-8);
   assert.equal(summary.groups.filter(g=>g.tubeRole==='separate').reduce((n,g)=>n+g.components.reduce((s,c)=>s+c.preparedVolume,0),0),36);
   await page.locator('#undoButton').click();assert.equal((await saved(page)).latestLiquidSummary,null,'undo must invalidate generated summary');await page.locator('#redoButton').click();assert.equal((await saved(page)).latestLiquidSummary,null);await page.locator('#projectLiquidSummaryButton').click();
   await page.locator('[data-open-liquid-summary]').click();await page.screenshot({path:`${dir}/${id}-summary-light.png`,fullPage:true});await page.keyboard.press('Escape');
   const downloadEvent=page.waitForEvent('download');await page.locator('#exportXlsxButton').click();const xlsx=await downloadEvent;const xlsxPath=`${dir}/${id}-project.xlsx`;await xlsx.saveAs(xlsxPath);
   const files=unzipSync(await readFile(xlsxPath));const xml=Object.entries(files).filter(([name])=>name.endsWith('.xml')).map(([,data])=>strFromU8(data)).join('\n');
   for(const text of ['Template','独立加样','取液来源','stock:0'])assert(xml.includes(text),`XLSX must retain ${text}`);
   const sumPrepared=(sheet)=>{const doc=new DOMParser().parseFromString(strFromU8(files[sheet]),'text/xml');return [...doc.getElementsByTagName('c')].filter(c=>/^H[2-9]\d*$/.test(c.getAttribute('r'))).reduce((sum,c)=>sum+(parseFloat(c.textContent)||0),0);};
   assert(Math.abs(sumPrepared('xl/worksheets/sheet6.xml')-752.4)<1e-8,'XLSX premix components must sum to 752.4 µL');
   assert.equal(sumPrepared('xl/worksheets/sheet7.xml'),36,'XLSX separate templates must total 36 µL');
   const backupEvent=page.waitForEvent('download');await page.locator('#exportJsonButton').click();const json=await backupEvent;const jsonPath=`${dir}/${id}-workspace.json`;await json.saveAs(jsonPath);const backup=JSON.parse(await readFile(jsonPath,'utf8'));assert.deepEqual(backup.plates.map(p=>p.liquidPlans[0].input),ws.plates.map(p=>p.liquidPlans[0].input));
   await page.locator('#openBackupRestoreButton').click();await page.locator('#restoreJsonInput').setInputFiles(jsonPath);await page.locator('#confirmRestoreButton').click();
   assert.deepEqual((await saved(page)).plates.map(p=>p.liquidPlans[0].input),backup.plates.map(p=>p.liquidPlans[0].input),'JSON restored through the real import dialog');
   await page.locator('[data-liquid-plan-action="edit"]').click();f=page.frameLocator('.plate-calculator-frame');await f.getByText('多组配液',{exact:true}).click();
   await f.locator('[data-group-name]').fill('A');await f.locator('[data-group-reactions]').fill('5');
   await f.getByRole('button',{name:'添加分组',exact:true}).click();await f.locator('[data-group-name]').fill('B');await f.locator('[data-group-reactions]').fill('7');await recipeRows(f);
   await f.getByRole('button',{name:'计算',exact:true}).click();
   const scopes=await f.locator('[data-plate-group-scopes]').innerText();assert(scopes.includes('A: A1, A2, A3, A4, A5'));assert(scopes.includes('B: A6, B1'));
   await f.getByRole('button',{name:'保存为当前板方案',exact:true}).click();await page.locator('#liquidDrawer').waitFor({state:'hidden'});
   assert.equal((await saved(page)).plates[1].liquidPlans.length,1);assert.equal((await saved(page)).plates[1].liquidPlans[0].input.groups.length,2);
   // Offline save to local workspace remains readable on refresh of the already open page.
   await context.setOffline(true);await page.locator('#projectName').fill('Offline board');await page.locator('#projectName').blur();assert.equal((await saved(page)).plates[1].name,'Offline board');await context.setOffline(false);await page.reload({waitUntil:'networkidle'});assert.equal((await saved(page)).plates[1].name,'Offline board');
   await page.locator('[data-well="A1"]').click();await page.locator('#selectionEditor input.parameter-value[data-dimension="sample"]').fill('Changed sample');await page.locator('#applyParametersButton').click();
   // Changed well contents invalidate the current plan, and its preparation is excluded from the next summary.
   await page.locator('#projectLiquidScope').selectOption('all');await page.locator('#projectLiquidSummaryButton').click();
   const after=await saved(page);assert.equal(after.plates[1].liquidPlans[0].stale,true);assert(after.latestLiquidSummary.groups.every(g=>g.sources.every(s=>s.plateId!==after.plates[1].id)));
   await page.locator('[data-liquid-plan-action="edit"]').click();f=page.frameLocator('.plate-calculator-frame');await f.locator('[data-group-name]').waitFor();await f.locator('body').evaluate(node=>node.ownerDocument.documentElement.setAttribute('data-labnest-mode','dark'));
   await page.screenshot({path:`${dir}/${id}-editor-dark.png`,fullPage:true});
   // Synthetic legacy project: two current plans and a stale newer plan must archive safely on real import.
   await page.locator('#closeLiquidDrawerButton').click();
   const legacy=structuredClone(backup);const old={...legacy.plates[0].liquidPlans[0],id:'legacy-old',updatedAt:'2026-01-01',input:{original:'preserved'}};
   legacy.plates[0].liquidPlans.push(old,{...old,id:'legacy-stale',stale:true,status:'stale',updatedAt:'2026-12-01'});
   const legacyPath=`${dir}/${id}-legacy-synthetic.json`;await writeFile(legacyPath,JSON.stringify(legacy));
   await page.locator('#openBackupRestoreButton').click();await page.locator('#restoreJsonInput').setInputFiles(legacyPath);await page.locator('#confirmRestoreButton').click();
   const migrated=await saved(page);assert.equal(migrated.plates[0].liquidPlans.length,1);assert.equal(migrated.plates[0].archivedLiquidPlans.length,2);assert.equal(migrated.latestLiquidSummary,null);
   await page.reload({waitUntil:'networkidle'});assert.equal((await saved(page)).plates[0].archivedLiquidPlans.find(p=>p.id==='legacy-old').input.original,'preserved');
   assert.deepEqual(errors,[]);report.checks.push({engine,width,passed:['Tools current entry','main row/concentration editor','multiple groups saved with explicit disjoint well mapping','save/reopen/refresh','one current plan','forged origin-window/session and duplicate apply rejected','undo/redo','shared reserve once; separate templates unpooled','JSON backup/restore and XLSX cell readback','offline local write and reconnect','stale exclusion','synthetic legacy migration/archive retained after refresh'],screenshots:[`${id}-editor-light.png`,`${id}-summary-light.png`,`${id}-editor-dark.png`]});
  }catch(error){report.failures.push({engine,width,message:error.message});await page.screenshot({path:`${dir}/${id}-failure.png`,fullPage:true}).catch(()=>{});console.error(id,error.stack);}
  await context.close();
 }}finally{await browser.close();}
}
await writeFile(`${dir}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));assert.equal(report.failures.length,0,'Plate integration acceptance failed');
