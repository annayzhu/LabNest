import assert from 'node:assert/strict';

// Exercise the writing UI, not the editor instance or its serialized hidden input.
export async function insertTable(page, editor, columns = 4) {
  await page.keyboard.type('/table');
  const menu = page.locator('.ln-insert-menu');
  await menu.waitFor();
  const box = await menu.boundingBox();
  assert(box.x >= -1 && box.x + box.width <= page.viewportSize().width + 1, 'Insert menu fits viewport');
  await menu.getByRole('option').filter({ hasText: /Table|表格/ }).first().click();
  const index = await editor.evaluate(el => { const selection = window.getSelection(); return [...el.querySelectorAll('table')].indexOf(selection?.anchorNode?.parentElement?.closest('table')); });
  assert(index >= 0, 'Insertion leaves the caret inside the new table');
  const table = editor.locator('table').nth(index);
  await table.locator('th,td').first().click();
  for (let count = 3; count < columns; count++) await page.getByRole('toolbar', { name: /^(Table|表格)$/ }).getByRole('button', { name: /＋ (Column|列)/ }).click();
  assert.equal(await table.locator('tr').count(), 3);
  assert.equal(await table.locator('tr').first().locator('th,td').count(), columns);
  return table;
}

export async function resizeImage(media, width = 60) {
  const handle = media.getByRole('slider', { name: '图片宽度 / Image width', exact: true });
  await handle.focus();
  await handle.press('Home');
  for (let value = 10; value < width; value += 5) await handle.press('ArrowRight');
  assert.equal(await handle.getAttribute('aria-valuenow'), String(width));
}

export async function closeProperties(page) {
  const close = page.getByRole('button', { name: /^(Hide properties|收起属性)$/ });
  if (await close.isVisible()) await close.click();
}

export async function convertLegacySteps(page) {
  await page.getByRole('link', { name: '转换为步骤块', exact: true }).click();
  await page.getByRole('button', { name: /生成草稿 v.*并打开编辑器/ }).click();
  await page.waitForURL(/\/versions\/[^/]+\/edit$/);
  return page.url().split('/versions/')[1].split('/')[0];
}

export async function selectText(block) {
  await block.evaluate(el => {
    el.closest('[contenteditable=true]').focus({preventScroll:true});
    const range = document.createRange(); range.selectNodeContents(el);
    const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
  });
}

export async function openBlockMenu(page, block) {
  await block.evaluate(el => el.scrollIntoView({block:'center'}));
  await block.hover();
  await page.getByRole('button', {name:'Drag to move, click for the menu',exact:true}).click();
  return page.getByRole('menu', {name:'Block actions',exact:true});
}

export async function uploadImages(page, files, kind = 'image', target) {
  const editor = target ?? page.locator('[contenteditable=true]:visible').last();
  await caretAtEnd(editor);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.keyboard.type('/'+kind);
  const chooser = page.waitForEvent('filechooser');
  await page.locator('.ln-insert-menu').getByRole('option').filter({hasText:kind==='image'?/^Image/:/^File/}).click();
  await (await chooser).setFiles(files);
}

export async function caretAtEnd(editor) {
  await editor.evaluate(async el => {
    (el.closest('[contenteditable=true]') ?? el).focus(); const range=document.createRange(); range.selectNodeContents(el); range.collapse(false);
    const selection=getSelection(); selection.removeAllRanges(); selection.addRange(range);
    // Let the native selectionchange reach the editor before the next key replaces its selection.
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}
