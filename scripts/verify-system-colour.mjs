// Light purple default, the old saved default, and plate planners following the system style (Q477–Q485).
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const base = process.env.BASE_URL ?? 'http://localhost:3002';
const record = process.env.RECORD_PATH ?? '/experiments/syn-dr-2';
const evidence = path.resolve(process.env.EVIDENCE_DIR ?? '.local-runtime/plate-drag-copy-20261116/evidence/colour');
await mkdir(evidence, { recursive: true });
const report = {};
const browser = await chromium.launch();

async function newContext(width = 1440, height = 900, extra = {}) {
  const context = await browser.newContext({ viewport: { width, height }, ...extra });
  await context.addCookies([{ name: 'labnest_locale', value: 'zh', url: base }]);
  return context;
}
const rootVar = (page, name) => page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);

// 1. A device that never chose a style opens in light purple and shares it with tools.
{
  const context = await newContext();
  const page = await context.newPage();
  await page.goto(`${base}${record}`);
  await page.waitForFunction(() => document.documentElement.dataset.labnestTheme === 'lilac-mist');
  report.freshDevice = { theme: await page.evaluate(() => document.documentElement.dataset.labnestTheme), moss: await rootVar(page, '--moss') };
  assert.equal(report.freshDevice.moss, '#6a55a8');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('labnest.tool-theme.v1') || 'null')?.themeId === 'lilac-mist');
  for (const [width, height] of [[1366, 768], [1440, 900], [1920, 1080]]) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(evidence, `record-lilac-${width}.png`) });
  }

  // 2. Free planner (static page) follows the style: buttons and plate tray.
  const free = await context.newPage();
  await free.setViewportSize({ width: 1440, height: 900 });
  await free.goto(`${base}/tools/free-plate-layout/index.html`);
  await free.locator('.plate-option[data-size="96"]').click();
  const well = (id) => free.locator(`[data-well="${id}"]`);
  for (const [from, to, value] of [['A1', 'B3', '对照'], ['A4', 'B6', '药物 A'], ['C1', 'D3', '药物 B']]) {
    await free.keyboard.press('Escape');
    const a = await well(from).boundingBox(); const b = await well(to).boundingBox();
    await free.mouse.move(a.x + 4, a.y + 4); await free.mouse.down(); await free.mouse.move(b.x + 6, b.y + 6, { steps: 5 }); await free.mouse.up();
    await free.locator('.parameter-input-row').filter({ hasText: '处理' }).locator('.parameter-value').fill(value);
    await free.locator('#applyParametersButton').click();
  }
  await free.keyboard.press('Escape');
  report.free = await free.evaluate(() => ({
    pine: getComputedStyle(document.documentElement).getPropertyValue('--pine').trim(),
    tray: getComputedStyle(document.querySelector('.plate-grid')).backgroundImage,
    emptyWell: getComputedStyle(document.querySelector('[data-well="H12"]')).backgroundColor,
    overflowX: document.documentElement.scrollWidth > innerWidth + 1,
  }));
  assert.equal(report.free.pine, '#6a55a8');
  assert.match(report.free.tray, /rgb\(240, 236, 248\).*rgb\(229, 222, 243\)/);
  assert.equal(report.free.emptyWell, 'rgb(252, 251, 254)');
  for (const [width, height] of [[1366, 768], [1440, 900], [1920, 1080]]) {
    await free.setViewportSize({ width, height });
    await free.waitForTimeout(400);
    await free.screenshot({ path: path.join(evidence, `free-lilac-${width}.png`) });
  }

  // 3. qPCR planner (inside the LabNest page) follows it too.
  const qpcr = await context.newPage();
  await qpcr.setViewportSize({ width: 1440, height: 900 });
  await qpcr.goto(`${base}/tools/qpcr-plate-layout`);
  const frame = qpcr.frameLocator('iframe').first();
  await frame.getByRole('button', { name: '载入示例', exact: true }).click();
  await frame.getByRole('button', { name: '生成布局', exact: true }).click();
  await frame.locator('button[data-well-id="A1"]').waitFor();
  await frame.locator('button[data-well-id="H1"]').click();
  await frame.locator('button[data-well-id="H12"]').click({ modifiers: ['Shift'] });
  await frame.getByRole('button', { name: '清空孔', exact: true }).click();
  report.qpcr = await frame.locator('body').evaluate((body) => ({
    action: getComputedStyle(body.ownerDocument.documentElement).getPropertyValue('--action').trim(),
    tray: getComputedStyle(body.querySelector('.plate-grid')).backgroundImage,
    emptyWell: getComputedStyle(body.querySelector('.well-empty')).backgroundColor,
  }));
  assert.equal(report.qpcr.action, '#6a55a8');
  assert.match(report.qpcr.tray, /rgb\(240, 236, 248\).*rgb\(229, 222, 243\)/);
  for (const [width, height] of [[1366, 768], [1440, 900], [1920, 1080]]) {
    await qpcr.setViewportSize({ width, height });
    await qpcr.waitForTimeout(400);
    await qpcr.screenshot({ path: path.join(evidence, `qpcr-lilac-${width}.png`) });
  }

  // 4. Picking 晴空浅蓝 in settings updates an open tool without reloading it.
  await page.setViewportSize({ width: 1440, height: 900 });
  // Simulate a slow device: saved preferences load late (they wait for an animation frame).
  await context.addInitScript(() => {
    if (location.pathname !== '/settings') return;
    const frame = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) => setTimeout(() => frame(callback), 3000);
  });
  await page.goto(`${base}/settings`);
  // Pick as soon as the picker responds, before saved preferences have loaded (this page is in the
  // background, so the provider's animation-frame load has not run): the pick must not be lost.
  await page.waitForFunction(() => { const option = document.querySelector('.system-theme-option'); return option && Object.keys(option).some((key) => key.startsWith('__reactFiber')); });
  await page.locator('.system-theme-option:has(input[value="sky-mist"])').click();
  await page.waitForFunction(() => document.documentElement.dataset.labnestTheme === 'sky-mist');
  await page.bringToFront();
  await page.waitForTimeout(3500);
  report.earlyPick = { theme: await page.evaluate(() => document.documentElement.dataset.labnestTheme), saved: await page.evaluate(() => JSON.parse(localStorage.getItem('labnest.appearance')).colorSchemeId), warning: await page.getByText('本次更改暂未保存').count() };
  assert.deepEqual(report.earlyPick, { theme: 'sky-mist', saved: 'sky-mist', warning: 0 });
  await page.screenshot({ path: path.join(evidence, 'settings-sky.png') });
  await free.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--pine').trim() === '#2a66a8');
  await frame.locator('body').evaluate(() => new Promise((resolve) => { const check = () => getComputedStyle(document.documentElement).getPropertyValue('--action').trim() === '#2a66a8' ? resolve() : setTimeout(check, 50); check(); }));
  await free.screenshot({ path: path.join(evidence, 'free-sky-1440.png') });
  await qpcr.setViewportSize({ width: 1440, height: 900 });
  await qpcr.screenshot({ path: path.join(evidence, 'qpcr-sky-1440.png') });
  report.liveSwitch = { chosen: await page.evaluate(() => localStorage.getItem('labnest.system-theme-chosen')) };
  assert.equal(report.liveSwitch.chosen, '1');
  // Back to purple so later screenshots show the default.
  await page.locator('.system-theme-option:has(input[value="lilac-mist"])').click();
  await context.close();
}

