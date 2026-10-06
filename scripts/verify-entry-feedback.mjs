import {chromium} from 'playwright';import assert from 'node:assert/strict';import {writeFileSync,mkdirSync} from 'node:fs';import {cpus,platform,release} from 'node:os';
const dir='docs/qa/evidence/entry-richtext/feedback';mkdirSync(dir,{recursive:true});
const browser=await chromium.launch(),page=await browser.newPage();
const measurements={synthetic:true,browser:browser.version(),device:{cpu:cpus()[0].model,os:platform()+' '+release()},method:'Actual keyboard beforeinput → observed DOM mutation → next animation frame; does not measure IME candidate confirmation or network persistence.',text:[],format:[]};
try {
await page.goto('http://localhost:3331/entries/new',{waitUntil:'networkidle'});const editor=page.locator('[contenteditable=true]:visible').last();await editor.fill(Array.from({length:80},(_,i)=>'测试段落 '+i+' 中文连续输入 '.repeat(12)).join('\n'));await editor.locator('p').last().click();await page.keyboard.press('End');
await editor.evaluate(el=>{window.feedback=[];let started=0;el.addEventListener('beforeinput',()=>{started=performance.now();});new MutationObserver(()=>{if(started){const start=started;started=0;requestAnimationFrame(()=>window.feedback.push(performance.now()-start));}}).observe(el,{subtree:true,childList:true,characterData:true});});
for(let i=0;i<20;i++){await page.keyboard.insertText('中'+i);await page.waitForTimeout(30);}
measurements.text=await page.evaluate(()=>window.feedback);
for(let i=0;i<10;i++){
await page.getByRole('button',{name:'Paragraph style',exact:true}).click();const target=page.getByRole('menuitem',{name:i%2?'Body':'Heading 2',exact:true});
await target.evaluate(el=>{el.addEventListener('click',()=>{const start=performance.now();requestAnimationFrame(()=>window.formatLatency=performance.now()-start);},{once:true});});
await target.click();await page.waitForTimeout(30);measurements.format.push(await page.evaluate(()=>window.formatLatency));}
assert(measurements.text.length>=20);assert(!measurements.text.some(x=>!Number.isFinite(x)));measurements.status='通过';
for(const key of ['text','format']){const a=[...measurements[key]].sort((a,b)=>a-b);measurements[key+'Summary']={n:a.length,p50:a[Math.floor(a.length*.5)],p95:a[Math.min(a.length-1,Math.floor(a.length*.95))]};}
}catch(error){measurements.status='失败';measurements.error=String(error);throw error;}finally{writeFileSync(dir+'/report.json',JSON.stringify(measurements,null,2));await browser.close();}
