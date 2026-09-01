import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.env.LABNEST_E2E_BASE_URL ?? "http://127.0.0.1:3219";
const documentAreas = ["entries", "research-plans", "protocols", "experiments", "results", "reports"];

async function findEditorRoute(page, area) {
  await page.goto(`${baseUrl}/${area}`, { waitUntil: "domcontentloaded" });
  const detailHrefs = await page.locator(`a[href^="/${area}/"]`).evaluateAll((links, currentArea) => links
    .map((link) => link.getAttribute("href"))
    .filter((href) => href && new RegExp(`^/${currentArea}/[^/]+$`).test(href))
    .filter((href) => !["new", "import", "export"].includes(href.split("/").at(-1))), area);
  const detailHref = detailHrefs[0];
  if (!detailHref) return area === "reports" ? null : `/${area}/new`;

  if (area === "protocols") {
    await page.goto(`${baseUrl}${detailHref}`, { waitUntil: "domcontentloaded" });
    const editLinks = page.locator('a[href^="/protocols/"][href$="/edit"]');
    const protocolEditHref = await editLinks.count() ? await editLinks.first().getAttribute("href") : null;
    assert(protocolEditHref, "No Protocol editor route found.");
    return protocolEditHref;
  }

  const directEditHref = `${detailHref}/edit`;
  const response = await page.goto(`${baseUrl}${directEditHref}`, { waitUntil: "domcontentloaded" });
  if (response && response.status() < 400) return directEditHref;

  await page.goto(`${baseUrl}${detailHref}`, { waitUntil: "domcontentloaded" });
  const editLinks = page.locator(`a[href^="${detailHref}"][href$="/edit"]`);
  const linkedEditHref = await editLinks.count() ? await editLinks.first().getAttribute("href") : null;
  assert(linkedEditHref, `No editor route found for ${area}.`);
  return linkedEditHref;
}

async function assertDesktopOutline(page, route) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
  assert(response && response.status() < 400, `${route} returned ${response?.status() ?? "no response"}.`);
  const outline = page.locator(".document-editor-outline").first();
  await outline.waitFor();
  assert.notEqual(await outline.evaluate((node) => getComputedStyle(node).display), "none", `${route} outline is hidden on desktop.`);

  const buttons = outline.locator("nav button");
  const buttonCount = await buttons.count();
  assert(buttonCount >= 1, `${route} outline has no section links.`);
  if (route.startsWith("/entries/")) assert(buttonCount >= 2, `${route} Entry outline should expose details and content.`);

  const targetIds = await buttons.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("aria-controls")));
  assert(targetIds.every(Boolean), `${route} contains an outline item without a target.`);
  await page.locator(`[id="${targetIds[0].replaceAll('"', '\\"')}"]`).waitFor();
  const targets = await buttons.evaluateAll((nodes) => nodes.map((node) => {
    const label = node.textContent?.trim() ?? "";
    const targetId = node.getAttribute("aria-controls");
    return { label, targetExists: Boolean(targetId && document.getElementById(targetId)) };
  }));
  assert(targets.every((item) => item.label), `${route} contains an unlabeled outline item.`);
  assert(targets.every((item) => item.targetExists), `${route} contains an outline item without a rendered section.`);
  const paperWidth = await page.locator(".document-a4-paper").evaluate((node) => node.getBoundingClientRect().width);
  assert(paperWidth >= 790 && paperWidth <= 796, `${route} should preserve the A4 screen width, got ${paperWidth}px.`);

  if (targetIds.length > 1) {
    const lastTargetId = targetIds.at(-1);
    const canReachReadingLine = await page.evaluate((targetId) => {
      const target = document.getElementById(targetId);
      if (!target) return false;
      const absoluteTop = scrollY + target.getBoundingClientRect().top;
      const readingLine = innerHeight * 0.22;
      const maxScroll = document.documentElement.scrollHeight - innerHeight;
      const requestedScroll = Math.max(0, absoluteTop - readingLine + 1);
      scrollTo({ top: Math.min(maxScroll, requestedScroll), behavior: "instant" });
      return absoluteTop - Math.min(maxScroll, requestedScroll) <= readingLine;
    }, lastTargetId);
    if (canReachReadingLine) {
      await page.waitForFunction((targetId) => document.querySelector(`[aria-controls="${targetId}"]`)?.getAttribute("aria-current") === "location", lastTargetId, { timeout: 5_000 });
    }
  }

  const activeButtons = outline.locator('nav button[aria-current="location"]');
  assert.equal(await activeButtons.count(), 1, `${route} should highlight exactly one current outline item.`);
  const activeTargetId = await activeButtons.first().getAttribute("aria-controls");
  assert(activeTargetId && await page.locator(`[id="${activeTargetId.replaceAll('"', '\\"')}"]`).count(), `${route} highlighted outline item has no rendered target.`);
}

