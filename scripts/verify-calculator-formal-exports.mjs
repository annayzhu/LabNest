import 'dotenv/config';
import {csvRows} from './calculator-csv-read.mjs';
import {chromium} from 'playwright';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import pg from 'pg';
import readXlsxFile from 'read-excel-file/node';
const dir='docs/calculator/v1.3/evidence/formal-exports',base=process.env.LABNEST_E2E_BASE_URL||'http://localhost:3223';await mkdir(dir,{recursive:true});
const fixture=JSON.parse(await readFile('docs/calculator/v1.1/evidence/appearance-browser-report.json','utf8'));assert(fixture.wbResultId);const url=new URL(process.env.DATABASE_URL);assert(['localhost','127.0.0.1'].includes(url.hostname));url.pathname='/labnest_calculator_acceptance_20260906';const db=new pg.Client({connectionString:url.toString()});await db.connect();
const snapshot=(await db.query('SELECT "valuesJson" FROM "Result" WHERE id=$1',[fixture.wbResultId])).rows[0].valuesJson;await db.end();
const browser=await chromium.launch(),p=await browser.newPage();const report={sha:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),at:new Date().toISOString(),resultId:fixture.wbResultId,files:[]};
try{
 for(const format of ['csv','xlsx','json']){const response=await p.request.get(`${base}/api/structured-export/results?format=${format}&exportScope=selected&id=${fixture.wbResultId}`);assert.equal(response.status(),200);const path=`${dir}/saved-wb.${format}`;await writeFile(path,await response.body());let text,actual;if(format==='json')actual=JSON.parse(await readFile(path,'utf8')).records[0].templateValuesJson;else if(format==='xlsx'){const rows=(await readXlsxFile(path))[0].data;actual=JSON.parse(rows[1][rows[0].indexOf('templateValuesJson')]);}else {text=await readFile(path,'utf8');const rows=csvRows(text);actual=JSON.parse(rows[1][rows[0].indexOf('templateValuesJson')]);for(const term of [snapshot.methodVersion,'Synthetic stock','below configured minimum','operations','source'])assert(text.includes(term),format+' '+term);}
 if(actual)assert.deepEqual(actual,snapshot,format+' complete frozen snapshot');report.files.push({format,path,status:'通过',check:actual?'Full nested snapshot equals independent database read':'Quoted CSV contains methods, component, operation sources and warning; row/cell comparisons are in the calculator CSV/XLSX audit'});}
 await p.goto(`${base}/results/${fixture.wbResultId}`,{waitUntil:'networkidle'});assert.equal(await p.getByRole('button',{name:'Print / PDF',exact:true}).count(),1);await p.emulateMedia({media:'print'});const path=dir+'/saved-wb.pdf';await p.pdf({path,format:'A4',printBackground:true,margin:{top:'12mm',bottom:'12mm',left:'12mm',right:'12mm'}});report.files.push({format:'pdf',path,status:'待文件回读',check:'Chromium print renderer; native OS print dialog not exercised'});
}catch(error){report.error=String(error);throw error;}finally{await writeFile(dir+'/report.json',JSON.stringify(report,null,2));await browser.close();}
