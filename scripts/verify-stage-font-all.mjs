import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const base=process.env.LABNEST_ACCEPTANCE_URL??'http://localhost:3234';assert(['http://localhost:3234','http://localhost:3235'].includes(base));
const dir='docs/stage-20260908/C/evidence';mkdirSync(dir,{recursive:true});
const fixtures=JSON.parse(readFileSync('docs/stage-20260908/C/fixtures.json'));
const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1440,height:1000}});const checks=[];
try{for(const item of fixtures.cases){
 await page.emulateMedia({media:'screen'});await page.goto(base+item.edit);const editor=page.locator('[contenteditable=true]').first();await editor.click();
 await editor.evaluate(el=>{const canvas=document.createElement('canvas');canvas.width=120;canvas.height=80;const ctx=canvas.getContext('2d');ctx.fillStyle='#315f72';ctx.fillRect(0,0,120,80);const d=new DataTransfer();d.items.add(new File([Uint8Array.from(atob(canvas.toDataURL().split(',')[1]),v=>v.charCodeAt(0))],'font-all.png',{type:'image/png'}));el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:d,bubbles:true,cancelable:true}));});
 const img=editor.getByRole('img',{name:'font-all.png',exact:true});await img.evaluate(i=>i.decode());await img.click();const caption='字号图注 '+item.name;
 await page.getByRole('textbox',{name:'图注 / Caption',exact:true}).fill(caption);await page.getByRole('button',{name:'收起属性'}).click();
 await editor.getByText(item.name==='entry'?'Editor acceptance body':'Alpha sample beta',{exact:true}).first().click();
 await page.getByRole('button',{name:'Font size',exact:true}).click();await page.getByLabel('字号作用范围 / Font size scope').selectOption('document');await page.getByRole('menuitem',{name:'18 pt',exact:true}).click();
 const bodyText=item.name==='entry'?'Editor acceptance body':'Alpha sample beta';assert.equal(await editor.getByText(bodyText,{exact:true}).first().evaluate(e=>getComputedStyle(e).fontSize),'24px');
 for(const mode of ['edit','view']){
  if(mode==='view'){await page.getByRole('button',{name:item.save,exact:true}).click();await page.waitForURL(u=>!u.pathname.endsWith('/edit'));await page.goto(base+item.view);await page.reload();}
  const picture=page.getByRole('img',{name:caption,exact:true}).first();await picture.evaluate(i=>i.decode());assert.equal(await page.getByText(bodyText,{exact:true}).first().evaluate(e=>getComputedStyle(e).fontSize),'24px');
  await page.emulateMedia({media:'print'});const path=`${dir}/${item.name}-font-${mode}.pdf`;const bytes=await page.pdf({path,format:'A4',printBackground:true});assert(bytes.toString('latin1').includes('/Subtype /Image'));const text=execFileSync('pdftotext',[path,'-'],{encoding:'utf8'});assert(text.includes(bodyText));assert(text.includes(caption));assert(text.split('\f').slice(0,-1).every(p=>p.trim()),'No empty printed page');await page.emulateMedia({media:'screen'});
 }
 await page.goto(base+item.edit);assert.equal(await page.getByText(bodyText,{exact:true}).first().evaluate(e=>getComputedStyle(e).fontSize),'24px');await page.getByRole('img',{name:caption,exact:true}).first().evaluate(i=>i.decode());checks.push({entry:item.name,fullFontSaveRefreshReeditImagesPrint:'passed'});
}
writeFileSync(dir+'/font-all.json',JSON.stringify({checks},null,2));
}finally{await browser.close();}
