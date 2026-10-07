import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve,extname,sep} from 'node:path';
import {chromium} from 'playwright';
// The independent offline build has its own origin/path. LabNest's /tools/
// entry now intentionally embeds the main Calculator, tested separately by
// verify-plate-calculator-integration.mjs. Serve the same committed offline
// assets at their standalone root so this regression still tests real caching.
const root=resolve('public/tools/free-plate-layout');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const path=resolve(root,`.${pathname==='/'?'/index.html':pathname}`);
  if(!path.startsWith(root+sep)){res.writeHead(403);res.end();return;}
  res.setHeader('Content-Type',mime[extname(path)]??'application/octet-stream');
  res.end(await readFile(path));
 }catch{res.writeHead(404);res.end();}
});
await new Promise((done,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',done);});
const base=`http://127.0.0.1:${server.address().port}`,errors=[];
let browser;
try{
 browser=await chromium.launch();const c=await browser.newContext(),p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));
 await p.goto(base+'/index.html',{waitUntil:'networkidle'});await p.locator('[data-well="A1"]').click();await p.locator('[data-plate-calculator="seeding"]').first().click();await p.locator('#standalonePlateCalculatorForm').waitFor();assert.equal(await p.locator('input[name="wells"]').inputValue(),'1');for(const [key,value] of Object.entries({stockCellsPerMl:'1e6',cellsPerWell:'100',volumePerWellUl:'100',overagePercent:'0',pipetteMinimumUl:'1'}))await p.locator(`#standalonePlateCalculatorForm [name="${key}"]`).fill(value);await p.locator('#standalonePlateCalculatorForm button[type="submit"]').click();const result=p.locator('#standalonePlateResult');assert((await result.innerText()).includes('0.1 µL'),await result.innerText());assert((await result.innerText()).includes('below configured minimum'));await p.locator('[data-output-unit="stockVolumeMl"]').selectOption('nL');assert((await result.innerText()).includes('100 nL'));assert((await result.innerText()).includes('below configured minimum'));
 await p.locator('.standalone-appearance-preview summary').click();assert((await p.locator('#plateCalculatorHost').innerText()).includes('no automatic cross-origin sync'));await p.locator('[data-standalone-icon-pack]').selectOption('classic-line');assert.equal(await p.locator('.standalone-task-icon img').count(),0);await p.locator('[data-standalone-icon-pack]').selectOption('lab-soft');assert.equal(await p.locator('.standalone-task-icon img').count(),1);await p.screenshot({path:'docs/calculator/v1.1/evidence/standalone-warning.png',fullPage:true});
 await p.locator('#closeLiquidDrawerButton').click();for(const id of ['hydrogel','kill-curve','fold-dilution','master-mix','moi']){await p.locator(`[data-plate-calculator="${id}"]`).first().click();await p.locator('#standalonePlateCalculatorForm button[type="submit"]').click();assert.equal(await p.locator('[data-plate-result-action="apply"]').count(),1,`${id}: ${await p.locator('#standalonePlateResult').innerText()}`);await p.locator('#closeLiquidDrawerButton').click();}await p.locator('#cacheStandalone').click();await p.getByText('Cached for offline reload / 已缓存，可离线刷新',{exact:true}).waitFor({timeout:30000});await c.setOffline(true);await p.reload({waitUntil:'domcontentloaded'});await p.locator('[data-well="A1"]').waitFor();await p.locator('[data-plate-calculator="seeding"]').first().click();await p.locator('#standalonePlateCalculatorForm').waitFor();await p.locator('#standalonePlateCalculatorForm button[type="submit"]').click();assert((await p.locator('#standalonePlateResult').innerText()).includes('Apply to current plate')||(await p.locator('#standalonePlateResult').innerText()).includes('应用到当前孔板'));assert.equal(await p.locator('.standalone-task-icon img').count(),1);assert.deepEqual(errors,[]);const checks=['I07 standalone UI reuses engine and presentation; 0.1 µL warning survives nL display','Explicit standalone-origin icon setting','Independent offline cached reload, icons and calculation'];await writeFile('docs/calculator/v1.1/evidence/standalone-report.json',JSON.stringify({checks,errors,completedAt:new Date().toISOString()},null,2));console.log(checks);
}finally{try{await browser?.close();}finally{server.closeAllConnections();await new Promise(done=>server.close(done));}}
