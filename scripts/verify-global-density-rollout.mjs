import assert from "node:assert/strict";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const baseUrl = process.env.LABNEST_E2E_BASE_URL ?? "http://127.0.0.1:3219";
const screenshotDir = process.env.LABNEST_DENSITY_SCREENSHOT_DIR;
const representativeRoutes = [
  "/",
  "/entries",
  "/projects",
  "/protocols",
  "/experiments",
  "/results",
  "/reports",
  "/inventory",
  "/sequences",
  "/tools",
  "/settings",
];

async function assertNoPageOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  assert(dimensions.scrollWidth <= dimensions.clientWidth + 1, `${label} has page-level horizontal overflow: ${dimensions.scrollWidth}px > ${dimensions.clientWidth}px.`);
}

async function openRoute(page, route) {
  const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded" });
  assert(response && response.status() < 400, `${route} returned ${response?.status() ?? "no response"}.`);
  const header = page.locator("header.page-header");
  await header.waitFor();
  return header;
}

async function assertDesktopPageHeaders(page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const route of representativeRoutes) {
    const header = await openRoute(page, route);
    const metrics = await header.evaluate((node) => {
      const title = node.querySelector(".page-header-title");
      const action = node.querySelector(".page-actions a, .page-actions button");
      return {
        titleFontSize: Number.parseFloat(getComputedStyle(title).fontSize),
        actionFontSize: action ? Number.parseFloat(getComputedStyle(action).fontSize) : null,
        height: node.getBoundingClientRect().height,
      };
    });
    assert(metrics.titleFontSize >= 16.5 && metrics.titleFontSize <= 17.5, `${route} desktop title should use the shared compact 17px scale: ${metrics.titleFontSize}px.`);
    if (metrics.actionFontSize !== null) assert(metrics.actionFontSize >= 11.5 && metrics.actionFontSize <= 12.5, `${route} desktop action labels should use the shared 12px scale: ${metrics.actionFontSize}px.`);
    assert(metrics.height <= 88, `${route} desktop page header is too tall: ${metrics.height}px.`);
    await assertNoPageOverflow(page, `${route} desktop`);
  }
}

async function assertMobilePageHeaders(page) {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of representativeRoutes) {
    const header = await openRoute(page, route);
    const metrics = await header.evaluate((node) => {
      const title = node.querySelector(".page-header-title");
      const identifier = node.querySelector(".page-header-identifier");
      const actions = node.querySelector(".page-actions");
      const action = actions?.querySelector("a, button");
      const titleRect = title.getBoundingClientRect();
      const identifierRect = identifier?.getBoundingClientRect();
      return {
        titleFontSize: Number.parseFloat(getComputedStyle(title).fontSize),
        identifierFontSize: identifier ? Number.parseFloat(getComputedStyle(identifier).fontSize) : null,
        titleBeforeIdentifier: identifierRect ? titleRect.top < identifierRect.top : true,
        titleIdentifierGap: identifierRect ? identifierRect.top - titleRect.bottom : null,
        actionFontSize: action ? Number.parseFloat(getComputedStyle(action).fontSize) : null,
        actionOverflow: actions ? getComputedStyle(actions).overflowX : null,
        height: node.getBoundingClientRect().height,
      };
    });
    assert(metrics.titleFontSize >= 13.5 && metrics.titleFontSize <= 14.5, `${route} mobile title should use the shared 14px scale: ${metrics.titleFontSize}px.`);
    if (metrics.identifierFontSize !== null) {
      assert(metrics.titleBeforeIdentifier, `${route} mobile title must appear above its identifier.`);
      assert(metrics.identifierFontSize >= 8.5 && metrics.identifierFontSize <= 9.5, `${route} mobile identifier should use the 9px supporting scale: ${metrics.identifierFontSize}px.`);
      assert(metrics.titleIdentifierGap >= 0 && metrics.titleIdentifierGap <= 8, `${route} mobile title and identifier are not visually grouped: ${metrics.titleIdentifierGap}px.`);
    }
    if (metrics.actionFontSize !== null) {
      assert(metrics.actionFontSize >= 10.5 && metrics.actionFontSize <= 11.5, `${route} mobile action labels should use the shared 11px scale: ${metrics.actionFontSize}px.`);
      assert(["auto", "scroll"].includes(metrics.actionOverflow), `${route} mobile actions must scroll safely, got ${metrics.actionOverflow}.`);
    }
    assert(metrics.height <= 112, `${route} mobile page header contains excessive empty height: ${metrics.height}px.`);
    await assertNoPageOverflow(page, `${route} mobile`);
  }
}

