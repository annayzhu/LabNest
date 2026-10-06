import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
const base='http://localhost:3331',dir='docs/qa/evidence/entry-richtext/pending-save';
mkdirSync(dir,{recursive:true});
const browser=await chromium.launch(),page=await browser.newPage();
const report={synthetic:true,checks:[]};
try {
  for (const mode of ['body','pinned-properties','format-menu']) {
    const created=await page.request.post(base+'/api/entries',{multipart:{title:'测试慢保存 '+mode,contentMarkdown:'TEST-SLOW-SAVE',clientMutationId:randomUUID(),eventTimePrecision:'unknown'}});
    const id=(await created.json()).entryId;
    await page.goto(base+'/entries/'+id+'/edit',{waitUntil:'networkidle'});
    const editor=page.locator('[contenteditable=true]:visible').last();
    await editor.locator('p').first().click();await page.keyboard.press('End');await page.keyboard.insertText(' 新输入');
    let portal;
    if(mode==='pinned-properties') {
      await page.getByRole('tab',{name:'Metadata',exact:true}).click();
      portal=page.locator('.context-properties:visible');
      await portal.getByRole('button',{name:'固定展开',exact:true}).click();
      await portal.getByRole('textbox',{name:'State',exact:true}).fill('PRE-SAVE');
    } else if(mode==='format-menu') {
      await page.getByRole('button',{name:'Paragraph style',exact:true}).click();
      portal=page.locator('[data-toolbar-menu]:visible');
    }
    let started=false;
    await page.route('**/api/entries/'+id,async route=>{
      if(route.request().method()==='PATCH') {
        started=true;const response=await route.fetch();
        await new Promise(resolve=>setTimeout(resolve,1800));await route.fulfill({response});
      }else await route.continue();
    });
    // Keep an already opened portal open while the native submit event starts.
    // This covers keyboard/programmatic submission as well as a sticky save button.
    if(mode==='format-menu')await editor.evaluate(el=>el.closest('form').requestSubmit());
    else await page.getByRole('button',{name:'Save changes',exact:true}).click();
    for(let i=0;i<100&&!started;i++)await page.waitForTimeout(10);
    assert(started);
    assert(await editor.evaluate(el=>el.closest('form').inert),'Body must be inert during save');
    if(portal) {
      assert(await portal.evaluate(el=>el.inert),'Open body portal must inherit the owner form pending state');
      const control=portal.locator('input,select,button').first();
      await control.evaluate(el=>el.focus());
      assert(!(await control.evaluate(el=>el===document.activeElement)),'Pending portal cannot accept focus');
    }
    await page.keyboard.insertText(' SHOULD-NOT-BE-LOST');
    assert(!(await editor.innerText()).includes('SHOULD-NOT-BE-LOST'));
    await page.waitForURL(base+'/entries/'+id);
    const data=(await(await page.request.get(base+'/api/entries/'+id)).json()).entry;
    assert(data.contentMarkdown.includes('新输入'));
    if(mode==='pinned-properties')assert.equal(data.moodStatus,'PRE-SAVE');
    report.checks.push({name:'C03 slow response '+mode,status:'通过'});
    await page.unroute('**/api/entries/'+id);
  }
}catch(error){report.checks.push({status:'失败',error:String(error)});throw error;}
finally{await page.unrouteAll({behavior:'wait'});writeFileSync(dir+'/report.json',JSON.stringify(report,null,2));await browser.close();}
