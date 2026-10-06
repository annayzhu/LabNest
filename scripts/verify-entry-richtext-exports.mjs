import {chromium} from 'playwright';import assert from 'node:assert/strict';import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';import {unzipSync,strFromU8} from 'fflate';
const base='http://localhost:3331',dir='docs/qa/evidence/entry-richtext/exports';mkdirSync(dir,{recursive:true});
const f=JSON.parse(readFileSync('docs/qa/evidence/entry-richtext/fixtures.json'));
const b=await chromium.launch(),p=await b.newPage();const report={synthetic:true,checks:[]};
async function download(selector,file){const wait=p.waitForEvent('download');await selector.click();const d=await wait;await d.saveAs(dir+'/'+file);return readFileSync(dir+'/'+file);}
try {
await p.goto(base+'/protocols/'+f.protocolId,{waitUntil:'networkidle'});await p.locator('.protocol-export-menu summary').click();
const docx=await download(p.getByRole('link',{name:/DOCX/}),'protocol.docx');const zip=unzipSync(docx),xml=strFromU8(zip['word/document.xml']);
assert(xml.includes('测试图注'));assert(xml.includes('表格'));assert(xml.includes('<w:tbl>'));assert(Object.keys(zip).some(x=>x.startsWith('word/media/')));assert(strFromU8(zip['word/_rels/document.xml.rels']).includes('media/'));
report.checks.push({name:'C07 Protocol DOCX via actual export menu contains body, table, caption and embedded image',status:'通过'});
const json=JSON.parse((await download(p.getByRole('link',{name:/JSON/}),'protocol.json')).toString());assert.equal(json.protocol.id,f.protocolId);assert.equal(json.version.id,f.versionId);assert(JSON.stringify(json.document).includes('attachmentId'));report.checks.push({name:'C07 Protocol JSON keeps version and original media identity',status:'通过'});
await p.goto(base+'/reports/'+f.reportId,{waitUntil:'networkidle'});await p.getByRole('button',{name:'More actions',exact:true}).click();
const md=(await download(p.getByRole('link',{name:'Export Markdown',exact:true}),'report.md')).toString();assert(md.includes('测试图注'));assert(md.includes('attachment:'));assert(md.includes('表格'));report.checks.push({name:'C07 Report Markdown preserves body/table/image reference',status:'通过'});
}catch(error){report.checks.push({status:'失败',error:String(error)});throw error;}finally{writeFileSync(dir+'/report.json',JSON.stringify(report,null,2));await b.close();}
