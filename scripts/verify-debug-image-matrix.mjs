import {chromium} from 'playwright';import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';
const base=process.env.LABNEST_ACCEPTANCE_URL??'http://localhost:3232';assert.ok(['http://localhost:3232','http://localhost:3233'].includes(base));
const f=JSON.parse(readFileSync('docs/debug-20260909/evidence/image-matrix-fixtures.json'));const browser=await chromium.launch();const page=await browser.newPage();const records=[];
try{
 for(const item of f.cases)for(const key of ['Backspace','Delete']){
 const position=item.position;await page.goto(base+item.edit,{waitUntil:'networkidle'});const body=page.locator('[contenteditable="true"]').first();const anchor=body.getByText('插图位置',{exact:true});await anchor.click();await anchor.evaluate(el=>{const r=document.createRange();r.selectNodeContents(el);const selection=getSelection();selection.removeAllRanges();selection.addRange(r);});
 const before=await body.evaluate(el=>({height:el.getBoundingClientRect().height,text:el.textContent}));
 await body.evaluate(el=>{const c=document.createElement('canvas');c.width=240;c.height=120;const ctx=c.getContext('2d');ctx.fillStyle='#315f72';ctx.fillRect(0,0,240,120);const data=new DataTransfer();data.items.add(new File([Uint8Array.from(atob(c.toDataURL().split(',')[1]),c=>c.charCodeAt(0))],'delete-fixture.png',{type:'image/png'}));el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));});
 const inserted=body.locator('[data-document-media] img[alt="delete-fixture.png"]');await inserted.waitFor();const mediaId=await inserted.locator('xpath=ancestor::*[@data-document-media][1]').getAttribute('data-document-media');const media=page.locator(`[data-document-media="${mediaId}"]`);await media.getByRole('img').evaluate(img=>img.decode());await media.getByRole('img').click();await media.focus();await page.keyboard.press(key);
 await media.waitFor({state:'detached'});
 const after=await body.evaluate(el=>({height:el.getBoundingClientRect().height,text:el.textContent}));
 assert.ok(after.height<=before.height+36,`${item.name}: image-owned whitespace persists ${before.height} -> ${after.height}`);
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'Undo',exact:true}).click();await media.waitFor();await page.keyboard.press('Escape');await page.getByRole('button',{name:'Redo',exact:true}).click();await media.waitFor({state:'detached'});await page.waitForFunction(()=>document.activeElement?.getAttribute('contenteditable')==='true');await page.keyboard.type('删除后继续中文');
 assert.ok((await body.innerText()).includes('删除后继续中文'),`${item.name}: focus not restored to editor after delete`);
 records.push({entry:item.name,position,key,undoRedo:true,before,after});writeFileSync('docs/debug-20260909/evidence/image-matrix.json',JSON.stringify(records,null,2));
 }
 writeFileSync('docs/debug-20260909/evidence/image-matrix.json',JSON.stringify(records,null,2));
}finally{await browser.close();}
