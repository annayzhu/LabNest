import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium,webkit} from 'playwright';

const base=process.env.BASE_URL??'http://localhost:3002';
const evidence=path.resolve(process.env.QPCR_RESPONSIVE_EVIDENCE??'.local-runtime/qpcr-responsive-20261104/before');
await mkdir(evidence,{recursive:true});
const results=[];
const failures=[];
for(const [engine,driver] of [['chromium',chromium],...(process.env.WEBKIT==='1'?[['webkit',webkit]]:[])]){
  const browser=await driver.launch();
  try{
    const context=await browser.newContext({viewport:{width:1440,height:900},hasTouch:true});
    await context.addCookies([{name:'labnest_locale',value:'zh',url:base}]);
    await context.addInitScript(()=>localStorage.setItem('labnest.locale','zh'));
    const page=await context.newPage();page.setDefaultTimeout(15000);
    page.on('dialog',dialog=>dialog.accept());
    await page.goto(base+'/tools/qpcr-plate-layout');
    const frame=page.frameLocator('iframe');
    await frame.getByRole('button',{name:'载入示例',exact:true}).click();
    await frame.getByRole('button',{name:'生成布局',exact:true}).click();
    for(const wells of [96,384]){
      if(wells===384){
        await frame.getByRole('button',{name:/^384 孔板/}).click();
        await frame.getByRole('button',{name:'重新生成布局',exact:true}).click();
      }
      for(const [width,height] of [[390,844],[844,390],[834,1194],[1194,834],[1024,1366],[1366,1024],[1366,768],[1440,900],[1920,1080]]){
        await page.setViewportSize({width,height});
        await frame.locator('body').evaluate(async()=>{for(let i=0;i<10;i++)await new Promise(resolve=>requestAnimationFrame(resolve));});
        const metrics=await frame.locator('body').evaluate(body=>{
          const viewport=body.querySelector('.plate-scroll'),grid=body.querySelector('.plate-grid'),aside=body.querySelector('.plate-aside');
          const p=viewport.getBoundingClientRect(),g=grid.getBoundingClientRect(),a=aside.getBoundingClientRect();
          const style=getComputedStyle(viewport),actions=body.querySelector('.selection-actions');
          const padding=parseFloat(style.paddingTop)+parseFloat(style.paddingBottom);
          const horizontalPadding=parseFloat(style.paddingLeft)+parseFloat(style.paddingRight);
          return {viewportWidth:p.width,viewportHeight:p.height,gridWidth:g.width,gridHeight:g.height,verticalGap:p.height-g.height-padding,horizontalGap:p.width-g.width-horizontalPadding,zoom:Number(viewport.dataset.plateZoom),overflowX:document.documentElement.scrollWidth-innerWidth,viewportVerticalOverflow:viewport.scrollHeight-viewport.clientHeight,viewportOverflowY:style.overflowY,asideTop:a.top,plateBottom:p.bottom,stacked:a.top>=p.bottom-1,actionsColumns:actions?getComputedStyle(actions).gridTemplateColumns:null,assigned:body.querySelectorAll('.well:not(.well-empty)').length,wellCount:body.querySelectorAll('[role=gridcell]').length,fitActive:Boolean(body.querySelector('.zoom-value input'))};
        });
        results.push({engine,wells,width,height,...metrics});
        if(metrics.wellCount!==wells)failures.push(`${engine} ${wells} ${width}: wrong plate format ${metrics.wellCount}`);
        if(metrics.overflowX>1)failures.push(`${engine} ${wells} ${width}: page overflow ${metrics.overflowX}`);
        if(metrics.verticalGap>32)failures.push(`${engine} ${wells} ${width}: unused plate height ${metrics.verticalGap.toFixed(2)}px`);
        if(metrics.viewportVerticalOverflow>2)failures.push(`${engine} ${wells} ${width}: nested vertical scroll ${metrics.viewportVerticalOverflow}px`);
        if(width<1024 && metrics.horizontalGap>3)failures.push(`${engine} ${wells} ${width}: plate does not use the available width`);
        await frame.locator('.plate-viewport').scrollIntoViewIfNeeded();
        await page.screenshot({path:path.join(evidence,`${engine}-${wells}-${width}x${height}.png`)});
      }
    }
    await context.close();
  }finally{
    await writeFile(path.join(evidence,'measurements.json'),JSON.stringify(results,null,2)+'\n');
    await browser.close();
  }
}
await writeFile(path.join(evidence,'measurements.json'),JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify(results.map(({engine,wells,width,height,verticalGap,zoom,overflowX})=>({engine,wells,width,height,verticalGap,zoom,overflowX}))));
assert.deepEqual(failures,[],failures.join('\n'));
