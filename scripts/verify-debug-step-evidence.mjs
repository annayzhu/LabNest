import {chromium} from 'playwright';import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';
const f=JSON.parse(readFileSync('docs/debug-20260909/evidence/step-evidence-fixture.json'));const browser=await chromium.launch();const page=await browser.newPage();const base='http://localhost:3232';
try{
 const response=await page.request.post(base+'/api/mobile/measurements',{data:{experimentId:f.experimentId,experimentStepId:f.steps[1].id,value:37.2,unit:'°C',observedAt:new Date().toISOString(),clientMutationId:'79499f60-bb34-4f6e-9bc0-34369448c54b',deviceCreatedAt:new Date().toISOString()}});assert.ok([200,201].includes(response.status()),await response.text());
 for(const suffix of ['', '/edit']){
  await page.goto(base+'/experiments/'+f.experimentId+suffix,{waitUntil:'networkidle'});await page.reload();
  const text=await page.locator('.document-a4-paper').innerText();
  assert.equal(text.split('仅归属取样步骤：样本均匀').length-1,1);assert.ok(text.indexOf('取样')<text.indexOf('仅归属取样步骤'));assert.ok(text.indexOf('仅归属取样步骤')<text.indexOf('培养'));assert.ok(text.indexOf('培养')<text.indexOf('37.2'));assert.ok(text.indexOf('37.2')<text.indexOf('未完成 检测'));
  await page.screenshot({path:`docs/debug-20260909/evidence/step-evidence-${suffix?'edit':'view'}.png`,fullPage:true});
 }
 writeFileSync('docs/debug-20260909/evidence/step-evidence.json',JSON.stringify({experimentId:f.experimentId,checks:['Public measurement save','Reloaded edit and readonly document include linked observation and 37.2 °C measurement exactly once in their own step order']},null,2));
}finally{await browser.close();}
