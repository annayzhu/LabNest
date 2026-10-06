import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import sharp from 'sharp';
const base='http://localhost:3331',dir='docs/qa/evidence/entry-richtext/media-loading';mkdirSync(dir,{recursive:true});
const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1440,height:900}}),checks=[];
try{
 await page.goto(base+'/entries/new',{waitUntil:'networkidle'});
 await page.getByRole('textbox',{name:'Entry title',exact:true}).fill('测试慢图片与标题');
 const editor=page.locator('[contenteditable=true]:visible').last();await editor.fill('TEST-SLOW-MEDIA-BEFORE');
 const buffer=await sharp({create:{width:1000,height:100,channels:3,background:'#315f72'}}).png().toBuffer();
 await page.locator('input[accept="image/*"][multiple]').setInputFiles({name:'TEST-wide.png',mimeType:'image/png',buffer});
 await page.waitForFunction(()=>document.querySelectorAll('[data-document-media]').length===1&&!document.querySelector('[data-document-media] [role=status]'));
 await editor.locator('[data-document-media] img').click();await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');await page.keyboard.insertText('TEST-SLOW-MEDIA-AFTER');
 assert(await editor.locator('p').filter({hasText:'TEST-SLOW-MEDIA-AFTER'}).evaluate(el=>Boolean(el.closest('[contenteditable=true]').querySelector('[data-document-media]').compareDocumentPosition(el)&Node.DOCUMENT_POSITION_FOLLOWING)),'Measurement paragraph must be after the image');
 const close=page.getByRole('button',{name:'收起属性',exact:true});if(await close.isVisible()){await close.click();await page.waitForFunction(()=>getComputedStyle(document.querySelector('.context-properties')).display==='none');}
 await page.getByRole('button',{name:'Save Entry',exact:true}).click();await page.waitForURL(/\/entries\/(?!new)[^/?]+$/);
 const id=page.url().split('/').pop();let release;const gate=new Promise(resolve=>release=resolve);let requests=0;
 await page.route('**/api/attachments/*?*',async route=>{requests++;await gate;await route.continue();});
 await page.goto(base+'/entries/'+id+'/edit',{waitUntil:'domcontentloaded'});
 const paragraph=editor.locator('p,h2').filter({hasText:'TEST-SLOW-MEDIA-AFTER'}).first();await paragraph.waitFor();
 await paragraph.evaluate(el=>{const r=document.createRange();r.selectNodeContents(el);r.collapse(false);getSelection().removeAllRanges();getSelection().addRange(r);el.closest('[contenteditable=true]').focus({preventScroll:true});});
 const before=await paragraph.evaluate(el=>el.getBoundingClientRect().top+scrollY);
 await page.getByRole('button',{name:'Paragraph style',exact:true}).click();await page.locator('[data-toolbar-menu=style]').getByRole('menuitem',{name:'Heading 2',exact:true}).click();
 assert((await page.evaluate(()=>getSelection()?.anchorNode?.textContent)).includes('TEST-SLOW-MEDIA-AFTER'));
 await page.waitForTimeout(750);const pending=await paragraph.evaluate(el=>el.getBoundingClientRect().top+scrollY);release();
 await page.locator('[data-document-media] img').evaluate(img=>img.decode());
 const after=await paragraph.evaluate(el=>el.getBoundingClientRect().top+scrollY);
 assert(requests>0);assert(Math.abs(after-pending)<32,`Late image pushed paragraph by ${after-pending}px`);
 assert((await page.evaluate(()=>getSelection()?.anchorNode?.textContent)).includes('TEST-SLOW-MEDIA-AFTER'));
 await page.keyboard.insertText('继续输入 中文 English');assert((await paragraph.innerText()).includes('继续输入'));
 checks.push({name:'B06/B19 delayed wide image, H2 and autosave preserve paragraph, selection and subsequent input',status:'通过',before,pending,after,shiftPx:after-pending});
 await page.getByRole('button',{name:'Save changes',exact:true}).click();await page.waitForURL(base+'/entries/'+id);await page.reload({waitUntil:'networkidle'});
 assert((await page.locator('body').innerText()).includes('继续输入'));await page.screenshot({path:dir+'/readback.png'});
}catch(error){checks.push({status:'失败',error:String(error)});throw error;}finally{writeFileSync(dir+'/report.json',JSON.stringify({synthetic:true,checks},null,2));await browser.close();}