async function assertOperationalTypography(page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openRoute(page, "/settings");
  const shellMetrics = await page.evaluate(() => {
    const activeNav = document.querySelector("aside .sidebar-nav-item[aria-current='page']");
    const search = document.querySelector("header form label");
    const cardTitle = document.querySelector("main section h2");
    return {
      body: Number.parseFloat(getComputedStyle(document.body).fontSize),
      nav: Number.parseFloat(getComputedStyle(activeNav).fontSize),
      search: Number.parseFloat(getComputedStyle(search).fontSize),
      cardTitle: Number.parseFloat(getComputedStyle(cardTitle).fontSize),
    };
  });
  assert.equal(shellMetrics.body, 13, `Operational body copy should be 13px, got ${shellMetrics.body}px.`);
  assert.equal(shellMetrics.nav, 12, `Desktop navigation should be 12px, got ${shellMetrics.nav}px.`);
  assert.equal(shellMetrics.search, 13, `Top search copy should be 13px, got ${shellMetrics.search}px.`);
  assert.equal(shellMetrics.cardTitle, 13, `Card headings should be 13px, got ${shellMetrics.cardTitle}px.`);

  await openRoute(page, "/projects");
  const tableMetrics = await page.evaluate(() => {
    const table = document.querySelector(".ln-data-table");
    const heading = table?.querySelector("thead");
    return {
      body: Number.parseFloat(getComputedStyle(table).fontSize),
      heading: Number.parseFloat(getComputedStyle(heading).fontSize),
    };
  });
  assert.equal(tableMetrics.body, 13, `Shared table copy should be 13px, got ${tableMetrics.body}px.`);
  assert(tableMetrics.heading >= 11 && tableMetrics.heading <= 12, `Shared table headings should be 11–12px, got ${tableMetrics.heading}px.`);

  await openRoute(page, "/protocols");
  const identifierMetrics = await page.evaluate(() => {
    const identifier = document.querySelector(".ln-data-table .record-identifier");
    const dataProbe = document.createElement("span");
    dataProbe.className = "font-mono";
    document.body.append(dataProbe);
    const metrics = {
      found: Boolean(identifier),
      identifierFamily: identifier ? getComputedStyle(identifier).fontFamily : "",
      interfaceFamily: getComputedStyle(document.body).fontFamily,
      dataFamily: getComputedStyle(dataProbe).fontFamily,
    };
    dataProbe.remove();
    return metrics;
  });
  assert(identifierMetrics.found, "Protocols should render version identifiers with the shared identifier style.");
  assert.equal(identifierMetrics.identifierFamily, identifierMetrics.interfaceFamily, "Record identifiers should use the configured interface font.");
  assert.notEqual(identifierMetrics.identifierFamily, identifierMetrics.dataFamily, "Record identifiers should not use the monospace data font.");

  await page.goto(`${baseUrl}/projects/new`, { waitUntil: "domcontentloaded" });
  const formMetrics = await page.evaluate(() => {
    const input = document.querySelector("main input:not([type='hidden'])");
    const label = input?.closest("label")?.querySelector("span");
    return {
      field: Number.parseFloat(getComputedStyle(input).fontSize),
      label: Number.parseFloat(getComputedStyle(label).fontSize),
      height: input.getBoundingClientRect().height,
    };
  });
  assert.equal(formMetrics.field, 13, `Shared form fields should be 13px, got ${formMetrics.field}px.`);
  assert.equal(formMetrics.label, 11, `Shared form labels should be 11px, got ${formMetrics.label}px.`);
  assert.equal(formMetrics.height, 40, `Field hit area must remain 40px, got ${formMetrics.height}px.`);

  await page.goto(`${baseUrl}/research-plans/new`, { waitUntil: "domcontentloaded" });
  const largeButtonMetrics = await page.locator("main button[type='submit']").evaluate((button) => ({
    button: Number.parseFloat(getComputedStyle(button).fontSize),
    buttonHeight: button.getBoundingClientRect().height,
  }));
  assert.equal(largeButtonMetrics.button, 12, `Large shared buttons should be 12px, got ${largeButtonMetrics.button}px.`);
  assert.equal(largeButtonMetrics.buttonHeight, 40, `Large button hit area must remain 40px, got ${largeButtonMetrics.buttonHeight}px.`);
}

async function findSharedDocumentDetailRoute(page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const basePath of ["/entries", "/research-plans", "/results"]) {
    await page.goto(`${baseUrl}${basePath}`, { waitUntil: "domcontentloaded" });
    const hrefs = await page.locator(`a[href^="${basePath}/"]`).evaluateAll((links) => links.map((link) => link.getAttribute("href")).filter(Boolean));
    const detailHref = hrefs.find((href) => new RegExp(`^${basePath}/[^/]+$`).test(href) && ![`${basePath}/new`, `${basePath}/import`, `${basePath}/export`].includes(href));
    if (detailHref) return detailHref;
  }
  assert.fail("A seeded non-Protocol document detail route is required for the shared document-density seam.");
}

