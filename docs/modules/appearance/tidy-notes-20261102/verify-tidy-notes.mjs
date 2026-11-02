// Q319–Q330 on the 3004 test copy (labnest_tidy_20261102), Chinese, 1440 px and 390 px. Read-only: every request other
// than GET/HEAD/OPTIONS is aborted and reported; opening the deviation box and the writing rules sends nothing.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const base = process.env.LABNEST_BASE_URL ?? 'http://127.0.0.1:3004';
const out = new URL('./evidence/', import.meta.url);
await mkdir(out, { recursive: true });
const ids = { emptyExp: 'cmuxftwkn000eleoe5k1q2udf', run: 'cmvtb3dd1000d6cplxvnb0ehy', protocol: 'cmvta9lim00046cplglcsvmfs', result: 'cmtgkvdy40000eun1mixqxfgj', attachment: 'cmskh2iai00070dos51w2yr1g' };
const checks = [], errors = [], mutations = [];
const browser = await chromium.launch();
const open = async (width) => {
  const phone = width < 500;
  const context = await browser.newContext({ viewport: { width, height: phone ? 844 : 1000 }, isMobile: phone, hasTouch: phone });
  await context.addCookies([{ name: 'labnest_locale', value: 'zh', url: base }]);
  await context.route('**/*', route => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) return route.continue();
    mutations.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`); return route.abort();
  });
  const page = await context.newPage(); page.setDefaultTimeout(30000);
  page.on('pageerror', failure => errors.push(`${width} ${failure.message}`));
  return { context, page };
};
const go = (page, path) => page.goto(base + path, { waitUntil: 'networkidle' });
const shot = (page, name, locator) => (locator ?? page).screenshot({ path: new URL(`${name}.png`, out).pathname });
const text = page => page.locator('main').first().innerText();
const noScroll = page => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);

try {
  const { context, page } = await open(1440);

  // Q319: the samples panel uses the interface font; an empty panel says so once, quietly.
  await go(page, `/experiments/${ids.emptyExp}`);
  const panel = page.locator('.ln-experiment-samples');
  const note = panel.locator('p', { hasText: '还没有选择样本' });
  const style = await note.evaluate(element => ({ size: getComputedStyle(element).fontSize, family: getComputedStyle(element).fontFamily, body: getComputedStyle(element.closest('.document-a4-paper')).fontSize }));
  assert.equal(style.size, '12px', `samples note size ${style.size}`);
  assert(!/Times|Serif|Song/i.test(style.family.split(',')[0]), `samples note font ${style.family}`);
  const panelText = await panel.innerText();
  assert(!panelText.includes('使用的样本 0') && !panelText.includes('可以从样本清单中选择'), panelText);
  await panel.scrollIntoViewIfNeeded(); await shot(page, 'q319-samples-empty-1440', panel);
  checks.push(`Q319 samples panel: ${style.size} interface font (record body ${style.body}); one line when empty`);

  // Q320 and Q328: protocol view.
  await go(page, `/protocols/${ids.protocol}`);
  const visibleReasons = await page.locator('.ln-chip-reason:visible', { hasText: '待选采用值' }).count();
  assert.equal(visibleReasons, 0, 'no visible 待选采用值');
  assert(await page.locator('.ln-chip[data-state="pending"] .sr-only', { hasText: '待选采用值' }).count() > 0, 'reason kept for screen readers');
  const protocolText = await text(page);
  assert(!protocolText.includes('ai recognized'), 'source label translated');
  assert(protocolText.includes('AI 识别'), 'AI 识别 shown');
  for (const english of ['Protocol Recognition Saved', 'protocol recognition saved', 'Update\n']) assert(!protocolText.includes(english), `activity ${english}`);
  assert.equal(await page.locator('p:visible', { hasText: '左右滑动查看完整表格' }).count(), 0, 'scroll hint hidden when the table fits');
  await shot(page, 'q320-q328-protocol-1440');
  checks.push('Q320 range chips without 待选采用值; Q328 source 和活动名为中文, no scroll hint on a fitting table');

  // Q321: run list view.
  await go(page, `/experiments/${ids.run}/run`);
  const runText = await text(page);
  assert(!runText.includes('Check planned execution steps'), 'header note removed');
  const firstRow = page.locator('[data-step-tools]').first();
  const tops = await firstRow.locator(':scope > button, :scope > a').evaluateAll(items => items.map(item => { const box = item.getBoundingClientRect(); return Math.round(box.top + box.height / 2); }));
  assert(tops.length >= 3 && Math.max(...tops) - Math.min(...tops) < 4, `tools on one row ${tops}`);
  const boxes = await page.locator('textarea[name^="deviation:"]').count();
  const toggles = page.getByRole('button', { name: '记录偏差…' });
  assert((await toggles.count()) > 0, 'deviation toggles shown');
  await toggles.first().click();
  assert.equal(await page.locator('textarea[name^="deviation:"]').count(), boxes + 1, 'toggle opens one box');
  assert(await page.evaluate(() => document.activeElement?.tagName === 'TEXTAREA'), 'box takes focus');
  await page.locator('[data-step-tools]').nth(1).scrollIntoViewIfNeeded(); await shot(page, 'q321-run-list-1440');
  checks.push(`Q321 run list: ${tops.length} tools on one row; ${boxes} deviation boxes open by default, toggle opens one`);

  // Q322: tools page.
  await go(page, '/tools');
  const toolsText = await text(page);
  for (const gone of ['Planning, calculation', 'External applications', 'Input', 'Output', 'sample list, one or more']) assert(!toolsText.includes(gone), `tools still shows ${gone}`);
  assert(toolsText.includes('规划多块板的实验'), 'Free Plate description translated');
  await shot(page, 'q322-tools-1440');
  checks.push('Q322 tools: no tagline, footer or Input/Output lines; descriptions in Chinese');

  // Q323 and Q330: result files.
  await go(page, `/results/${ids.result}`);
  const files = page.locator('#result-files').locator('xpath=..');
  const filesText = await files.innerText();
  for (const gone of ['Where instrument exports go', 'Structured rows', 'Unmodified instrument output', 'Table data', 'No original']) assert(!filesText.includes(gone), `result files still shows ${gone}`);
  assert(filesText.includes('表格数据') && filesText.includes('原始与支持文件'), 'headings translated');
  assert.equal(await files.locator('input[type=file]:not(.sr-only)').count(), 0, 'no native file box');
  await files.scrollIntoViewIfNeeded(); await shot(page, 'q323-result-files-1440', files);
  checks.push('Q323/Q330 result files: notes removed, headings in Chinese, FilePicker');

  // Q330 also: the experiment side panel's attachment box.
  await go(page, `/experiments/${ids.run}`);
  assert.equal(await page.locator('input[type=file]:not(.sr-only)').count(), 0, 'experiment attachments use FilePicker');
  checks.push('Q330 experiment attachments: FilePicker');

  // Q324: trash.
  await go(page, '/trash');
  const trashText = await text(page);
  assert(trashText.includes('恢复后保留原编号和关联') && !trashText.includes('Restoring keeps'), 'trash intro');
  const restoreFilled = await page.getByRole('button', { name: '恢复' }).first().evaluate(element => getComputedStyle(element).backgroundColor);
  const action = await page.evaluate(() => { const probe = document.createElement('span'); probe.style.color = 'var(--action)'; document.body.append(probe); const color = getComputedStyle(probe).color; probe.remove(); return color; });
  assert.notEqual(restoreFilled, action, 'restore is not filled');
  await shot(page, 'q324-trash-1440');
  checks.push('Q324 trash: one-line Chinese intro; quiet row actions');

  // Q325: imports.
  await go(page, '/protocols/import');
  let importText = await text(page);
  assert(!importText.includes('SHA-256') && !importText.includes('结构化实验规程导入') && !importText.includes('一步一段'), 'protocol import notes');
  await page.getByText('写法说明').click();
  assert((await text(page)).includes('一步一段'), 'writing rules open');
  await shot(page, 'q325-protocol-import-1440');
  await go(page, '/inventory/import');
  importText = await text(page);
  assert(!importText.includes('SHA-256'), 'inventory import SHA note');
  checks.push('Q325 imports: no SHA-256 or template card lines; writing rules folded');

  // Q326: AI settings and method design.
  await go(page, '/ai');
  const aiText = await text(page);
  assert(!aiText.includes('与原设置范围一致'), 'workspace scope note');
  assert.equal(aiText.split('处理历史记录').length - 1, 1, 'past-records note once');
  await go(page, '/protocols/design');
  const designText = await text(page);
  assert(!designText.includes('记入活动日志') && !/方法卡由[^；]*@/.test(designText), 'design notes');
  checks.push('Q326 AI settings: one past-records note; method design: no email, no activity-log note');

  // Q327: settings.
  await go(page, '/settings');
  const settingsText = await text(page);
  assert(!settingsText.includes('不会再沿用宋体') && !settingsText.includes('即时应用于整个系统'), 'settings duplicates');
  assert.equal(settingsText.split('科研图表').length - 1, 1, 'chart palette note once');
  checks.push('Q327 settings: no repeated or history notes');

  // Q329: attachment page.
  await go(page, `/attachments/${ids.attachment}`);
  const attachmentText = await text(page);
  assert(!attachmentText.includes(' / Download') && !attachmentText.includes('Display resizing'), 'one language');
  checks.push('Q329 attachment page: one language');
  await context.close();

  // Phone.
  const phone = await open(390);
  for (const [path, name] of [[`/experiments/${ids.emptyExp}`, 'q319-experiment-390'], ['/tools', 'q322-tools-390'], ['/trash', 'q324-trash-390'], [`/results/${ids.result}`, 'q323-result-390']]) {
    await go(phone.page, path);
    assert(await noScroll(phone.page), `${path}: no horizontal scroll`);
    if (name.startsWith('q319')) await phone.page.locator('.ln-experiment-samples').scrollIntoViewIfNeeded();
    await shot(phone.page, name);
  }
  checks.push('390: experiment, tools, trash, result without horizontal scroll');
  await phone.context.close();
} finally { await browser.close(); }
const report = { base, passed: errors.length === 0 && mutations.length === 0, checks, errors, mutations };
await writeFile(new URL('report.json', out), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 1));
if (!report.passed) process.exit(1);