// 5. A device that only has the old automatic default saved switches; a recorded pick is kept.
for (const [label, chosen, expected] of [['auto-saved moon-dai', false, 'lilac-mist'], ['picked moon-dai', true, 'moon-dai']]) {
  const context = await newContext();
  const page = await context.newPage();
  await page.goto(`${base}/`);
  await page.waitForFunction(() => localStorage.getItem('labnest.appearance'));
  await page.evaluate((isChosen) => {
    localStorage.setItem('labnest.appearance', JSON.stringify({ schemaVersion: 1, mode: 'system', colorSchemeId: 'moon-dai', uiFontId: 'system-sans', dataFontId: 'mono', uiScaleId: JSON.parse(localStorage.getItem('labnest.appearance')).uiScaleId, iconPackId: 'lab-soft', densityId: 'standard' }));
    if (isChosen) localStorage.setItem('labnest.system-theme-chosen', '1'); else localStorage.removeItem('labnest.system-theme-chosen');
  }, chosen);
  await page.goto(`${base}${record}`);
  await page.waitForTimeout(500);
  report[label] = await page.evaluate(() => document.documentElement.dataset.labnestTheme);
  assert.equal(report[label], expected, label);
  await context.close();
}

// 6. Dark mode keeps a light-purple style readable.
{
  const context = await newContext(1440, 900, { colorScheme: 'dark' });
  const page = await context.newPage();
  await page.goto(`${base}${record}`);
  await page.waitForFunction(() => document.documentElement.dataset.labnestMode === 'dark');
  report.dark = { moss: await rootVar(page, '--moss'), paper: await rootVar(page, '--paper') };
  await page.screenshot({ path: path.join(evidence, 'record-lilac-dark-1440.png') });
  await context.close();
}

// 7. Opened outside LabNest (nothing shared), the tool keeps its own colours.
{
  const context = await newContext();
  const page = await context.newPage();
  await page.goto(`${base}/tools/free-plate-layout/index.html`);
  await page.evaluate(() => localStorage.removeItem('labnest.tool-theme.v1'));
  await page.reload();
  report.standalone = { pine: await rootVar(page, '--pine'), trayA: await rootVar(page, '--plate-tray-a') };
  assert.equal(report.standalone.pine, '#3f625d');
  await context.close();
}

await writeFile(path.join(evidence, 'report.json'), JSON.stringify(report, null, 2) + '\n');
await browser.close();
console.log(JSON.stringify(report, null, 2));
