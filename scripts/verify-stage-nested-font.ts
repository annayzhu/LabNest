import 'dotenv/config';
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {unzipSync,strFromU8} from 'fflate';
import {prisma} from '../src/lib/db';
import {createProtocolTemplateDocument,richTextFromPlainText} from '../src/lib/protocol-document';
async function main(){
 assert.equal(new URL(process.env.DATABASE_URL!).pathname,'/labnest_stage_a_acceptance');
 const base=process.env.LABNEST_ACCEPTANCE_URL??'http://localhost:3234';assert(['http://localhost:3234','http://localhost:3235'].includes(base));
 const protocol=await prisma.protocol.create({data:{humanCode:'SYN-NEST-'+Date.now(),title:'Synthetic nested size '+Date.now()}});const doc=createProtocolTemplateDocument();doc.sections.find(s=>s.key==='purpose')!.blocks=[{id:'outer',type:'rich_text',nodes:richTextFromPlainText('Outer body')}];const block=doc.sections.find(s=>s.key==='result_templates')!.blocks[0];if(block.type==='table'&&block.resultTemplate)block.resultTemplate.instructions=richTextFromPlainText('Nested instruction 42');
 const version=await prisma.protocolVersion.create({data:{protocolId:protocol.id,title:protocol.title,revision:1,contentJson:doc}});
 const browser=await chromium.launch();const page=await browser.newPage();
 try{
  await page.goto(base+`/protocols/${protocol.id}/versions/${version.id}/edit`);await page.getByText('Outer body',{exact:true}).click();await page.getByRole('button',{name:'Font size',exact:true}).click();await page.getByLabel('字号作用范围 / Font size scope').selectOption('document');await page.getByRole('menuitem',{name:'18 pt',exact:true}).click();
  const template=page.locator('.ln-protocol-result-template-editor');await template.locator('summary').first().click();assert.equal(await template.getByText('Nested instruction 42',{exact:true}).evaluate(e=>getComputedStyle(e).fontSize),'24px');
  await page.getByRole('button',{name:'Save Protocol',exact:true}).click();await page.waitForURL(u=>!u.pathname.endsWith('/edit'));await page.reload();assert.equal(await page.getByText('Nested instruction 42',{exact:true}).evaluate(e=>getComputedStyle(e).fontSize),'24px');
  const response=await page.request.get(base+`/api/protocols/${protocol.id}/versions/${version.id}/docx`);assert.equal(response.status(),200);const bytes=await response.body();const xml=strFromU8(unzipSync(bytes)['word/document.xml']);assert.match(xml,/<w:sz w:val="36"/);assert(xml.includes('Nested instruction 42'));assert(xml.includes('Outer body'));writeFileSync('docs/stage-20260908/C/evidence/nested.docx',bytes);writeFileSync('docs/stage-20260908/C/evidence/nested.json',JSON.stringify({protocolId:protocol.id,versionId:version.id,checks:['Outer whole-document formatting reaches nested instructions','Save and read-only retains18pt','DOCX includes nested text and36half-point runs']},null,2));
 }finally{await browser.close();await prisma.$disconnect();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
