import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import sharp from 'sharp';
const base='http://localhost:3331',dir='docs/qa/evidence/entry-richtext/draft-switch';mkdirSync(dir,{recursive:true});
const browser=await chromium.launch(),page=await browser.newPage();const report={synthetic:true,checks:[]};
const editor=()=>page.locator('[contenteditable=true]:visible').last();
try {
  const ids=[];
  for(const label of ['A','B']) {
    const response=await page.request.post(base+'/api/entries',{multipart:{title:'测试切换 '+label,contentMarkdown:'TEST-'+label,clientMutationId:randomUUID(),eventTimePrecision:'unknown'}});
    ids.push((await response.json()).entryId);
  }
  const originals=[],attachments=[];
  for(let index=0;index<2;index++) {
    await page.goto(base+'/entries/'+ids[index]+'/edit',{waitUntil:'networkidle'});
    await editor().locator('p').first().click();await page.keyboard.press('End');await page.keyboard.insertText(' DRAFT-'+index);
    await page.keyboard.press('Enter');
    const buffer=await sharp({create:{width:120,height:60,channels:3,background:index?'#315f72':'#753241'}}).png().toBuffer();
    await page.locator('input[accept="image/*"][multiple]').setInputFiles({name:'测试草稿-'+index+'.png',mimeType:'image/png',buffer});
    await page.waitForFunction(()=>document.querySelector('[data-document-media]')&&!document.querySelector('[data-document-media] [role="status"]'));
    originals.push(await editor().locator('[data-document-media]').getAttribute('data-document-media'));
    attachments.push((await editor().locator('[data-document-media] img').getAttribute('src')).match(/\/api\/attachments\/([^?]+)/)[1]);
    await page.getByRole('tab',{name:'Metadata',exact:true}).click();
    await page.getByRole('combobox',{name:'记录类型',exact:true}).selectOption(index?'observation':'idea');
    await page.getByRole('textbox',{name:'State',exact:true}).fill('TEST-STATE-'+index);
    await page.getByRole('button',{name:'收起属性',exact:true}).click();
    await page.waitForTimeout(1000);
    await page.goto(base+'/entries',{waitUntil:'networkidle'});
  }
  assert.notEqual(originals[0],originals[1]);
  for(let index=0;index<2;index++) {
    await page.goto(base+'/entries/'+ids[index]+'/edit',{waitUntil:'networkidle'});
    await page.waitForFunction(index=>[...document.querySelectorAll('[contenteditable=true]')].some(el=>el.innerText.includes('DRAFT-'+index)),index);
    assert((await editor().innerText()).includes('DRAFT-'+index));
    assert(!(await editor().innerText()).includes('DRAFT-'+(1-index)));
    assert.equal(await editor().locator('[data-document-media]').getAttribute('data-document-media'),originals[index]);
    await page.getByRole('button',{name:'Save changes',exact:true}).click();await page.waitForURL(base+'/entries/'+ids[index]);
    const entry=(await(await page.request.get(base+'/api/entries/'+ids[index])).json()).entry;
    assert(entry.contentMarkdown.includes('DRAFT-'+index));assert.equal(entry.entryType,index?'observation':'idea');assert.equal(entry.moodStatus,'TEST-STATE-'+index);assert.equal(entry.attachments.length,1);assert.equal(entry.attachments[0].id,attachments[index]);
    report.checks.push({name:'C04 record '+index+' unsaved body/image recovered and saved to its own record',status:'通过'});
  }
}catch(error){report.checks.push({status:'失败',error:String(error)});throw error;}
finally{writeFileSync(dir+'/report.json',JSON.stringify(report,null,2));await browser.close();}
