import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl = process.env.LABNEST_E2E_BASE_URL ?? "http://127.0.0.1:3202";
const outputDir = process.env.LABNEST_E2E_SCREENSHOT_DIR;
const viewports = [
  { name: "desktop", width: 1440, height: 900, outline: true, zoom: true },
  { name: "compact-desktop", width: 1100, height: 820, outline: false, zoom: true },
  { name: "tablet", width: 820, height: 900, outline: false, zoom: true },
  { name: "mobile", width: 390, height: 844, outline: false, zoom: false },
];

if (outputDir) await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: viewports[0] });
await page.goto(`${baseUrl}/experiments/new`, { waitUntil: "networkidle" });

const results = [];
for (const viewport of viewports) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.waitForTimeout(180);
  const metrics = await page.evaluate(() => {
    const rect = (selector) => document.querySelector(selector)?.getBoundingClientRect();
    const visible = (selector) => {
      const element = document.querySelector(selector);
      return Boolean(element && getComputedStyle(element).display !== "none" && element.getBoundingClientRect().height > 0);
    };
    const panel = rect(".document-editor-document-panel");
    const stage = rect(".document-editor-document-stage");
    const toolbar = rect(".standalone-document-editor-toolbar");
    const fitLabel = document.querySelector(".document-editor-zoom button span");
    const save = rect(".document-editor-save-bar");
    const mobileNav = rect('nav[aria-label="Mobile navigation"]');
    const toolbarControls = [...document.querySelectorAll(".standalone-document-editor-toolbar button, .standalone-document-editor-toolbar input")]
      .filter((element) => getComputedStyle(element).display !== "none")
      .map((element) => ({ label: element.getAttribute("aria-label") || element.textContent?.trim() || element.tagName, ...element.getBoundingClientRect().toJSON() }));
    return {
      viewportWidth: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
      outlineVisible: visible(".document-editor-outline"),
      mobileNavVisible: visible('nav[aria-label="Mobile navigation"]'),
      panel: panel?.toJSON(),
      stage: stage?.toJSON(),
      toolbar: toolbar?.toJSON(),
      toolbarControls,
      fitLabelLines: fitLabel?.getClientRects().length ?? 0,
      save: save?.toJSON(),
      mobileNav: mobileNav?.toJSON(),
    };
  });

  assert.equal(metrics.documentWidth, metrics.viewportWidth, `${viewport.name}: page has horizontal overflow (${metrics.documentWidth}px > ${metrics.viewportWidth}px).`);
  assert.equal(metrics.outlineVisible, viewport.outline, `${viewport.name}: Outline visibility does not preserve document space.`);
  assert(metrics.panel && metrics.stage && metrics.toolbar, `${viewport.name}: document workbench is incomplete.`);
  assert(metrics.stage.right <= metrics.panel.right + 1, `${viewport.name}: A4 stage is clipped by the document panel.`);
  assert(metrics.toolbar.right <= metrics.viewportWidth + 1, `${viewport.name}: toolbar extends beyond the viewport.`);
  assert(metrics.toolbarControls.every((control) => control.left >= -1 && control.right <= metrics.viewportWidth + 1), `${viewport.name}: a toolbar control is clipped.`);
  const visibleToolbarControls = metrics.toolbarControls.filter((control) => control.width > 0 && control.height > 0);
  for (let leftIndex = 0; leftIndex < visibleToolbarControls.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < visibleToolbarControls.length; rightIndex += 1) {
      const left = visibleToolbarControls[leftIndex];
      const right = visibleToolbarControls[rightIndex];
      const overlaps = left.left < right.right - 1
        && left.right > right.left + 1
        && left.top < right.bottom - 1
        && left.bottom > right.top + 1;
      assert(!overlaps, `${viewport.name}: toolbar controls overlap (${left.label} / ${right.label}).`);
    }
  }
  assert.equal(metrics.fitLabelLines, viewport.zoom ? 1 : 0, `${viewport.name}: responsive zoom controls have the wrong visibility.`);
  if (metrics.mobileNavVisible) {
    assert(metrics.save && metrics.mobileNav, `${viewport.name}: save action or mobile navigation is missing.`);
    assert(metrics.save.bottom <= metrics.mobileNav.top - 4, `${viewport.name}: Save Experiment overlaps the mobile navigation.`);
  }
  if (outputDir) await page.screenshot({ path: `${outputDir}/${viewport.name}.png`, fullPage: false });
  results.push({ viewport: viewport.name, ...metrics });
}

await browser.close();
console.log(JSON.stringify(results.map(({ viewport, viewportWidth, documentWidth, outlineVisible, mobileNavVisible, panel, stage, toolbar, save, mobileNav }) => ({
  viewport,
  viewportWidth,
  pageOverflow: documentWidth - viewportWidth,
  outlineVisible,
  mobileNavVisible,
  panelWidth: Math.round(panel.width),
  stageWidth: Math.round(stage.width),
  toolbarHeight: Math.round(toolbar.height),
  saveGapAboveNavigation: mobileNavVisible ? Math.round(mobileNav.top - save.bottom) : null,
})), null, 2));
