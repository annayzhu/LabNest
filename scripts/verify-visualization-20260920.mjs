import { chromium } from 'playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const base = process.env.BASE_URL || 'http://localhost:32120/tools/visualization';
const phase = process.env.PHASE || 'after';
const out = process.env.EVIDENCE_DIR || `docs/visualization/20260920/evidence/${phase}`;
await mkdir(out, {recursive:true});
const browser = await chromium.launch();
const page = await browser.newPage({viewport:{width:1440,height:900}});
const errors=[]; page.on('pageerror', e=>errors.push(e.message));
const themes = ['柴染棕','橙绯红','淡藤萝紫','瓜瓤粉','蓝墨茶','棉絮灰','珊瑚朱','杏叶黄','中国红'];
const evidence={base,phase,viewport:{width:1440,height:900},figures:[],layouts:[]};
async function config(){const event=page.waitForEvent('download');await page.getByRole('button',{name:'Config',exact:true}).click();return JSON.parse(await readFile(await (await event).path(),'utf8'));}
async function fullyInViewport(locator) {
 return locator.evaluate(element => new Promise(resolve => {
  const observer = new IntersectionObserver(([entry]) => { observer.disconnect(); resolve(entry.intersectionRatio >= 0.99); });
  observer.observe(element);
 }));
}
async function geometry(){return page.locator('[data-visualization-panel="parameters"]').evaluate(el=>{const body=el.querySelector('[data-visualization-parameter-scroll]') || el.firstElementChild.lastElementChild;return {height:body.clientHeight,scrollHeight:body.scrollHeight,scrollRange:body.scrollHeight-body.clientHeight,column:el.getBoundingClientRect().toJSON(),guidance:el.querySelector('[data-plot-guidance]').getBoundingClientRect().toJSON()};});}
try {
 await page.goto(base,{waitUntil:'networkidle'});
 await page.getByRole('button',{name:'中国传统',exact:true}).click();
 await page.getByRole('button',{name:'柴染棕',exact:true}).click();
 if(phase!=='before'){
  const toggle=page.getByRole('button',{name:'展开图形定义与适用场景',exact:true});
  assert.equal(await toggle.getAttribute('aria-expanded'),'false');
  const original=await config();
  await page.evaluate(()=>window.scrollTo(0,0));
  assert(await fullyInViewport(toggle), 'Initial guidance toggle must fit inside viewport');
  evidence.layouts.push({state:'collapsed',...await geometry()});await page.screenshot({path:`${out}/desktop-collapsed.png`});
  await toggle.focus();await page.keyboard.press('Enter');
  assert.equal(await page.locator('#visualization-guidance-content').isVisible(),true);
  await page.evaluate(()=>window.scrollTo(0,0));
  evidence.layouts.push({state:'expanded',...await geometry()});await page.screenshot({path:`${out}/desktop-expanded.png`});
  assert(evidence.layouts[0].height>evidence.layouts[1].height+80,'Collapsing must reclaim parameter height');
  await page.locator('[data-plot-origin] summary').click();await page.locator('[data-plot-references] summary').click();
  const lastRef=page.locator('[data-plot-references] a').last();await lastRef.scrollIntoViewIfNeeded();assert(await fullyInViewport(lastRef), 'Final reference must be inside the unclipped viewport');
  const after=await config();delete original.generatedAt;delete after.generatedAt;assert.deepEqual(after,original,'Guidance must not alter exported settings/data');
  await page.getByRole('button',{name:/^Scatter /i}).click();
  assert.equal(await page.getByRole('button',{name:'收起图形定义与适用场景',exact:true}).getAttribute('aria-expanded'),'true');
  await page.getByRole('button',{name:'收起图形定义与适用场景',exact:true}).focus();await page.keyboard.press('Space');
  assert(await page.getByRole('button',{name:'展开图形定义与适用场景',exact:true}).evaluate(el=>el===document.activeElement));
 }
 for(const [index,name] of themes.entries()){
  await page.getByRole('button',{name,exact:true}).click();
  for(const plot of ['bar','scatter','heatmap','heatmap-sequential']){
   const label={bar:/^Bar /i,scatter:/^Scatter /i,heatmap:/^Heatmap /i,'heatmap-sequential':/^Heatmap /i}[plot];
   await page.getByRole('button',{name:label}).click();
   if(plot.startsWith('heatmap')) await page.getByRole('combobox',{name:'Scaling',exact:true}).selectOption(plot==='heatmap'?'row':'none');
   if(plot==='heatmap-sequential') await page.getByRole('combobox',{name:'Color scale',exact:true}).selectOption('sequential');
   const svg=page.locator('svg[aria-label$="scientific figure preview"]');await svg.waitFor();
   const source=await svg.evaluate(el=>el.outerHTML);
   const svgEvent=page.waitForEvent('download'); await page.getByRole('button',{name:'SVG',exact:true}).click(); const exportSource=await readFile(await (await svgEvent).path(),'utf8'); await writeFile(`${out}/${index}-${plot}-export.svg`,exportSource);
   assert(exportSource.includes('<svg'),'SVG download must contain the actual figure');
   await writeFile(`${out}/${index}-${plot}.svg`,source);
   const exported=await config();await writeFile(`${out}/${index}-${plot}.json`,JSON.stringify(exported,null,2));
   evidence.figures.push({name,plot,themeId:exported.themeId,colors:exported.settings.categoricalColors,svg:`${index}-${plot}.svg`});
  }
 }
 if(phase!=='before'){
  for(const [width,height] of [[1440,560],[1024,768],[390,844]]){
   await page.setViewportSize({width,height});await page.evaluate(()=>window.scrollTo(0,0));
   if(width<768) await page.getByRole('combobox',{name:'Plot type',exact:true}).selectOption('bar');
   const toggle=page.getByRole('button',{name:'展开图形定义与适用场景',exact:true});await toggle.click();
   if(!await page.locator('[data-plot-references]').evaluate(el=>el.open)) await page.locator('[data-plot-references] summary').click();await page.locator('[data-plot-references] a').last().scrollIntoViewIfNeeded();
   assert(await fullyInViewport(page.locator('[data-plot-references] a').last()), 'Final reference must be inside the unclipped viewport');
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow');
   evidence.layouts.push({width,height,state:'expanded',...await geometry()});
   await page.screenshot({path:`${out}/expanded-${width}-${height}.png`,fullPage:true});
   await page.getByRole('button',{name:'收起图形定义与适用场景',exact:true}).click();
  }
 }
 assert.deepEqual(errors,[]);evidence.errors=errors;await writeFile(`${out}/report.json`,JSON.stringify(evidence,null,2));console.log(JSON.stringify({phase,figures:evidence.figures.length,layouts:evidence.layouts,errors},null,2));
}finally{await browser.close();}
