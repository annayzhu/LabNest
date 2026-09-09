import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';
const {experimentId}=JSON.parse(readFileSync('docs/stage-20260908/A/run-fixture.json'));const browser=await chromium.launch();
try{
 for(const [name,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
 const page=await browser.newPage({viewport});await page.goto(`http://localhost:3232/experiments/${experimentId}`);await page.reload();
 const canvas=page.locator('.document-a4-paper');const text=await canvas.innerText();
 for(const expected of ['手写正文必须保留','✓ 取样','偏差：实际延长 5 分钟','未完成 检测','合成固定规程'])assert.ok(text.includes(expected),expected);
 assert.ok(!text.includes('不应默认重复的完整原始说明'));
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.screenshot({path:`docs/debug-20260909/evidence/run-document-${name}.png`,fullPage:true});
 if(name==='desktop')await page.pdf({path:'docs/debug-20260909/evidence/run-document.pdf',preferCSSPageSize:true,printBackground:true});
 await page.close();
 }
 const printed=execFileSync('pdftotext',['docs/debug-20260909/evidence/run-document.pdf','-'],{encoding:'utf8'});
 assert.ok(printed.includes('合成固定规程 · 1.2') && printed.includes('方法来源：'),'PDF must retain the complete labelled method provenance');
 writeFileSync('docs/debug-20260909/evidence/run-document-browser.json',JSON.stringify({experimentId,checks:['Persisted all three steps and handwritten text survive reload','Deviation text and incomplete status visible','No whole-page horizontal overflow at 390 and 1440','PDF uses CSS page size']},null,2));
}finally{await browser.close();}