async function assertResponsiveAndPrintOutline(page, route) {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
  const compactDesktopOutline = page.locator(".document-editor-outline").first();
  const firstTargetId = await compactDesktopOutline.locator("nav button").first().getAttribute("aria-controls");
  await page.locator(`[id="${firstTargetId.replaceAll('"', '\\"')}"]`).waitFor();
  const compactPaperWidth = await page.locator(".document-a4-paper").evaluate((node) => node.getBoundingClientRect().width);
  assert(compactPaperWidth >= 790 && compactPaperWidth <= 796, `${route} should keep A4 width at 1024px, got ${compactPaperWidth}px.`);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
  const outline = page.locator(".document-editor-outline").first();
  await outline.waitFor({ state: "attached" });
  assert.equal(await outline.evaluate((node) => getComputedStyle(node).display), "none", `${route} outline should be hidden on mobile.`);
  const dimensions = await page.evaluate(() => ({ clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  assert(dimensions.scrollWidth <= dimensions.clientWidth + 1, `${route} has mobile horizontal overflow.`);

  await page.emulateMedia({ media: "print" });
  assert.equal(await outline.evaluate((node) => getComputedStyle(node).display), "none", `${route} outline should be excluded from print.`);
  const printRoot = page.locator(".document-print-root").first();
  const printMetrics = await printRoot.evaluate((node) => ({
    display: getComputedStyle(node).display,
    visibility: getComputedStyle(node).visibility,
    width: node.getBoundingClientRect().width,
  }));
  assert.notEqual(printMetrics.display, "none", `${route} print document was hidden.`);
  assert.equal(printMetrics.visibility, "visible", `${route} print document is not visible.`);
  assert(printMetrics.width > 0, `${route} print document has no rendered width.`);
  await page.emulateMedia({ media: "screen" });
}

async function assertExperimentModeOutlineSync(page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${baseUrl}/experiments/new`, { waitUntil: "domcontentloaded" });
  const backgroundButton = page.locator('.document-editor-outline button[aria-controls="scientific-section-background"]');
  assert.equal(await backgroundButton.count(), 0, "Protocol planning mode should hide Background from the outline.");

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByText("Fully custom Experiment", { exact: true }).click();
  console.log("Experiment mode switched to custom; checking Background section.");
  await backgroundButton.waitFor({ timeout: 5_000 });
  await page.locator('#scientific-section-background').waitFor({ timeout: 5_000 });

  await page.getByText("Plan from Protocol", { exact: true }).click();
  console.log("Experiment mode switched back to Protocol; checking hidden section cleanup.");
  await backgroundButton.waitFor({ state: "detached", timeout: 5_000 });
  assert.equal(await page.locator('#scientific-section-background').count(), 0, "Protocol planning mode should remove the hidden Background section from the editor.");
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const verifiedRoutes = [];
  for (const area of documentAreas) {
    const route = await findEditorRoute(page, area);
    if (!route) continue;
    await assertDesktopOutline(page, route);
    await assertResponsiveAndPrintOutline(page, route);
    verifiedRoutes.push(route);
    console.log(`Verified ${route}`);
  }
  await assertExperimentModeOutlineSync(page);
  assert(verifiedRoutes.length >= 5, `Expected at least five document editor routes, found ${verifiedRoutes.length}.`);
  console.log(`Document outline rollout passed: ${verifiedRoutes.join(", ")}`);
} finally {
  await browser.close();
}
