import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.env.LABNEST_E2E_BASE_URL ?? "http://127.0.0.1:3010";
const output = process.env.LABNEST_LAYOUT_OUTPUT ?? ".local-runtime/collections-20261104/layout-final";
await mkdir(output, { recursive: true });
const f = JSON.parse(await readFile(".local-runtime/collections-20261104/fixtures.json", "utf8"));
const routes = ["/", "/projects?q=500", "/projects?q=NoSyntheticMatch", "/projects/new", `/projects/${f.projectId}`, `/projects/${f.projectId}/edit`, "/projects/import", "/research-plans", "/research-plans/new", `/research-plans/${f.planId}`, `/research-plans/${f.planId}/edit`, "/research-plans/import", "/protocols", "/protocols/new", `/protocols/${f.protocolId}`, `/protocols/${f.protocolId}/versions/${f.versionId}/edit`, "/protocols/import", "/experiments", "/experiments/new", `/experiments/new?protocolVersionId=${f.versionId}`, `/experiments/${f.experimentId}`, `/experiments/${f.experimentId}/edit`, `/experiments/${f.experimentId}/run`, "/experiments/import", "/results", "/results/new", `/results/${f.resultId}`, `/results/${f.resultId}/edit`, "/results/import", `/results/${f.lockedResultId}`, "/reports", "/reports/new", `/reports/${f.reportId}`, `/reports/${f.reportId}/edit`, "/reports/import", "/entries", "/entries/new", `/entries/${f.entryId}`, `/entries/${f.entryId}/edit`, "/inventory", "/inventory/new", `/inventory/${f.inventoryId}`, `/inventory/${f.inventoryId}/edit`, "/inventory/import", "/samples", "/samples/new", `/samples/${f.sampleId}`, `/samples/${f.sampleId}/edit`, "/tools", "/tools/calculator", "/tools/plasmid", "/settings", "/purchases/import"];
const responsive = ["/projects?q=500", "/projects/import", "/research-plans", "/protocols/import", `/protocols/${f.protocolId}`, `/protocols/${f.protocolId}/versions/${f.versionId}/edit`, `/experiments/new?protocolVersionId=${f.versionId}`, "/experiments", "/results", "/inventory/import", "/samples", "/tools", "/settings"];
const allSizes = [{ width: 1366, height: 768 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }, { width: 820, height: 1180 }, { width: 1180, height: 820 }, { width: 390, height: 844 }];
const sizes = process.env.LABNEST_LAYOUT_WIDTHS ? allSizes.filter(size => process.env.LABNEST_LAYOUT_WIDTHS.split(",").includes(String(size.width))) : allSizes;
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
await context.addCookies([{ name: "labnest_locale", value: "zh", url: base }]);
const page = await context.newPage();
page.setDefaultTimeout(30000);
const metrics = [], errors = [];
page.on("pageerror", error => errors.push({ route: page.url(), message: error.message.slice(0, 500) }));
try {
  for (const size of sizes) {
    await page.setViewportSize(size);
    const list = size.width >= 1366 ? routes : responsive;
    for (const route of list) {
      const response = await page.goto(`${base}${route}`, { waitUntil: "networkidle", timeout: 120000 });
      const number = routes.indexOf(route);
      const file = `${output}/${size.width}-${number}.png`;
      const data = await page.evaluate(() => {
        const main = document.querySelector("main");
        const rect = node => { const r = node.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) }; };
        const small = [...(main?.querySelectorAll("*") ?? [])].filter(node => node.getClientRects().length && node.children.length === 0 && node.textContent?.trim() && !node.closest("svg, [popover], script, style") && parseFloat(getComputedStyle(node).fontSize) < 11.99).map(node => ({ tag: node.tagName, class: String(node.className).slice(0, 160), text: node.textContent.slice(0, 60), size: parseFloat(getComputedStyle(node).fontSize) }));
        const systems = [...document.querySelectorAll(".ln-systems-row")].slice(0, 8).map(row => ({ row: rect(row), label: rect(row.querySelector(".ln-systems-dimension")), options: rect(row.querySelector(".ln-systems-options")), edit: row.querySelector(".ln-systems-icon") ? rect(row.querySelector(".ln-systems-icon")) : null }));
        return { viewport: { width: innerWidth, height: innerHeight }, pageWidth: document.documentElement.scrollWidth, scale: visualViewport?.scale, main: main ? rect(main) : null, smallText: small.slice(0, 20), minFont: Math.min(...[...(main?.querySelectorAll("*") ?? [])].filter(node => node.getClientRects().length && node.textContent?.trim() && !node.closest("svg, script, style")).map(node => parseFloat(getComputedStyle(node).fontSize)).filter(Boolean)), horizontalRegions: [...(main?.querySelectorAll("*") ?? [])].filter(node => node.clientWidth && node.scrollWidth > node.clientWidth + 2 && ["auto", "scroll"].includes(getComputedStyle(node).overflowX)).map(node => ({ class: String(node.className).slice(0, 120), ...rect(node), scrollWidth: node.scrollWidth })).slice(0, 5), systems };
      });
      await page.screenshot({ path: file, animations: "disabled" });
      metrics.push({ route, status: response?.status(), size, file, ...data });
      console.log(`${size.width} ${route}: ${response?.status()} width ${data.pageWidth}/${size.width}, min ${data.minFont}px`);
    }
    // Real selection drawer with long names at each viewport.
    await page.goto(`${base}/projects`, { waitUntil: "networkidle" });
    const selected = page.locator(`input.selection-checkbox[value="${f.projectId}"]`);
    await selected.scrollIntoViewIfNeeded();
    // Font/Chinese-label hydration can reflow a long table after networkidle. Wait for its real position.
    await page.evaluate(async id => {
      await document.fonts.ready;
      let last = "", stable = 0;
      for (let frame = 0; frame < 120 && stable < 20; frame++) {
        await new Promise(resolve => requestAnimationFrame(resolve));
        const node = document.querySelector(`input.selection-checkbox[value="${id}"]`);
        const rect = node.getBoundingClientRect(); const next = `${rect.x}:${rect.y}:${rect.width}:${rect.height}`;
        stable = next === last ? stable + 1 : 0; last = next;
      }
    }, f.projectId);
    await selected.check();
    await page.getByRole("button", { name: "修改…", exact: true }).click();
    await page.locator("dialog .ln-bulk-title-list textarea").waitFor();
    const dimensions = await page.locator("dialog").evaluate(node => ({ width: node.clientWidth, height: node.clientHeight, bodyHeight: node.querySelector(".ln-bulk-body").clientHeight, bodyScrollHeight: node.querySelector(".ln-bulk-body").scrollHeight, scrollWidth: node.scrollWidth, minFont: Math.min(...[...node.querySelectorAll("*")].filter(el => el.getClientRects().length && el.textContent?.trim()).map(el => parseFloat(getComputedStyle(el).fontSize)).filter(Boolean)) }));
    await page.screenshot({ path: `${output}/drawer-${size.width}.png` });
    metrics.push({ route: "batch-drawer", size, ...dimensions });
    await page.getByRole("button", { name: "取消", exact: true }).click();
  }
} finally {
  await writeFile(`${output}/metrics.json`, JSON.stringify({ base, metrics, errors }, null, 2));
  await browser.close();
}
assert(metrics.every(row => !row.status || row.status < 400), "All audited routes load");
assert(metrics.every(row => !row.pageWidth || row.pageWidth <= row.size.width + 1), "No page-level horizontal overflow");
assert.deepEqual(errors, [], "No browser page errors");
