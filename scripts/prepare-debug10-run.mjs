import {chromium} from 'playwright';import {readFile,writeFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const base=process.env.LABNEST_E2E_BASE_URL??'http://localhost:3221',dir='docs/calculator/v1.2/evidence';
const browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000}});const p=await context.newPage();
const report={checks:[],startedAt:new Date().toISOString()};
try{
await p.goto(base+'/protocols/new',{waitUntil:'networkidle'});const title='V12 synthetic protocol '+Date.now();await p.locator('[name=canonicalTitle]').fill(title);
const doc=JSON.parse(await readFile(dir+'/run-fixture.json','utf8'));
// Exercise headings emitted by the rich-text editor, not only plain heading blocks.
for(const section of doc.sections)for(let n=0;n<section.blocks.length;n++){const block=section.blocks[n];if(block.type==='heading')section.blocks[n]={id:block.id,type:'rich_text',nodes:[{type:'heading2',content:[{text:block.text}]}]};}
const upload=await context.request.post(base+'/api/attachments',{multipart:{file:{name:'synthetic-run-image.png',mimeType:'image/png',buffer:await readFile('public/icons/lab-soft-v1/dilution.png')}}});assert.equal(upload.status(),201);const attachment=(await upload.json()).attachment;report.syntheticAttachmentId=attachment.id;
const firstTable=doc.sections[0].blocks.findIndex(b=>b.id==='mix-table');
doc.sections[0].blocks.splice(firstTable+1,0,{id:'a-image',type:'media',mediaType:'image',url:`/api/attachments/${attachment.id}?inline=1`,caption:'Step A image only'},{id:'a-list',type:'rich_text',nodes:[{type:'bullet',content:[{text:'Step A list only'}]}]});
await p.locator('input[name=contentJson]').evaluate((el,value)=>el.value=JSON.stringify(value),doc);
await p.locator('button[type=submit]').first().click();await p.waitForURL(/\/protocols\/(?!new)/,{timeout:15000});report.protocolUrl=p.url();
await p.goto(base+'/experiments/new',{waitUntil:'networkidle'});await p.getByRole('tab',{name:'Metadata',exact:true}).click();await p.getByRole('button').filter({hasText:title}).click();await p.locator('[name=title]').fill('V12 synthetic run');if(await p.getByRole('button',{name:'收起属性',exact:true}).isVisible())await p.getByRole('button',{name:'收起属性',exact:true}).click();await p.getByRole('button',{name:'Save Experiment',exact:true}).click();await p.waitForURL(/\/experiments\/(?!new)/,{timeout:15000});report.experimentUrl=p.url();await p.goto(p.url()+'/run',{waitUntil:'networkidle'});report.runUrl=p.url();
await writeFile('docs/debug-20260910/evidence/synthetic-run.json',JSON.stringify(report,null,2));
}catch(error){report.error=String(error);throw error;}finally{await browser.close();}
