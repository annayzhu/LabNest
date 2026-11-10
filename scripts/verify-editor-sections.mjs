// Real-path checks, with synthetic text, for what a document's fixed sections, the "/" search field, the plate editor and a blocked save do.
// Edits and saves records, so it runs only against a test service: BASE_URL=http://localhost:3006 node scripts/verify-editor-sections.mjs
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { useChineseInterface as chineseInterface } from './qpcr-browser-helpers.mjs';

const base = process.env.BASE_URL ?? 'http://localhost:3006';
assert.notEqual(new URL(base).port, '3001', 'This check saves records; 3001 is the formal service.');
const out = process.env.EVIDENCE_DIR ?? '.local-runtime/editor-sections-20261105';
mkdirSync(out, { recursive: true });
const lines = ['Cells A control', 'Cells A knockdown 1', 'Cells A knockdown 2'];
const sizes = [[1366, 768], [1440, 900], [1920, 1080]];
const report = [];

const browser = await chromium.launch();
try {
  for (const [width, height] of sizes) {
    const context = await browser.newContext({ viewport: { width, height } });
    await chineseInterface(context, base);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const editor = page.locator('.ln-scientific-tiptap');
    await page.goto(`${base}/experiments/new`);
    await editor.waitFor();

    // A new Experiment with no Protocol says why it can't be saved, and offers the way out.
    const bar = page.locator('.document-editor-save-bar');
    const save = bar.getByRole('button', { name: '保存实验' });
    await page.getByRole('button', { name: '返回主界面继续填写或保存' }).click();
    assert(await save.isDisabled(), 'Save is off with no Protocol chosen');
    assert.match(await bar.innerText(), /还不能保存/);
    await bar.getByRole('button', { name: '选择规程' }).click();
    await page.getByRole('button', { name: '返回主界面继续填写或保存' }).click();

    // Lines written in a section, then a table from the "/" search field.
    const setup = page.locator('section[data-section-key="setup"]');
    await setup.locator('p').first().click();
    for (const [index, line] of lines.entries()) { if (index) await page.keyboard.press('Enter'); await page.keyboard.type(line); }
    await page.keyboard.press('Enter');
    await page.keyboard.type('/');
    const menu = page.locator('.ln-insert-menu');
    await menu.waitFor();
    const field = menu.getByRole('textbox');
    await field.waitFor();
    assert.equal(await field.evaluate(el => el === document.activeElement), true, 'the search field takes the typing');
    await page.screenshot({ path: `${out}/slash-${width}.png` });
    await page.keyboard.type('bg');
    assert.equal(await field.inputValue(), 'bg');
    assert.equal(await menu.getByRole('option').count(), 1, 'the list narrows');
    await page.keyboard.press('Enter');
    await editor.locator('table').waitFor();
    assert.doesNotMatch(await setup.innerText(), /\//, 'the slash is gone');

    // Copy the lines, paste them on an empty cell: the lines arrive, not the section around them.
    const first = await setup.locator('p').nth(0).boundingBox(), last = await setup.locator('p').nth(lines.length - 1).boundingBox();
    await page.mouse.move(first.x + 1, first.y + first.height / 2);
    await page.mouse.down();
    await page.mouse.move(last.x + last.width - 2, last.y + last.height / 2, { steps: 6 });
    await page.mouse.up();
    // Automation can't press ⌘C and ⌘V on macOS, so the page's own copy and paste events carry the clipboard.
    assert(await page.evaluate(() => { const data = new DataTransfer(); window.clip = data; document.querySelector('.ln-scientific-tiptap').dispatchEvent(new ClipboardEvent('copy', { clipboardData: data, bubbles: true, cancelable: true })); return data.getData('text/html').includes('Cells A'); }), 'the selection reaches the clipboard');
    await editor.locator('table td').first().click();
    // The editor reads a click's new caret a moment later, from the browser's selection event.
    await page.waitForFunction(() => document.querySelector('.ln-scientific-tiptap').editor.state.selection.$from.node(-1)?.type.name === 'tableCell');
    await page.evaluate(() => document.querySelector('.ln-scientific-tiptap').dispatchEvent(new ClipboardEvent('paste', { clipboardData: window.clip, bubbles: true, cancelable: true })));
    await page.waitForFunction(() => document.querySelector('.ln-scientific-tiptap table td')?.innerText.includes('Cells A'), undefined, { timeout: 4000 });
    assert.equal(await editor.locator('table section').count(), 0, 'no section inside the cell');
    assert.deepEqual((await editor.locator('table td').first().innerText()).split(/\n+/).map(line => line.trim()).filter(Boolean), lines);
    await page.screenshot({ path: `${out}/cell-${width}.png` });

    // Backspace at the top of a section says why nothing happened.
    await page.mouse.click(first.x + 1, first.y + first.height / 2);
    await page.waitForFunction(() => document.querySelector('.ln-scientific-tiptap').editor.state.selection.$from.parentOffset === 0);
    await page.keyboard.press('Backspace');
    await page.locator('.ln-editor-notice').waitFor();
    assert.match(await page.locator('.ln-editor-notice').innerText(), /小节标题/);
    await page.screenshot({ path: `${out}/notice-${width}.png` });
    const sections = await editor.locator('section[data-section-key]').count();

    // Select all and delete clears every section and keeps them all; undo brings it back.
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('Backspace');
    assert.equal(await editor.locator('section[data-section-key]').count(), sections, 'every section stays');
    assert.doesNotMatch(await editor.innerText(), /Cells A/);
    await page.keyboard.press('ControlOrMeta+z');
    await editor.getByText(lines[0]).first().waitFor();

    // A plate: what is typed for a well shows on the plate before leaving the field.
    await page.locator('section[data-section-key="conclusion"] p').first().click();
    await page.keyboard.type('/');
    await menu.waitFor();
    await page.keyboard.type('bbj');
    await page.keyboard.press('Enter');
    const plate = page.locator('.ln-plate-editor');
    await plate.waitFor();
    await plate.getByRole('combobox', { name: /板型|Plate size/ }).selectOption('12');
    await plate.locator('button.ln-plate-layout-axis').first().click();
    const values = plate.locator('.ln-plate-editor-field input');
    await values.nth(0).fill('Cells A');
    await plate.locator('[data-well="A1"]').click();
    await values.nth(1).click();
    await page.keyboard.type('Mock');
    assert.match(await plate.locator('[data-well="A1"]').innerText(), /Cells A\s+Mock/, 'the value is on the well while the field has the focus');
    const measured = await plate.evaluate(el => {
      const well = el.querySelector('[data-well="A1"]'), grid = el.querySelector('.ln-plate-layout-grid'), body = el.querySelector('.ln-plate-editor-body');
      return { well: Math.round(well.getBoundingClientRect().width), grid: Math.round(grid.getBoundingClientRect().width), font: getComputedStyle(well.querySelector('span')).fontSize, scrolls: body.scrollHeight > body.clientHeight };
    });
    await page.screenshot({ path: `${out}/plate-${width}.png` });
    assert(parseFloat(measured.font) >= 12, 'well text is at least 12 px');

    // Colour by the other parameter, then copy: the original stays, the editor carries on in the copy.
    await plate.getByRole('group', { name: /着色|Colour by/ }).getByRole('button', { name: '处理' }).click();
    assert.match(await plate.locator('.ln-plate-layout-legend').innerText(), /Mock/);
    await plate.getByRole('button', { name: '复制这块板' }).click();
    await page.waitForFunction(() => document.querySelector('.ln-plate-editor header input')?.value.endsWith('副本'));
    await page.locator('.ln-plate-editor-message').waitFor();
    await plate.getByRole('button', { name: '完成', exact: true }).click();
    assert.equal(await page.locator('.ln-document-plate').count(), 2, 'both plates are in the record');
    assert.match(await page.locator('.ln-document-plate').first().locator('[data-well="A1"]').innerText(), /Mock/);

    // Way out of the blocked save, then a real save.
    await bar.getByRole('button', { name: '自行记录' }).click();
    assert.equal(await save.isDisabled(), false, 'writing own steps turns Save on');
    assert.doesNotMatch(await bar.innerText(), /还不能保存/);
    await page.getByRole('textbox', { name: '实验标题' }).fill(`Section check ${width}`);
    await save.click();
    await page.waitForURL(url => /\/experiments\/[^/]+$/.test(url.pathname) && !url.pathname.endsWith('/new'));
    assert.match(await page.locator('body').innerText(), /Cells A/);
    await page.screenshot({ path: `${out}/saved-${width}.png`, fullPage: true });
    assert.deepEqual(errors, [], 'no page errors');
    report.push({ width, height, ...measured });
    await context.close();
  }
  console.log(JSON.stringify({ passed: true, report }, null, 1));
} finally {
  await browser.close();
}
