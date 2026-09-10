import {chromium} from 'playwright';import {readFile,writeFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const dir='docs/debug-20260910/evidence/format';const fixtures=JSON.parse(await readFile(dir+'/fixtures.json','utf8'));const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:1000}});const checks=[];
try{for(const item of fixtures.cases){
 await p.goto('http://localhost:3240'+item.edit,{waitUntil:'networkidle'});
 const target=p.locator('.tiptap p').filter({hasText:'Editor acceptance body'}).first();await target.click();
 await p.getByRole('button',{name:'Paragraph layout',exact:true}).click();await p.getByRole('menuitem',{name:'Align center',exact:true}).click();assert.equal(await target.evaluate(el=>getComputedStyle(el).textAlign),'center');
 await p.getByRole('button',{name:'Paragraph layout',exact:true}).click();await p.getByRole('menuitem',{name:'Increase paragraph indent',exact:true}).click();assert.equal(await target.getAttribute('data-labnest-documentIndent'),'1');
 await p.getByRole('button',{name:item.save,exact:true}).click();await p.waitForURL(url=>!url.pathname.endsWith('/edit'));await p.goto('http://localhost:3240'+item.view,{waitUntil:'networkidle'});
 const saved=p.getByText(/Editor acceptance body/).filter({hasNot:p.locator('input')});
 const matches=await saved.evaluateAll(nodes=>nodes.filter(el=>el.textContent.length<90).map(el=>({text:el.textContent,align:getComputedStyle(el).textAlign,padding:getComputedStyle(el).paddingInlineStart})));
 assert(matches.some(el=>el.align==='center'),JSON.stringify(matches));
 await p.pdf({path:`${dir}/${item.name}.pdf`,preferCSSPageSize:true,printBackground:true});
 await p.goto('http://localhost:3240'+item.edit,{waitUntil:'networkidle'});assert.equal(await target.evaluate(el=>getComputedStyle(el).textAlign),'center');assert.equal(await target.getAttribute('data-labnest-documentIndent'),'1');
 checks.push({entry:item.name,status:'passed',savedReadonlyAndReopened:matches});
 }}catch(error){checks.push({status:'failed',error:String(error)});await p.screenshot({path:dir+'/failure.png',fullPage:true});throw error;}finally{await writeFile(dir+'/browser.json',JSON.stringify(checks,null,2));await b.close();}
