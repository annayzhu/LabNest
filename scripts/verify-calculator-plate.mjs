import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const base=process.env.LABNEST_E2E_BASE_URL??'http://localhost:3221';const browser=await chromium.launch(),page=await browser.newPage();
try{
 await page.goto(`${base}/tools/calculator`,{waitUntil:'networkidle'});
 const wells=Array.from({length:12},(_,i)=>`A${i+1}`).join(',');
 const url=`${base}/tools/calculator/seeding?source=plate&workspaceId=fixture-workspace&plateId=fixture-plate&plateName=Synthetic&plateSize=24&wellIds=${wells}&embed=plate&locale=en`;
 await page.evaluate(url=>{window.calculatorPayload=null;window.addEventListener('message',event=>{if(event.origin===location.origin&&event.data?.type==='labnest:calculator-result')window.calculatorPayload=event.data;});const frame=document.createElement('iframe');frame.src=url;frame.title='Plate calculator';frame.style='width:800px;height:900px';document.body.append(frame);},url);
 const frame=page.frameLocator('iframe[title="Plate calculator"]');
 const input=name=>frame.getByRole('textbox',{name:new RegExp(`^${name}`)});
 await input('Wells').waitFor();assert.equal(await input('Wells').inputValue(),'12');
 for(const [name,value] of [['Viable-cell concentration','2e6'],['Cells per well','50000'],['Volume per well','500'],['Overage','10']])await input(name).fill(value);
 await frame.getByRole('combobox',{name:'Volume per well unit'}).selectOption('mL');assert.equal(await input('Volume per well').inputValue(),'0.5');
 await frame.getByRole('button',{name:'Send to selected wells'}).click();await page.waitForFunction(()=>window.calculatorPayload!==null);const payload=await page.evaluate(()=>window.calculatorPayload);assert.equal(payload.inputs.wells,'12');assert(Math.abs(payload.inputs.volumePerWellUl-500)<1e-9);assert.equal(payload.inputs.volumePerWellUlUnit,'µL');assert.equal(payload.rawInputs.volumePerWellUl,'0.5');assert.equal(payload.plateContext.wellIds.length,12);assert(Math.abs(payload.outputs.find(output=>output.key==='finalVolumeMl').value-6.6)<1e-10);
 const report={completedAt:new Date().toISOString(),checks:['Selected twelve wells used once','Unit switch preserves 500 µL physical quantity','Plate adapter emits expected µL with raw inputs retained','Batch final volume 6.6 mL, not a full-plate multiple']};await writeFile('docs/calculator/evidence/plate-report.json',JSON.stringify(report,null,2));console.log(report);
}finally{await browser.close();}
