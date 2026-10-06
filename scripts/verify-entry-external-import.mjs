import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import sharp from 'sharp';
const base='http://localhost:3331',dir='docs/qa/evidence/entry-richtext/external-import';mkdirSync(dir,{recursive:true});
const browser=await chromium.launch(),page=await browser.newPage(),checks=[];let uploads=0;
page.on('request',r=>{if(r.method()==='POST'&&r.url().endsWith('/api/attachments'))uploads++;});
try{
 await page.goto(base+'/entries/new',{waitUntil:'networkidle'});await page.getByRole('textbox',{name:'Entry title',exact:true}).fill('测试外部导入单路径');
 const editor=page.locator('[contenteditable=true]:visible').last();await editor.fill('TEST-EXTERNAL-IMPORT');
 const bytes=[...await sharp({create:{width:120,height:80,channels:3,background:'#315f72'}}).png().toBuffer()];
 await editor.evaluate((el,bytes)=>{const d=new DataTransfer();d.items.add(new File([new Uint8Array(bytes)],'download',{type:'image/png'}));d.setData('text/html','<img src="data:image/png;base64,invalid" alt="TEST-HTML-DUPLICATE">');el.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:d}));},bytes);
 await page.waitForFunction(()=>document.querySelectorAll('[data-document-media]').length===1&&!document.querySelector('[data-document-media] [role=status]'));assert.equal(uploads,1);assert.equal(await editor.locator('img').count(),1);
 checks.push({name:'B16 HTML image plus File in one clipboard event follows a single upload path',status:'通过',uploads:1});
 await editor.evaluate((el,bytes)=>{const d=new DataTransfer();d.items.add(new File([new Uint8Array(bytes)],'',{type:'image/png'}));const r=el.getBoundingClientRect();el.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:d,clientX:r.left+20,clientY:r.top+10}));},bytes);
 await page.waitForFunction(()=>document.querySelectorAll('[data-document-media]').length===2&&!document.querySelector('[data-document-media] [role=status]'));assert.equal(uploads,2);
 checks.push({name:'B16/B21 external drop event with nameless File registers one actual original, separate from same-byte download',status:'通过',uploads:2,method:'Browser DragEvent/File; physical OS dragging not executed'});
 await editor.locator('p').last().click();await editor.evaluate(el=>{const d=new DataTransfer();d.setData('text/plain','TEST-TSV-ROW1\t25 µL\nTEST-TSV-ROW2\t50 µL');el.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:d}));});
 for(const value of ['TEST-TSV-ROW1','25 µL','TEST-TSV-ROW2','50 µL'])assert((await editor.innerText()).includes(value));
 checks.push({name:'C01 plain TSV reliably degrades to text retaining row order, values and units',status:'通过',nativeWordExcel:'未执行'});
 await page.getByRole('button',{name:'Save Entry',exact:true}).click();await page.waitForURL(/\/entries\/(?!new)[^/?]+$/);const id=page.url().split('/').pop();
 const data=(await(await page.request.get(base+'/api/entries/'+id)).json()).entry;assert.equal(data.attachmentCount,2);
 const blocks=[...data.contentMarkdown.matchAll(/<!--labnest-media:([^\s]+)-->/g)].map(m=>JSON.parse(decodeURIComponent(m[1])));assert.equal(new Set(blocks.map(x=>x.attachmentId)).size,2);
 for(const block of blocks){assert.equal((await page.request.get(base+'/api/attachments/'+block.attachmentId+'?inline=1')).status(),200);}
 await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('.ln-protocol-media-preview img').count(),2);await page.screenshot({path:dir+'/readback.png'});
}catch(error){checks.push({status:'失败',error:String(error)});throw error;}finally{writeFileSync(dir+'/report.json',JSON.stringify({synthetic:true,checks},null,2));await browser.close();}
