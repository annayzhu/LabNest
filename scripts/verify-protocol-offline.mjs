import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
const base=process.env.LABNEST_E2E_BASE_URL??'http://localhost:3341';assert(['localhost','127.0.0.1'].includes(new URL(base).hostname)&&new URL(base).port!=='3001');
const out='docs/structured-protocol/20261014/followup-evidence',f=JSON.parse(await readFile(`${out}/groups-fixture.json`,'utf8'));
const browser=await chromium.launch(),context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();context.setDefaultTimeout(20000);
await context.addCookies([{name:'labnest_locale',value:'zh',url:base}]);
const report={synthetic:true,browser:browser.version(),checks:[],requests:[]};
page.on('response',async response=>{if(response.request().method()==='POST'&&/\/api\/(mobile|attachments)/.test(response.url()))report.requests.push({url:response.url(),status:response.status(),body:await response.json().catch(()=>null)});});
const read=async()=> (await (await page.request.get(`${base}/api/experiments/${f.offlineExperimentId}`)).json()).experiment;
const queue=()=>page.evaluate(()=>new Promise((resolve,reject)=>{const open=indexedDB.open('labnest-mobile-mutations',1);open.onsuccess=()=>{const db=open.result,r=db.transaction('mutations').objectStore('mutations').getAll();r.onsuccess=()=>{resolve(r.result.map(({payload,...item})=>({...item,payload:{...payload,file:payload.file?{name:payload.file.name,size:payload.file.size}:undefined}})));db.close();};r.onerror=()=>reject(r.error);};open.onerror=()=>reject(open.error);}));
const poll=async(test,label)=>{for(let i=0;i<160;i++){if(await test())return;await page.waitForTimeout(100);}throw Error(label);};
try{
 await page.goto(`${base}/experiments/${f.offlineExperimentId}/run`,{waitUntil:'networkidle'});const before=await read(),steps=Object.fromEntries(before.steps.map(s=>[s.protocolStepRef.split(':').pop(),s]));
 await page.getByText('规程参考与离线设置',{exact:true}).click();
 await page.getByText('下载本次实验供离线使用',{exact:true}).click();await page.getByRole('button',{name:/^(准备离线使用|更新离线内容)$/}).click();await page.getByText(/可离线打开：/).waitFor();
 await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('heading',{name:before.title,exact:true}).waitFor();
 const mobile=page.locator('section.lg\\:hidden').first();
 await mobile.getByRole('button',{name:/^(Confirm step completion|Mark step done)$/}).click();await poll(async()=> (await queue()).length===1,'first completion not persisted');
 await mobile.getByLabel('实际 Proteinase K').fill('50');await mobile.getByRole('button',{name:'保存实际值',exact:true}).click();await poll(async()=> (await queue()).length===2,'actual not persisted');
 await page.getByText('Files, materials and results',{exact:true}).click();
 const photo=page.locator('[data-current-step-photo]');assert.equal(await photo.locator('input[name="targetId"]').inputValue(),steps.dose.id);
 await photo.locator('input[type=file]').setInputFiles({name:'offline-step-evidence.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6ZQAAAABJRU5ErkJggg==','base64')});
 await photo.getByRole('button',{name:/Upload/}).click();await poll(async()=> (await queue()).length===3,'photo not persisted');
 await mobile.getByRole('button',{name:/^(Confirm step completion|Mark step done)$/}).click();await poll(async()=> (await queue()).length===4,'dependent completion not persisted');
 const pending=await queue();assert.equal(pending.find(q=>q.actionType==='attachment.upload').payload.targetId,steps.dose.id);report.pending=pending;
 await page.reload({waitUntil:'domcontentloaded'});await poll(async()=> (await queue()).length===4,'queue lost on refresh');await page.getByText(/本机待同步/).waitFor();await page.screenshot({path:`${out}/offline-pending-mobile.png`,fullPage:true});
 await context.setOffline(false);await page.evaluate(()=>window.dispatchEvent(new Event('online')));await poll(async()=> (await queue()).length===0,'queue did not sync');
 const after=await read();assert(after.steps.find(s=>s.id===steps.prepare.id).completed);assert(after.steps.find(s=>s.id===steps.dose.id).completed);assert.equal(after.protocolRun.executionPlanJson.actualValues[steps.dose.id]['actual-proteinase'].value,50);
 const completed=pending.find(q=>q.actionType==='step.complete'&&q.payload.experimentStepId===steps.dose.id);const replay=await page.request.post(`${base}/api/mobile/step-completions`,{data:{...completed.payload,clientMutationId:completed.clientMutationId,deviceCreatedAt:completed.deviceCreatedAt}});assert.equal(replay.status(),200,await replay.text());
 await page.reload({waitUntil:'networkidle'});await page.getByText('Files, materials and results',{exact:true}).click();const file=page.getByRole('link',{name:'offline-step-evidence.png',exact:true});assert.equal(await file.count(),1);assert.equal((await page.request.get(await file.getAttribute('href'))).status(),200);
 await page.screenshot({path:`${out}/offline-synced-mobile.png`,fullPage:true});report.experimentId=f.offlineExperimentId;report.checks.push({name:'Production cached Run→offline refresh→actual/completion/photo→refresh persistence→reconnect→DB readback; repeat completion produces no duplicate; photo belongs to selected step',result:'通过'});
 // Deliberately alter only the browser wall clock; the server and OS clocks are untouched.
 await page.setViewportSize({width:1440,height:1000});const row=page.locator(`#step-${steps.incubate.id}`),timer=row.locator('section[aria-label="Step timer"]');if(!await timer.isVisible())await row.getByRole('button',{name:/计时器|Timer/}).first().click();
 await timer.getByRole('button',{name:'Start',exact:true}).click();await poll(async()=>Boolean((await read()).steps.find(s=>s.id===steps.incubate.id).timerStartedAt),'timer not started');
 await page.evaluate(()=>{window.originalDateNow=Date.now;Date.now=()=>window.originalDateNow()+3600000;});await timer.getByRole('alert').filter({hasText:'时钟'}).waitFor();assert(await timer.getByRole('button',{name:'Pause',exact:true}).isDisabled());await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await poll(async()=>!await timer.getByRole('button',{name:'Pause',exact:true}).isDisabled(),'foreground calibration failed');
 assert(!(await read()).steps.find(s=>s.id===steps.incubate.id).completed);await page.screenshot({path:`${out}/clock-recalibrated.png`});report.checks.push({name:'Browser wall clock +1 hour shows uncertainty; foreground server calibration restores controls without completing step',result:'通过'});
 console.log('PASS production offline persistence, actual/completion/photo sync, replay, selected photo step, clock drift and foreground recovery');
}catch(error){report.error=String(error);console.error(error);process.exitCode=1;await page.screenshot({path:`${out}/offline-failure.png`,fullPage:true});}finally{await writeFile(`${out}/offline-report.json`,JSON.stringify(report,null,2));await browser.close();}
