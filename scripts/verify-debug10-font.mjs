import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const base=process.env.LABNEST_ACCEPTANCE_URL??'http://localhost:3240';assert(['http://localhost:3240','http://localhost:3235'].includes(base));
const out='docs/debug-20260910/evidence/fonts';mkdirSync(out,{recursive:true});
const fixture=JSON.parse(readFileSync('docs/debug-20260910/evidence/font-fixtures.json')).cases.find(c=>c.name==='experiment');
const browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1440,height:1000}});const report={checks:[]};
try {
 await page.goto(base+fixture.edit,{waitUntil:'networkidle'});
 const body=page.locator('[contenteditable=true]').first();await body.getByText('Alpha sample beta',{exact:true}).click();await body.press('End');
 await body.evaluate(el=>{const c=document.createElement('canvas');c.width=120;c.height=80;const ctx=c.getContext('2d');ctx.fillStyle='#315f72';ctx.fillRect(0,0,120,80);const dt=new DataTransfer();dt.items.add(new File([Uint8Array.from(atob(c.toDataURL().split(',')[1]),x=>x.charCodeAt(0))],'font-image.png',{type:'image/png'}));el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));});
 await page.waitForFunction(()=>[...document.images].some(i=>i.alt==='font-image.png'&&i.src.includes('/api/attachments/')&&i.complete&&i.naturalWidth>0));
 const media=page.locator('[data-document-media]').last();await media.getByRole('img').click();await page.getByRole('textbox',{name:'图注 / Caption',exact:true}).fill('Caption size sample'); await page.getByRole('button',{name:'收起属性'}).click();
 await body.getByText('Alpha sample beta',{exact:true}).click();
 await page.getByRole('button',{name:'Font size',exact:true}).click();
 await page.getByRole('combobox',{name:'字号作用范围 / Font size scope',exact:true}).selectOption('document');
 await page.getByRole('menuitem',{name:'18 pt',exact:true}).click();
 for(const text of ['Heading sample','Alpha sample beta','List sample','Group','Control','Treatment']) {
  const size=await page.locator('[contenteditable=true]').getByText(text,{exact:true}).first().evaluate(el=>getComputedStyle(el).fontSize);
  assert.equal(size,'24px',text+' entire document size');
 }
 assert.equal(await page.locator('.ln-protocol-section-heading h2').first().evaluate(el=>getComputedStyle(el).fontSize),'24px','Section heading participates in entire document size');
 assert.equal(await media.locator('figcaption').evaluate(el=>getComputedStyle(el).fontSize),'24px','Caption participates in entire document size');
 report.checks.push('Entire document applies 18pt to heading, body, list and table across sections');
 await page.getByRole('button',{name:fixture.save,exact:true}).click();await page.waitForURL(base+fixture.view);await page.reload({waitUntil:'networkidle'});
 for(const text of ['Heading sample','Alpha sample beta','List sample','Group','Control','Treatment'])assert.equal(await page.getByText(text,{exact:true}).first().evaluate(el=>getComputedStyle(el).fontSize),'24px',text+' persisted size');
 report.checks.push('Read-only refresh preserves explicit document font size');
 assert.equal(await page.locator('.document-section-title').first().evaluate(el=>getComputedStyle(el).fontSize),'24px','Read-only section heading');
 assert.equal(await page.getByText('Caption size sample',{exact:true}).last().evaluate(el=>getComputedStyle(el).fontSize),'24px','Read-only caption');
 await page.goto(base+fixture.edit,{waitUntil:'networkidle'});
 async function font(scope,size,text){
  await page.locator('[contenteditable=true]').getByText(text,{exact:true}).first().click();
  await page.getByRole('button',{name:'Font size',exact:true}).click();
  await page.getByRole('combobox',{name:'字号作用范围 / Font size scope',exact:true}).selectOption(scope);
  await page.getByRole('menuitem',{name:size+' pt',exact:true}).click();
 }
 async function size(text){return page.locator('[contenteditable=true]').getByText(text,{exact:true}).first().evaluate(el=>getComputedStyle(el).fontSize);}
 await font('cell',12,'Control');
 assert.equal(await size('Control'),'16px');assert.equal(await size('10'),'24px');
 await font('row',14,'Treatment');
 assert.equal(await size('Treatment'),'18.6667px');assert.equal(await size('20'),'18.6667px');assert.equal(await size('Control'),'16px');
 await font('table',20,'Control');
 for(const text of ['Group','Value','Control','10','Treatment','20'])assert.equal(await size(text),'26.6667px');
 assert.equal(await size('Alpha sample beta'),'24px');
 report.checks.push('Cell, row and whole-table sizes preserve other scopes and numeric contents');
 await font('cell',12,'Control');
 const first=await page.locator('[contenteditable=true] td').filter({hasText:'Control'}).boundingBox();
 const second=await page.locator('[contenteditable=true] td').filter({hasText:/^10$/}).boundingBox();
 await page.mouse.move(first.x+10,first.y+10);await page.mouse.down();await page.mouse.move(second.x+second.width/2,second.y+second.height/2,{steps:12});await page.mouse.up();
 assert.equal(await page.locator('.selectedCell').count(),2,'Two selected table cells');
 assert.match(await page.getByRole('button',{name:'Font size',exact:true}).innerText(),/Mixed|多种/);
 await page.getByRole('button',{name:'Font size',exact:true}).click();await page.getByLabel('字号作用范围 / Font size scope').selectOption('selection');await page.getByRole('menuitem',{name:'16 pt',exact:true}).click();
 assert.equal(await size('Control'),'21.3333px');assert.equal(await size('10'),'21.3333px');assert.equal(await size('Group'),'26.6667px');
 await page.getByRole('button',{name:fixture.save,exact:true}).click();await page.waitForURL(base+fixture.view);await page.goto(base+fixture.edit);
 assert.equal(await size('Control'),'21.3333px');assert.equal(await size('10'),'21.3333px');assert.equal(await size('Group'),'26.6667px');
 report.checks.push('Multi-cell selection shows mixed size, applies only two cells and persists after save/reedit');

} catch(error){report.error=String(error);throw error;}finally{writeFileSync(out+'/text.json',JSON.stringify(report,null,2));await browser.close();}
