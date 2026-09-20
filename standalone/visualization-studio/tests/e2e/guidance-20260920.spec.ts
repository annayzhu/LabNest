import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('guidance reclaims usable parameters, preserves export and keyboard focus', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop-chromium', 'Desktop bounded-column geometry');
  await page.goto('/', { waitUntil: 'networkidle' });
  const button = page.getByRole('button', { name: '展开图形定义与适用场景' });
  const body = page.locator('[data-visualization-parameter-scroll]');
  const downloadConfig = async () => {
    const event = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Config', exact: true }).click();
    const value = JSON.parse(await readFile((await (await event).path())!, 'utf8'));
    delete value.generatedAt;
    return value;
  };
  const before = await downloadConfig();
  await expect(button).toHaveAttribute('aria-expanded', 'false');
  const collapsedHeight = await body.evaluate(el => el.clientHeight);
  await button.focus(); await page.keyboard.press('Enter');
  const close = page.getByRole('button', { name: '收起图形定义与适用场景' });
  await expect(close).toBeFocused();
  await expect.poll(() => body.evaluate(el => el.clientHeight)).toBeLessThan(collapsedHeight - 80);
  await page.locator('[data-plot-origin] summary').click();
  await page.locator('[data-plot-references] summary').click();
  const last = page.locator('[data-plot-references] a').last();
  await last.scrollIntoViewIfNeeded(); await expect(last).toBeInViewport();
  expect(await downloadConfig()).toEqual(before);
  await page.getByRole('button', { name: /^Scatter / }).click();
  await expect(close).toHaveAttribute('aria-expanded', 'true');
  await close.focus(); await page.keyboard.press('Space'); await expect(button).toBeFocused();
  const width = page.getByRole('textbox', { name: 'Width value', exact: true });
  await width.fill('460'); await width.press('Enter');
  await expect(page.locator('svg[aria-label$="scientific figure preview"]')).toHaveAttribute('width', '460');
  await width.fill('600'); await width.press('Escape'); await expect(width).toHaveValue('460');
});

test('all guidance remains reachable on short and narrow screens', async ({ page }, info) => {
  const viewports = info.project.name === 'desktop-chromium' ? [{width:1440,height:560},{width:1024,height:768}] : [{width:390,height:844}];
  for (const viewport of viewports) {
    await page.setViewportSize(viewport); await page.goto('/', {waitUntil:'networkidle'});
    await page.getByRole('button', {name:'展开图形定义与适用场景'}).click();
    await page.locator('[data-plot-origin] summary').click(); await page.locator('[data-plot-references] summary').click();
    const last=page.locator('[data-plot-references] a').last(); await last.scrollIntoViewIfNeeded(); await expect(last).toBeInViewport();
    const control=page.locator('[data-visualization-parameter-scroll] input').last();await control.scrollIntoViewIfNeeded();await expect(control).toBeInViewport();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1)).toBe(true);
  }
});

test('saved explicit legacy palette colors survive preset redesign and reload', async ({page}) => {
  const legacy={id:'legacy-palette',name:'Saved 2026-09-04',sourceThemeId:'cn-wisteria',categoricalColors:['#F1E7E5','#1D4C50','#D3A488','#BDAEAD'],continuousLow:'#F1E7E5',continuousHigh:'#1D4C50',divergingLow:'#1D4C50',divergingMid:'#FCF9F8',divergingHigh:'#D3A488',barBorderColor:'#1D4C50',createdAt:'2026-09-04',updatedAt:'2026-09-04'};
  await page.addInitScript(palette => {
    localStorage.setItem('labnest:visualization-studio:custom-palettes',JSON.stringify([palette]));
    localStorage.setItem('labnest:visualization-studio:palette',JSON.stringify({seriesId:'custom',themeId:palette.sourceThemeId,customPaletteId:palette.id}));
  },legacy);
  await page.goto('/',{waitUntil:'networkidle'});
  const marks=page.locator("svg [data-plot-element='bar']");
  await expect.poll(()=>marks.evaluateAll(els=>els.slice(0,4).map(el=>el.getAttribute('fill')))).toEqual(legacy.categoricalColors);
  await page.reload({waitUntil:'networkidle'});
  await expect.poll(()=>marks.evaluateAll(els=>els.slice(0,4).map(el=>el.getAttribute('fill')))).toEqual(legacy.categoricalColors);
});