async function assertSharedDocumentDensity(page) {
  const detailHref = await findSharedDocumentDetailRoute(page);
  await page.goto(`${baseUrl}${detailHref}`, { waitUntil: "domcontentloaded" });
  const paper = page.locator(".document-a4-paper");
  await paper.waitFor();
  const desktopMetrics = await paper.evaluate((node) => {
    const copy = node.querySelector(".document-copy, .entry-content, .document-block p");
    const style = getComputedStyle(copy);
    const smallProbe = document.createElement("span");
    smallProbe.className = "text-sm";
    const metricProbe = document.createElement("span");
    metricProbe.className = "text-2xl";
    node.append(smallProbe, metricProbe);
    const utilityFontSizes = [smallProbe, metricProbe].map((probe) => Number.parseFloat(getComputedStyle(probe).fontSize));
    const workspaceProbe = document.createElement("span");
    workspaceProbe.className = "text-xs";
    node.parentElement.append(workspaceProbe);
    const workspaceUtilityFontSize = Number.parseFloat(getComputedStyle(workspaceProbe).fontSize);
    smallProbe.remove();
    metricProbe.remove();
    workspaceProbe.remove();
    return {
      width: node.getBoundingClientRect().width,
      copyFontSize: Number.parseFloat(style.fontSize),
      copyLineHeightRatio: Number.parseFloat(style.lineHeight) / Number.parseFloat(style.fontSize),
      utilityFontSizes,
      workspaceUtilityFontSize,
    };
  });
  assert(desktopMetrics.width >= 760 && desktopMetrics.width <= 798, `Shared document paper left its existing A4-constrained range: ${desktopMetrics.width}px.`);
  assert(desktopMetrics.copyLineHeightRatio >= 1.58 && desktopMetrics.copyLineHeightRatio <= 1.62, `Shared document copy should use 1.6 line height: ${desktopMetrics.copyLineHeightRatio}.`);
  assert.deepEqual(desktopMetrics.utilityFontSizes, [14, 24], `A4 Tailwind utility sizes must retain their document scale, got ${desktopMetrics.utilityFontSizes.join("/")}px.`);
  assert.equal(desktopMetrics.workspaceUtilityFontSize, 11, `Screen-only document toolbar chrome should retain the compact UI scale, got ${desktopMetrics.workspaceUtilityFontSize}px.`);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}${detailHref}`, { waitUntil: "domcontentloaded" });
  await paper.waitFor();
  const mobileMetrics = await paper.evaluate((node) => {
    const copy = node.querySelector(".document-copy, .entry-content, .document-block p");
    const style = getComputedStyle(copy);
    return {
      copyFontSize: Number.parseFloat(style.fontSize),
      copyLineHeightRatio: Number.parseFloat(style.lineHeight) / Number.parseFloat(style.fontSize),
    };
  });
  assert(mobileMetrics.copyFontSize >= 11.5 && mobileMetrics.copyFontSize <= 12.5, `Shared mobile document copy should use the compact 12px scale: ${mobileMetrics.copyFontSize}px.`);
  assert(mobileMetrics.copyLineHeightRatio >= 1.58 && mobileMetrics.copyLineHeightRatio <= 1.62, `Shared mobile document copy should preserve 1.6 line height: ${mobileMetrics.copyLineHeightRatio}.`);
  await assertNoPageOverflow(page, `${detailHref} mobile`);
}

async function captureReviewScreenshots(page) {
  if (!screenshotDir) return;
  await mkdir(screenshotDir, { recursive: true });
  for (const { route, name, width, height } of [
    { route: "/", name: "global-density-overview-desktop.png", width: 1440, height: 1000 },
    { route: "/entries", name: "global-density-entries-desktop.png", width: 1440, height: 1000 },
    { route: "/settings", name: "global-density-settings-mobile.png", width: 390, height: 844 },
    { route: "/tools", name: "global-density-tools-mobile.png", width: 390, height: 844 },
  ]) {
    await page.setViewportSize({ width, height });
    await openRoute(page, route);
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: path.join(screenshotDir, name), fullPage: true });
  }
}

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await assertOperationalTypography(page);
  await assertDesktopPageHeaders(page);
  await assertMobilePageHeaders(page);
  await assertSharedDocumentDensity(page);
  await captureReviewScreenshots(page);
  await context.close();
  console.log(`Global density rollout browser seam passed across ${representativeRoutes.length} representative routes.`);
} finally {
  await browser.close();
}
