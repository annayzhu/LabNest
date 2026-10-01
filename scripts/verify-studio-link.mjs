import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
const studioRoot=process.env.STUDIO_TEST_ROOT;
if(!studioRoot)throw new Error('Set STUDIO_TEST_ROOT to the independently built Studio checkout.');
const destination='http://127.0.0.1:33117/',base='http://127.0.0.1:33118';
const evidence='docs/visualization/20260930/evidence';await mkdir(evidence,{recursive:true});
const servers=[];
function start(cwd,args,environment){const child=spawn(process.execPath,args,{cwd,env:{...process.env,...environment},stdio:['ignore','pipe','pipe']});let logs='';child.stdout.on('data',chunk=>logs+=chunk);child.stderr.on('data',chunk=>logs+=chunk);servers.push(child);return ()=>logs;}
async function ready(url,logs){for(let n=0;n<100;n++){try{const response=await fetch(url);if(response.ok)return;}catch{}await new Promise(resolve=>setTimeout(resolve,200));}throw new Error(`Server unavailable: ${url}\n${logs()}`);}
let browser;
try{
 const studioLogs=start(studioRoot,['.next/standalone/server.js'],{PORT:'33117',HOSTNAME:'127.0.0.1'});
 const labLogs=start(process.cwd(),['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','33118'],{DATABASE_URL:'postgresql://test:test@127.0.0.1:9/test',VISUALIZATION_STUDIO_URL:destination});
 await ready(destination,studioLogs);await ready(`${base}/tools`,labLogs);
 browser=await chromium.launch();
 for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage();
  await page.goto(`${base}/tools`);const link=page.locator(`main a[href="${destination}"]`);assert.equal(await link.getAttribute('target'),'_blank');
  const popupPromise=page.waitForEvent('popup');await link.click();const popup=await popupPromise;await popup.waitForURL(destination);
  await popup.getByRole('button',{name:'SVG',exact:true}).waitFor();
  const downloadPromise=popup.waitForEvent('download');await popup.getByRole('button',{name:'SVG',exact:true}).click();const download=await downloadPromise;await download.saveAs(`${evidence}/entry-${width}.svg`);const svg=await readFile(await download.path(),'utf8');assert(svg.includes('<svg'));assert(!/NaN|Infinity/.test(svg));
  await popup.screenshot({path:`${evidence}/studio-${width}.png`,fullPage:true});
  await page.goto(`${base}/tools/visualization`);await page.waitForURL(destination);
  await page.goto(`${base}/tools`);
  const palette={id:'migration-fixture',name:'Migration synthetic',sourceThemeId:'cn-beihai',categoricalColors:['#123456'],continuousLow:'#EEEEEE',continuousHigh:'#123456',divergingLow:'#123456',divergingMid:'#EEEEEE',divergingHigh:'#654321',barBorderColor:'#123456',createdAt:'2026-09-30',updatedAt:'2026-09-30'};
  // Isolated browser origin with synthetic preferences; no real storage is cleared.
  await page.evaluate(value=>localStorage.setItem('labnest:visualization-studio:custom-palettes',JSON.stringify([value])),palette);
  await page.goto(`${base}/tools/visualization`);
  const migrationEvent=page.waitForEvent('download');await page.getByRole('button',{name:'下载旧配色迁移文件'}).click();const migration=await migrationEvent;
  const contents=await readFile(await migration.path(),'utf8');assert.equal(JSON.parse(contents).format,'visualization-studio-preferences');
  assert(await page.evaluate(()=>localStorage.getItem('labnest:visualization-studio:custom-palettes')));
  await page.screenshot({path:`${evidence}/migration-${width}.png`,fullPage:true});
  await popup.getByLabel('Project file',{exact:true}).setInputFiles({name:'migration.json',mimeType:'application/json',buffer:Buffer.from(contents)});
  await popup.getByText('Imported palette collection; choose a palette explicitly.',{exact:false}).waitFor();
  const projectEvent=popup.waitForEvent('download');await popup.getByRole('button',{name:'Export project',exact:true}).click();const project=JSON.parse(await readFile(await(await projectEvent).path(),'utf8'));assert.deepEqual(project.palettes,[palette]);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await context.close();
 }
 // Runtime configuration must work after a single production build.
 for(const [port,url] of [[33120,''],[33121,'http://127.0.0.1:33122/']]){
  const logs=start(process.cwd(),['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{DATABASE_URL:'postgresql://test:test@127.0.0.1:9/test',VISUALIZATION_STUDIO_URL:url});
  const origin=`http://127.0.0.1:${port}`;await ready(`${origin}/tools`,logs);
  const context=await browser.newContext(),page=await context.newPage();
  await page.goto(`${origin}/tools`);
  if(!url){await page.goto(`${origin}/tools/visualization`);await page.getByRole('alert').filter({hasText:'尚未配置'}).waitFor();assert.equal(page.url(),`${origin}/tools/visualization`);}
  else {const popupEvent=page.waitForEvent('popup');await page.locator(`main a[href="${url}"]`).click();const popup=await popupEvent;await popup.waitForLoadState('domcontentloaded').catch(()=>{});assert.equal(page.url(),`${origin}/tools`);await popup.close();
   // With recoverable preferences the migration page remains available even if target is down.
   await page.evaluate(()=>localStorage.setItem('labnest:visualization-studio:custom-palettes','[]'));
   await page.goto(`${origin}/tools/visualization`);await page.getByRole('button',{name:'下载旧配色迁移文件'}).waitFor();assert(await page.evaluate(()=>localStorage.getItem('labnest:visualization-studio:custom-palettes')));}
  await page.screenshot({path:`${evidence}/configuration-${port}.png`,fullPage:true});await context.close();
 }
 await writeFile(`${evidence}/link-report.json`,JSON.stringify({result:'PASS',viewports:[1440,390],checks:['external new-tab entry','independent SVG export','old bookmark redirect','same-origin old preference download retains original','independent preference import/project export','no horizontal overflow','unconfigured runtime URL shows configuration message','unreachable target leaves Tools and migration data recoverable'],unverified:['physical phone']},null,2));
 console.log('PASS: independent Studio entry and legacy migration at 1440 and 390 pixels.');
}finally{await browser?.close();for(const child of servers)child.kill('SIGTERM');}
