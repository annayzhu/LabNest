import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';

const base=process.env.BASE_URL??'http://localhost:3002';
const evidence=path.resolve('.local-runtime/qpcr-hover-stability-20261104');
await mkdir(evidence,{recursive:true});
const browser=await chromium.launch();
const report=[];
try {
  const context=await browser.newContext({viewport:{width:1366,height:768}});
  await context.addCookies([{name:'labnest_locale',value:'zh',url:base}]);
  await context.addInitScript(()=>localStorage.setItem('labnest.locale','zh'));
  const page=await context.newPage();page.setDefaultTimeout(10000);
  await page.goto(base+'/tools/qpcr-plate-layout');
  const frame=page.frameLocator('iframe');
  async function pointAtWell(id){
    const bounds=await frame.getByRole('gridcell',{name:new RegExp('^'+id+'，')}).boundingBox();
    assert.ok(bounds,`Missing visible well ${id}`);
    await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);
    return bounds;
  }
  await frame.getByRole('button',{name:'载入示例',exact:true}).click();
  await frame.getByRole('button',{name:/^384 孔板/}).click();
  await frame.getByRole('button',{name:'生成布局',exact:true}).click();
  for(const [id,sample,gene] of [['P22','S','G'],['P23','Synthetic_Comparison_02_Control','GENE_A'],['P24','合成长样本'.repeat(24),'合成长基因'.repeat(24)]]){
    await frame.getByRole('gridcell',{name:new RegExp('^'+id+'，空孔')}).dblclick();
    await frame.getByRole('button',{name:'检测孔',exact:true}).click();
    await frame.getByLabel('样本',{exact:true}).fill(sample);
    await frame.getByLabel('基因',{exact:true}).fill(gene);
    await frame.getByRole('button',{name:'应用修改',exact:true}).click();
  }
  await frame.getByRole('gridcell',{name:/^P22，/}).click({modifiers:['Meta']});
  await frame.getByRole('gridcell',{name:/^P23，/}).click({modifiers:['Meta']});
  async function trace(id){
    await pointAtWell(id);
    return frame.locator('body').evaluate(async body=>{
      const rect=selector=>{const r=body.querySelector(selector).getBoundingClientRect();return {top:r.top,height:r.height,width:r.width};};
      const samples=[];
      for(let i=0;i<18;i++){
        await new Promise(resolve=>requestAnimationFrame(resolve));
        samples.push({stage:rect('.plate-stage'),grid:rect('.plate-grid'),viewport:rect('.plate-scroll'),summary:rect('.workflow-mix-summary'),toolbar:rect('.selection-toolbar'),zoom:Number(body.querySelector('.plate-scroll').dataset.plateZoom),scrollTop:body.querySelector('.main-area').scrollTop,inspection:body.querySelector('.well-inspector').textContent,asideHeight:body.querySelector('.plate-aside').clientHeight,asideScrollHeight:body.querySelector('.plate-aside').scrollHeight});
      }
      return samples;
    });
  }
  for(const [width,height] of [[1366,768],[1440,900],[1920,1080]]){
    await page.setViewportSize({width,height});
    await pointAtWell('P22');
    await page.mouse.down();await page.mouse.up();
    await frame.locator('body').evaluate(async()=>{for(let i=0;i<6;i++)await new Promise(resolve=>requestAnimationFrame(resolve));});
    const samples=[];
    for(const id of ['P21','P22','P23','P24','P23','P21','P24','P22'])samples.push(...(await trace(id)).map(row=>({id,mode:'hover',...row})));
    for(const id of ['P22','P23','P24','P22']){
      await pointAtWell(id);await page.mouse.down();await page.mouse.up();
      samples.push(...(await trace(id)).map(row=>({id,mode:'click',...row})));
    }
    const range=values=>Math.max(...values)-Math.min(...values);
    const drift={gridTop:range(samples.map(x=>x.grid.top)),gridHeight:range(samples.map(x=>x.grid.height)),viewportHeight:range(samples.map(x=>x.viewport.height)),stageHeight:range(samples.map(x=>x.stage.height)),summaryTop:range(samples.map(x=>x.summary.top)),zoom:range(samples.map(x=>x.zoom)),normalToolbarTop:range(samples.filter(x=>x.id!=='P24').map(x=>x.toolbar.top))};
    const lastWell=await pointAtWell('P24');
    const hoveredText=await frame.locator('.well-inspector').innerText();
    const plateBounds=await frame.locator('.plate-scroll').boundingBox();
    await page.mouse.move(plateBounds.x+plateBounds.width-3,lastWell.y+lastWell.height/2,{steps:12});
    const retainedAcrossGap=hoveredText===await frame.locator('.well-inspector').innerText();
    const labelBounds=await frame.locator('.well-inspector-label').boundingBox();
    await page.mouse.move(labelBounds.x+10,labelBounds.y+labelBounds.height/2,{steps:12});
    const retainedText=await frame.locator('.well-inspector').innerText();
    await page.mouse.wheel(0,500);
    await frame.locator('body').evaluate(async()=>{for(let i=0;i<6;i++)await new Promise(resolve=>requestAnimationFrame(resolve));});
    const readability=await frame.locator('.plate-aside').evaluate(aside=>({scrollTop:aside.scrollTop,clientHeight:aside.clientHeight,scrollHeight:aside.scrollHeight,inspectorFont:getComputedStyle(aside.querySelector('.well-inspector')).fontSize,inspectorLineHeight:getComputedStyle(aside.querySelector('.well-inspector')).lineHeight,inspectorMinHeight:getComputedStyle(aside.querySelector('.well-inspector')).minBlockSize}));
    readability.retainedOnAside=hoveredText===retainedText;
    readability.retainedAcrossGap=retainedAcrossGap;
    readability.retainedAfterScroll=hoveredText===await frame.locator('.well-inspector').innerText();
    report.push({width,height,drift,readability,samples});
    await page.screenshot({path:path.join(evidence,`hover-${width}.png`)});
    await frame.locator('.plate-aside').evaluate(aside=>{aside.scrollTop=0;});
  }
  await writeFile(path.join(evidence,'measurements.json'),JSON.stringify(report,null,2)+'\n');
  const viewModes={};
  await page.setViewportSize({width:1440,height:900});
  await frame.locator('body').evaluate(async()=>{for(let i=0;i<6;i++)await new Promise(resolve=>requestAnimationFrame(resolve));});
  const handle=frame.getByRole('separator',{name:'调整孔板视区高度'});
  const heightBefore=await frame.locator('.plate-scroll').evaluate(el=>el.getBoundingClientRect().height);
  await handle.press('ArrowDown');
  await frame.locator('body').evaluate(async()=>{for(let i=0;i<6;i++)await new Promise(resolve=>requestAnimationFrame(resolve));});
  const resized=[];
  for(const id of ['P22','P24','P23'])resized.push(...await trace(id));
  const range=values=>Math.max(...values)-Math.min(...values);
  viewModes.manualHeight={before:heightBefore,after:resized[0].viewport.height,stageDrift:range(resized.map(x=>x.stage.height)),summaryDrift:range(resized.map(x=>x.summary.top))};
  assert.ok(viewModes.manualHeight.after>heightBefore,'Height handle did not enlarge the plate viewport');
  assert.ok(viewModes.manualHeight.stageDrift<=1 && viewModes.manualHeight.summaryDrift<=1,'Resized viewport moved when names changed');
  await handle.press('Enter');
  await frame.getByRole('button',{name:'全屏查看',exact:true}).click();
  await frame.locator('.plate-viewport.is-fullscreen').waitFor({state:'visible'});
  await frame.locator('body').evaluate(async()=>{for(let i=0;i<6;i++)await new Promise(resolve=>requestAnimationFrame(resolve));});
  viewModes.fullscreen=await frame.locator('.plate-stage').evaluate(stage=>({stageHeight:stage.clientHeight,asideHeight:stage.querySelector('.plate-aside').clientHeight,plateHeight:stage.querySelector('.plate-scroll').clientHeight}));
  assert.ok(viewModes.fullscreen.plateHeight>300 && viewModes.fullscreen.asideHeight<=viewModes.fullscreen.stageHeight,'Fullscreen column heights are invalid');
  await page.screenshot({path:path.join(evidence,'fullscreen.png')});
  await frame.getByRole('button',{name:'退出全屏',exact:true}).click();
  await frame.locator('.plate-viewport.is-fullscreen').waitFor({state:'hidden'});
  await pointAtWell('P24');await page.mouse.down();await page.mouse.up();
  viewModes.stacked=[];
  for(const [width,height] of [[834,1194],[390,844]]){
    await page.setViewportSize({width,height});
    await frame.locator('body').evaluate(async()=>{for(let i=0;i<6;i++)await new Promise(resolve=>requestAnimationFrame(resolve));});
    await frame.locator('.well-inspector').scrollIntoViewIfNeeded();
    const geometry=await frame.locator('body').evaluate(body=>{const aside=body.querySelector('.plate-aside'),inspector=aside.querySelector('.well-inspector');return {contain:getComputedStyle(aside).contain,overflowY:getComputedStyle(aside).overflowY,pageOverflow:document.documentElement.scrollWidth-innerWidth,inspectorHeight:inspector.clientHeight,inspectorScrollHeight:inspector.scrollHeight};});
    assert.equal(geometry.contain,'none','Stacked layout inherited desktop size containment');
    assert.ok(geometry.pageOverflow<=1 && geometry.inspectorHeight>=geometry.inspectorScrollHeight-1,'Stacked details are clipped');
    viewModes.stacked.push({width,height,...geometry});
    await page.screenshot({path:path.join(evidence,`stacked-${width}.png`)});
  }
  await writeFile(path.join(evidence,'view-modes.json'),JSON.stringify(viewModes,null,2)+'\n');
  for(const item of report){
    assert.ok(item.readability.retainedAcrossGap,`${item.width}: crossing the plate padding cleared the hovered well`);
    assert.ok(item.readability.retainedOnAside,`${item.width}: entering the details column cleared the hovered well`);
    assert.ok(item.readability.retainedAfterScroll,`${item.width}: scrolling the details column cleared the hovered well`);
    for(const key of ['gridTop','gridHeight','viewportHeight','stageHeight','summaryTop','normalToolbarTop'])assert.ok(item.drift[key]<=1,`${item.width}: ${key} drifted ${item.drift[key]}px`);
    assert.ok(item.drift.zoom<=0.001,`${item.width}: hover changed zoom`);
    assert.ok(item.readability.scrollTop>0,`${item.width}: long well details could not be scrolled`);
  }
  console.log(JSON.stringify(report.map(({width,height,drift,readability})=>({width,height,drift,readability}))));
} finally {await browser.close();}
