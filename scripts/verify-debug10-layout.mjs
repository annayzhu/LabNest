import {chromium} from 'playwright';import {readFile,writeFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const fixture=JSON.parse(await readFile('docs/debug-20260910/evidence/synthetic-run.json','utf8'));const b=await chromium.launch();const p=await b.newPage({viewport:{width:1440,height:1000}});const report={};
try{
 await p.goto(fixture.protocolUrl,{waitUntil:'networkidle'});await p.getByRole('link',{name:'Edit Protocol',exact:true}).click();await p.waitForLoadState('networkidle');
 // Pick an ordinary paragraph, leaving table and list navigation untouched.
 const target=p.locator('.tiptap p').filter({hasText:'Table note'}).first();await target.click();
 await p.getByRole('button',{name:'Paragraph layout',exact:true}).click();await p.getByRole('menuitem',{name:'Align right',exact:true}).click();
 assert.equal(await target.evaluate(el=>getComputedStyle(el).textAlign),'right');
 await p.getByRole('button',{name:'Paragraph layout',exact:true}).click();await p.getByRole('menuitem',{name:'Increase paragraph indent',exact:true}).click();
 assert.equal(await target.getAttribute('data-labnest-documentIndent'),'1');
 const submitted=JSON.parse(await p.locator('input[name=contentJson]').inputValue());assert(JSON.stringify(submitted).includes('"textAlign":"right"'));
 await p.locator('button[type=submit]').first().click();await p.waitForURL(/\/protocols\/[^/]+$/);
 await p.getByText('Table note: all four components must remain visible.',{exact:true}).waitFor();assert.equal(await p.getByText('Table note: all four components must remain visible.',{exact:true}).evaluate(el=>getComputedStyle(el).textAlign),'right');
 report.status='passed';await p.screenshot({path:'docs/debug-20260910/evidence/layout-readonly.png',fullPage:true});
 await p.pdf({path:'docs/debug-20260910/evidence/layout-readonly.pdf',format:'A4',printBackground:true});
 await p.goto(fixture.protocolUrl,{waitUntil:'networkidle'});await p.getByRole('link',{name:'Edit Protocol',exact:true}).click();await p.waitForLoadState('networkidle');assert.equal(await p.locator('.tiptap p').filter({hasText:'Table note'}).first().evaluate(el=>getComputedStyle(el).textAlign),'right');
}catch(error){report.status='failed';report.error=String(error);await p.screenshot({path:'docs/debug-20260910/evidence/layout-failure.png',fullPage:true});throw error;}finally{await writeFile('docs/debug-20260910/evidence/layout-browser.json',JSON.stringify(report,null,2));await b.close();}
