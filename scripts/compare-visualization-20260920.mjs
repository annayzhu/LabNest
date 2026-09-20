import {readFile,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const dir='docs/visualization/20260920/evidence';
const plots=['bar','scatter','heatmap','heatmap-sequential'];
const names=['柴染棕','橙绯红','淡藤萝紫','瓜瓤粉','蓝墨茶','棉絮灰','珊瑚朱','杏叶黄','中国红'];
const changed=['categoricalColors','continuousLow','continuousHigh','divergingLow','divergingMid','divergingHigh','barBorderColor'];
const report=[];
for(let i=0;i<9;i++){
 let html='<meta charset="utf-8"><style>body{font:14px sans-serif;color:#263238;background:#f4f6f5;margin:20px}main{display:grid;grid-template-columns:repeat(4,240px);gap:12px}img{width:240px;height:240px;background:white}h1{font-size:20px}h2{font-size:14px}figure{margin:0}figcaption{margin:6px 0}</style>'+`<h1>${names[i]} · 真实应用渲染前后对照</h1>`;
 for(const phase of ['before','after']){html+=`<h2>${phase==='before'?'修改前':'修改后'}</h2><main>`;for(const plot of plots){html+=`<figure><img src="${phase}/${i}-${plot}.svg"><figcaption>${plot}</figcaption></figure>`;}html+='</main>';}
 await writeFile(`${dir}/palette-${i}.html`,html);
 for(const plot of plots){
  const before=JSON.parse(await readFile(`${dir}/before/${i}-${plot}.json`,'utf8'));
  const after=JSON.parse(await readFile(`${dir}/after/${i}-${plot}.json`,'utf8'));
  delete before.generatedAt;delete after.generatedAt;
  if(i===8)assert.deepEqual(after,before,'China red configuration unchanged');
  for(const key of changed){delete before.settings[key];delete after.settings[key];}
  assert.deepEqual(after,before,`${i}/${plot}: data, mapping, calculations and non-color settings unchanged`);
  report.push({theme:names[i],plot,nonColorConfig:'identical',chinaRed:i===8?'identical':'not applicable'});
 }
}
const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1050,height:650}});
for(let i=0;i<9;i++){await page.goto(`file://${process.cwd()}/${dir}/palette-${i}.html`);await page.screenshot({path:`${dir}/palette-${i}.png`,fullPage:true});}
await browser.close();await writeFile(`${dir}/comparison.json`,JSON.stringify(report,null,2));console.log(`${report.length} before/after semantic comparisons passed`);
