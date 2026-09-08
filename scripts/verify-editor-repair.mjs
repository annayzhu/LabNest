import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const base=process.env.LABNEST_EDITOR_TEST_URL||'http://localhost:3227';assert.equal(new URL(base).port,'3227','Use isolated editor acceptance server');
const dir='docs/editor-repair/evidence';mkdirSync(dir,{recursive:true});const fixtures=JSON.parse(readFileSync(dir+'/fixtures.json','utf8'));
const phase=process.env.EDITOR_CHECK||'print';const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(15000);
async function insertImage(page, name='editor-fixture.png', body=page.locator('[contenteditable="true"]').first()) {
 await body.click();
 await body.evaluate((el,name)=>{const c=document.createElement('canvas');c.width=120;c.height=80;const ctx=c.getContext('2d');ctx.fillStyle='#315f72';ctx.fillRect(0,0,120,80);ctx.fillStyle='#ffffff';ctx.fillText('Editor 66',20,40);const data=new DataTransfer();data.items.add(new File([Uint8Array.from(atob(c.toDataURL().split(',')[1]),c=>c.charCodeAt(0))],name,{type:'image/png'}));el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));},name);
 await page.waitForFunction(name=>[...document.images].some(i=>i.alt===name&&i.src.includes('/api/attachments/')&&i.complete&&i.naturalWidth>0),name);
 const id=await page.locator('[data-document-media]').filter({has:page.getByRole('img',{name,exact:true})}).first().getAttribute('data-document-media');const media=page.locator(`[data-document-media="${id}"]`);await media.getByRole('img').click();return media;
}
async function assertPrintedImage(filename, caption) {
 await page.emulateMedia({media:'print'});
 await page.getByRole('img',{name:caption,exact:true}).first().waitFor();
 const path=`${dir}/${filename}.pdf`;
 const pdf=await page.pdf({path,format:'A4',printBackground:true});
 assert(pdf.toString('latin1').includes('/Subtype /Image'),'PDF embeds raster content');
 const text=execFileSync('pdftotext',[path,'-'],{encoding:'utf8'});
 assert(text.split('\f').slice(0,-1).every(page=>page.trim().length),`Unexpected blank print page: ${filename}`);
 assert(text.includes(caption),`Printed caption missing: ${filename}`);
 assert(text.includes('Editor acceptance body'),`Printed body missing: ${filename}`);
 assert(text.includes('Synthetic'),`Printed title missing: ${filename}`);
 writeFileSync(`${dir}/${filename}.txt`,text);
}
const clientErrors=[];page.on('pageerror',e=>clientErrors.push(String(e)));
const report={phase,checks:[],at:new Date().toISOString(),base};
try{
const item=fixtures.cases.find(c=>c.name==='experiment');await page.goto(base+item.edit,{waitUntil:'networkidle'});
if(phase==='ime'){
 for (const item of fixtures.cases.filter(c=>['experiment','result'].includes(c.name))) {
 await page.goto(base+item.edit,{waitUntil:'networkidle'});
 const media=await insertImage(page,`ime-${item.name}.png`);const caption=media.getByRole('textbox',{name:'图注 / Caption',exact:true});await caption.fill('实验 image');
 const events=await caption.evaluate(el=>{
  const dispatch=init=>el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true,...init}));
  el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:''}));
  const composing=dispatch({isComposing:true});const safari229=dispatch({keyCode:229});
  el.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'图像'}));
  return {composing,safari229,ordinary:dispatch({})};
 });assert.deepEqual(events,{composing:true,safari229:true,ordinary:false});report.checks.push({entry:item.name,syntheticEvents:events,physicalIME:'not executed'});
 }
}
if(phase==='image-recovery'){
 const media=await insertImage(page,'recovery.png');await media.getByRole('textbox',{name:'图注 / Caption',exact:true}).fill('恢复图像 image');await page.getByRole('button',{name:item.save,exact:true}).click();await page.waitForURL(base+item.view);await page.reload({waitUntil:'networkidle'});await page.getByRole('img',{name:'恢复图像 image',exact:true}).first().evaluate(i=>i.decode());
 await page.route('**/api/attachments/*?*preview=1',r=>r.abort());await page.reload({waitUntil:'networkidle'});
 await page.getByRole('img',{name:'恢复图像 image',exact:true}).first().evaluate(i=>i.decode());report.checks.push('Saved image reloads; failed preview recovers original without editing stored reference');let fail=true;await page.route('**/api/attachments/**',r=>fail?r.abort():r.continue());await page.reload({waitUntil:'networkidle'});await page.getByText('图片加载失败 / Image unavailable',{exact:true}).first().waitFor();fail=false;await page.getByRole('button',{name:'重试 / Retry',exact:true}).first().click();await page.getByRole('img',{name:'恢复图像 image',exact:true}).first().evaluate(i=>i.decode());report.checks.push('Both sources failing shows recoverable error; retry loads image when network recovers');
}
if(phase==='media-controls'){
 const media=await insertImage(page,'controls.png');await page.getByRole('textbox',{name:'Experiment title',exact:true}).click();
 assert.equal(await media.getByRole('textbox',{name:'图注 / Caption',exact:true}).isVisible(),false,'Unselected image has no permanent property panel');
 await media.getByRole('img').click();await media.getByRole('textbox',{name:'图注 / Caption',exact:true}).fill('中文 image 说明');
 assert.equal(await media.getByRole('spinbutton').isVisible(),false,'Width stays inside optional settings');await media.getByText('图片设置 / Image settings',{exact:true}).click();await media.getByRole('spinbutton').fill('60');
 assert.equal(await media.getByRole('spinbutton').inputValue(),'60');
 await page.getByRole('textbox',{name:'Experiment title',exact:true}).click();await media.focus();assert(await media.getByRole('textbox',{name:'图注 / Caption',exact:true}).isVisible());
 const settings=media.getByRole('button',{name:'图片设置 / Image settings',exact:true});await settings.focus();await settings.press('Enter');assert.equal(await settings.getAttribute('aria-expanded'),'false');await settings.press('Enter');
 const originalSrc=await media.getByRole('img').getAttribute('src');
 const chooser=page.waitForEvent('filechooser');await media.getByRole('button',{name:'替换附件 / Replace attachment',exact:true}).click();
 await (await chooser).setFiles({name:'replacement.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=','base64')});
 await page.waitForFunction(({id,src})=>{const i=document.querySelector(`[data-document-media="${id}"] img`);return i&&i.getAttribute('src')!==src&&i.src.includes('/api/attachments/')&&i.complete&&i.naturalWidth>0;},{id:await media.getAttribute('data-document-media'),src:originalSrc});
 await page.getByRole('button',{name:item.save,exact:true}).click();await page.waitForURL(base+item.view);await page.reload({waitUntil:'networkidle'});const replaced=page.getByRole('img',{name:'中文 image 说明',exact:true});await replaced.evaluate(i=>i.decode());assert.notEqual(await replaced.getAttribute('src'),originalSrc);
 report.checks.push('Selection, optional width, keyboard focus/expand and replacement save/refresh passed');
}
if(phase==='metadata'){
 for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.getByRole('tab',{name:'Metadata',exact:true}).click();const panel=page.locator('[data-document-metadata]');await page.evaluate(()=>document.fonts.ready);await panel.evaluate(el=>Promise.all(el.getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{}))));const geometry=await panel.evaluate(el=>{const r=el.getBoundingClientRect(),nav=document.querySelector('.document-editor-layout-tabs').getBoundingClientRect(),field=el.querySelector('input:not([type=hidden]),select,textarea').getBoundingClientRect();return {left:r.left,right:r.right,navLeft:nav.left,navRight:nav.right,inset:field.left-r.left};});assert(Math.abs(geometry.left-geometry.navLeft)<2&&Math.abs(geometry.right-geometry.navRight)<2,JSON.stringify(geometry));assert(geometry.inset>=10,'Metadata has the Protocol content inset');report.checks.push({width,geometry});}
}
if(phase==='roundtrip'){
 for(const item of fixtures.cases){
 await page.emulateMedia({media:'screen'});await page.goto(base+item.edit,{waitUntil:'networkidle'});const caption=`中文图注 ${item.name} ${Date.now()}`;
 const media=await insertImage(page,`${item.name}-${Date.now()}.png`);await media.getByRole('textbox',{name:'图注 / Caption',exact:true}).fill(caption);await media.getByText('图片设置 / Image settings',{exact:true}).click();await media.getByRole('spinbutton').fill('60');
 await page.getByRole('button',{name:item.save,exact:true}).click();await page.waitForURL(url=>!url.pathname.endsWith('/edit'));await page.goto(base+item.view,{waitUntil:'networkidle'});await page.reload({waitUntil:'networkidle'});
 const picture=page.getByRole('img',{name:caption,exact:true}).first();await picture.evaluate(i=>i.decode());assert.equal(await page.getByRole('textbox',{name:'图注 / Caption',exact:true}).count(),0);
 await assertPrintedImage(`${item.name}-view`,caption);
 await page.emulateMedia({media:'screen'});await page.goto(base+item.edit,{waitUntil:'networkidle'});await picture.evaluate(i=>i.decode());await picture.click();const node=page.locator('[data-document-media]').filter({has:picture}).first();assert.equal(await node.getByRole('textbox',{name:'图注 / Caption',exact:true}).inputValue(),caption);await node.getByText('图片设置 / Image settings',{exact:true}).click();assert.equal(await node.getByRole('spinbutton').inputValue(),'60');
 await assertPrintedImage(`${item.name}-edit`,caption);
 report.checks.push({entry:item.name,caption,saveRefreshReadEditPrint:'passed',view:item.view,edit:item.edit});
 }
}
if(phase==='template'){
 const item=fixtures.cases.find(c=>c.name==='protocol');await page.goto(base+item.edit,{waitUntil:'networkidle'});await page.getByRole('textbox',{name:'Protocol document body',exact:true}).count();await page.locator('[contenteditable="true"]').first().click();await page.getByRole('toolbar',{name:'Protocol formatting',exact:true}).getByRole('button',{name:'Insert',exact:true}).click();await page.locator('[data-toolbar-menu="insert"]').getByText('Result template',{exact:true}).click();
 const template=page.locator('.ln-protocol-result-template-editor').last();await template.locator('summary').first().click();const caption='结果模板说明 image '+Date.now();const media=await insertImage(page,'template-guidance.png',template.locator('[contenteditable="true"]').first());assert.equal(await template.getByRole('img',{name:'template-guidance.png',exact:true}).count(),1,'Pasted image belongs inside template instructions, not outer Protocol');await media.getByRole('textbox',{name:'图注 / Caption',exact:true}).fill(caption);
 await page.getByRole('button',{name:'Save Protocol',exact:true}).click();await page.waitForURL(url=>!url.pathname.endsWith('/edit'));await page.reload({waitUntil:'networkidle'});const picture=page.getByRole('img',{name:caption,exact:true}).first();await picture.evaluate(i=>i.decode());assert.equal(await page.locator('figure').filter({hasText:'填写说明 / Instructions'}).getByRole('img',{name:caption,exact:true}).count(),1,'Saved image remains in the instruction section');await assertPrintedImage('template-view',caption);
 await page.emulateMedia({media:'screen'});await page.goto(base+item.edit,{waitUntil:'networkidle'});await page.locator('.ln-protocol-result-template-editor').last().locator('summary').first().click();assert.equal(await page.locator('.ln-protocol-result-template-editor').last().getByRole('img',{name:caption,exact:true}).count(),1);await picture.evaluate(i=>i.decode());await assertPrintedImage('template-edit',caption);report.checks.push({entry:'result-template-instructions',caption,saveRefreshReadEditPrint:'passed'});
}
if(phase==='run'){
 const protocol=fixtures.cases.find(c=>c.name==='protocol');await page.goto(base+protocol.edit,{waitUntil:'networkidle'});const caption='Run step image '+Date.now();const media=await insertImage(page,'run-step.png',page.locator('[data-section-key="steps"] .ln-protocol-section-content p').last());await media.getByRole('textbox',{name:'图注 / Caption',exact:true}).fill(caption);await page.getByRole('button',{name:'Save Protocol',exact:true}).click();await page.waitForURL(url=>!url.pathname.endsWith('/edit'));
 await page.goto(base+'/experiments/new',{waitUntil:'networkidle'});await page.getByRole('tab',{name:'Metadata',exact:true}).click();await page.getByRole('button').filter({hasText:fixtures.protocolTitle}).click();await page.locator('[name=title]').fill('Synthetic Run image acceptance');await page.getByRole('button',{name:'Save Experiment',exact:true}).click();await page.waitForURL(/\/experiments\/(?!new)/);const url=page.url()+'/run';await page.goto(url,{waitUntil:'networkidle'});
 for(const width of [1440,390]){await page.setViewportSize({width,height:1000});const imgs=page.locator('[data-run-step-content]:visible').getByRole('img',{name:caption,exact:true});await imgs.first().waitFor();assert(await imgs.count()>0);for(const img of await imgs.all())await img.evaluate(i=>i.decode());report.checks.push({entry:'run',width,loadedImages:await imgs.count(),url});}
}
if(phase==='visual'){
 for(const item of fixtures.cases.filter(item=>!process.env.EDITOR_VISUAL_ENTRIES||process.env.EDITOR_VISUAL_ENTRIES.split(',').includes(item.name))){
 for(const width of [1440,390]){
 await page.emulateMedia({media:'screen',colorScheme:item.name==='report'?'dark':'light'});await page.setViewportSize({width,height:1000});await page.goto(base+item.edit,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
 const media=page.locator('[data-document-media]').filter({has:page.locator('img:visible')}).first();await media.getByRole('img').evaluate(i=>i.decode());await media.getByRole('img').click();await media.scrollIntoViewIfNeeded();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),item.name+' page overflow');await page.screenshot({path:`${dir}/${item.name}-editor-${width}.png`});
 await page.getByRole('tab',{name:'Metadata',exact:true}).click();const metadata=page.locator(item.name==='protocol'?'.protocol-metadata-card':'[data-document-metadata]');await metadata.waitFor();await metadata.evaluate(el=>Promise.all(el.getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{}))));await page.evaluate(()=>scrollTo(0,0));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),item.name+' metadata overflow');await page.screenshot({path:`${dir}/${item.name}-metadata-${width}.png`});report.checks.push({entry:item.name,width,overflow:false});
 }
 }
}
if(phase==='print'){
 await page.emulateMedia({media:'print'});
 const paper=page.locator('.document-print-root').first();await paper.waitFor();assert((await paper.innerText()).includes('Editor acceptance body'));
 const pdf=await page.pdf({path:dir+'/experiment-print.pdf',format:'A4',printBackground:true});assert(pdf.length>2000);report.checks.push('Editor body remains visible in print media');
}
assert.deepEqual(clientErrors,[],'No uncaught browser application errors');
}catch(error){report.error=String(error);report.clientErrors=clientErrors;report.pageText=(await page.locator('body').innerText()).slice(0,2500);throw error;}finally{report.clientErrors=clientErrors;writeFileSync(dir+'/'+phase+'.json',JSON.stringify(report,null,2));await browser.close();}
