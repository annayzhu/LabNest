import {chromium} from 'playwright';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const dir='docs/calculator/blockers/evidence',base=process.env.LABNEST_E2E_BASE_URL??'http://localhost:3221';await mkdir(dir,{recursive:true});
const browser=await chromium.launch();const c=await browser.newContext({permissions:['clipboard-read','clipboard-write']});const p=await c.newPage();
const report={sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),at:new Date().toISOString(),checks:[],screenshots:[]};
try{
 await p.goto(base+'/tools/calculator/serial-dilution',{waitUntil:'networkidle'});
 await p.getByRole('combobox',{name:'Gradient',exact:true}).selectOption('custom');
 await p.getByRole('textbox',{name:'Targets (one µM value per line)',exact:true}).fill('10\n20');
 await p.getByRole('textbox',{name:/^Source stock concentration/}).fill('100');
 await p.getByRole('textbox',{name:/^Volume per level/}).fill('100');
 await p.getByRole('button',{name:'Calculate',exact:true}).click();
 await p.getByRole('button',{name:'Save to local history'}).click();
 const snapshot=await p.evaluate(()=>JSON.parse(localStorage.getItem('labnest.calculators.v1')).history[0].snapshot);
 assert.deepEqual(snapshot.table.map(r=>[r.source,r.takeUl,r.diluentUl]),[['母液 / Stock',10,90],['母液 / Stock',20,80]]);
 assert.deepEqual(snapshot.operations.filter(o=>o.role==='transfer').map(o=>o.source),['母液 / Stock','母液 / Stock']);
 await p.getByRole('button',{name:'Copy',exact:true}).click();const clip=await p.evaluate(()=>navigator.clipboard.readText());assert(!clip.includes('tube:1'));await writeFile(dir+'/gradient-clipboard.txt',clip);
 const downloading=p.waitForEvent('download');await p.getByRole('button',{name:'Export CSV',exact:true}).click();const download=await downloading;await download.saveAs(dir+'/gradient.csv');assert(!(await readFile(dir+'/gradient.csv','utf8')).includes('tube:1'));
 report.checks.push('Parallel stock 100 µM → 10/20 µM, 100 µL: table, operations, clipboard, CSV 10+90 / 20+80');
 for(const mode of ['light','dark'])for(const [device,width,height] of [['desktop',1440,1000],['mobile',390,844]]){await p.evaluate(mode=>document.documentElement.dataset.labnestMode=mode,mode);await p.setViewportSize({width,height});const path=`${dir}/gradient-${device}-${mode}.png`;await p.screenshot({path,fullPage:true});report.screenshots.push(path);}
 report.snapshot=snapshot;
}catch(e){report.error=String(e);throw e;}finally{await writeFile(dir+'/browser.json',JSON.stringify(report,null,2));await browser.close();}
