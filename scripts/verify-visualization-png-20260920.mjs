import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const base = process.env.BASE_URL || 'http://localhost:32121/tools/visualization';
const directory = 'docs/visualization/20260920/evidence/png';
const names = ['柴染棕','橙绯红','淡藤萝紫','瓜瓤粉','蓝墨茶','棉絮灰','珊瑚朱','杏叶黄','中国红'];
await mkdir(directory, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const reports = [];
try {
  await page.goto(base, { waitUntil: 'networkidle' });
  for (const [index, name] of names.entries()) {
    await page.getByRole('button', { name, exact: true }).click();
    const event = page.waitForEvent('download');
    await page.getByRole('button', { name: 'PNG', exact: true }).click();
    const data = await readFile(await (await event).path());
    await writeFile(`${directory}/${index}.png`, data);
    const metadata = await sharp(data).metadata();
    const stats = await sharp(data).stats();
    assert.equal(metadata.width, 2125, '340 px at 600 dpi');
    assert.equal(metadata.height, 2125, '340 px at 600 dpi');
    assert(stats.channels[0].stdev > 10, 'Export must not be blank');
    reports.push({ name, width: metadata.width, height: metadata.height, bytes: data.length, stdev: stats.channels[0].stdev });
  }
  await writeFile(`${directory}/report.json`, JSON.stringify(reports, null, 2));
} finally {
  await browser.close();
}
