import { chromium } from "playwright";

const baseUrl = process.env.LABNEST_AUDIT_BASE_URL ?? "http://localhost:3000";
const viewportWidth = Number(process.env.LABNEST_AUDIT_WIDTH ?? 1920);
const viewportHeight = Number(process.env.LABNEST_AUDIT_HEIGHT ?? 1080);
const verbose = process.env.LABNEST_AUDIT_VERBOSE === "1";
const browserChannel = process.env.LABNEST_AUDIT_BROWSER;
const injectedCss = process.env.LABNEST_AUDIT_CSS;
const screenshotPath = process.env.LABNEST_AUDIT_SCREENSHOT;
const defaultRoutes = [
  "/", "/entries", "/entries/new", "/projects", "/projects/new", "/projects/import", "/projects/export",
  "/research-plans", "/research-plans/new", "/research-plans/import", "/research-plans/export",
  "/protocols", "/protocols/new", "/protocols/import", "/protocols/export",
  "/experiments", "/experiments/new", "/experiments/import", "/experiments/export",
  "/results", "/results/new", "/results/import", "/results/export",
  "/reports", "/reports/new", "/reports/import", "/reports/export",
  "/inventory", "/inventory/new", "/inventory/import", "/inventory/export", "/inventory/locations",
  "/sequences", "/sequences/new", "/sequences/import", "/sequences/export", "/sequences/collections", "/sequences/collections/new",
  "/tools", "/tools/visualization", "/search", "/actions", "/actions/manual", "/trash", "/settings",
  "/attachments", "/entities", "/samples", "/exports", "/purchases", "/protocol-run",
];
const requestedRoutes = process.env.LABNEST_AUDIT_ROUTES
  ?.split(",")
  .map((route) => route.trim())
  .filter(Boolean);
const routes = requestedRoutes?.length ? requestedRoutes : defaultRoutes;

const browser = await chromium.launch({ headless: true, ...(browserChannel ? { channel: browserChannel } : {}) });
const context = await browser.newContext({ viewport: { width: viewportWidth, height: viewportHeight } });
const page = await context.newPage();
const discoveredRoutes = new Set(routes);
const results = [];

async function inspectRoute(route) {
  let response;
  try {
    response = await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 15_000 });
    if (injectedCss) await page.addStyleTag({ content: injectedCss });
    await page.waitForTimeout(180);
  } catch (error) {
    results.push({ route, status: 0, error: error instanceof Error ? error.message : String(error), rootChildren: [] });
    return;
  }
  const result = await page.evaluate(() => {
    const main = document.querySelector("main");
    const pageRoot = main?.firstElementChild;
    const rect = (element) => element?.getBoundingClientRect();
    const mainRect = rect(main);
    const rootRect = rect(pageRoot);
    const mainStyle = main ? window.getComputedStyle(main) : undefined;
    const mainContentWidth = mainRect
      ? mainRect.width - Number.parseFloat(mainStyle?.paddingLeft ?? "0") - Number.parseFloat(mainStyle?.paddingRight ?? "0")
      : 0;
    const rootChildren = pageRoot ? [...pageRoot.children].flatMap((child) => {
      const childRect = rect(child);
      const style = window.getComputedStyle(child);
      if (!childRect || childRect.height < 20 || style.display === "none" || style.position === "fixed" || style.position === "absolute") return [];
      return [{
        tag: child.tagName.toLowerCase(),
        className: child.className?.toString().slice(0, 180) ?? "",
        width: Math.round(childRect.width),
        height: Math.round(childRect.height),
      }];
    }) : [];
    const links = [...document.querySelectorAll("main a[href]")].flatMap((anchor) => {
      const href = anchor.getAttribute("href");
      return href?.startsWith("/") && !href.startsWith("/api/") ? [href.split("?")[0]] : [];
    });
    const overhangingElements = [...document.querySelectorAll("main *")].flatMap((element) => {
      const elementRect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      if (style.display === "none" || style.position === "fixed" || elementRect.right <= document.documentElement.clientWidth + 1) return [];
      return [{
        tag: element.tagName.toLowerCase(),
        className: element.className?.toString().slice(0, 180) ?? "",
        left: Math.round(elementRect.left),
        right: Math.round(elementRect.right),
        width: Math.round(elementRect.width),
        ancestors: element.tagName === "TABLE"
          ? [...Array(4)].reduce((items, _, index) => {
              const ancestor = index === 0 ? element.parentElement : items[index - 1]?.element?.parentElement;
              if (!ancestor) return items;
              const ancestorRect = ancestor.getBoundingClientRect();
              const ancestorStyle = window.getComputedStyle(ancestor);
              return [...items, {
                element: ancestor,
                tag: ancestor.tagName.toLowerCase(),
                className: ancestor.className?.toString().slice(0, 140) ?? "",
                width: Math.round(ancestorRect.width),
                overflowX: ancestorStyle.overflowX,
                minWidth: ancestorStyle.minWidth,
              }];
            }, []).map((item) => ({
              tag: item.tag,
              className: item.className,
              width: item.width,
              overflowX: item.overflowX,
              minWidth: item.minWidth,
            }))
          : undefined,
      }];
    }).slice(0, 12);
    return {
      title: document.title,
      pathname: window.location.pathname,
      mainWidth: Math.round(mainRect?.width ?? 0),
      mainContentWidth: Math.round(mainContentWidth),
      rootWidth: Math.round(rootRect?.width ?? 0),
      rootRatio: mainContentWidth && rootRect?.width ? Number((rootRect.width / mainContentWidth).toFixed(3)) : 0,
      potentialBodyOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      rootChildren,
      links,
      overhangingElements,
    };
  });
  result.bodyScrollX = 0;
  if (result.potentialBodyOverflow) {
    await page.evaluate(() => window.scrollTo(0, window.scrollY));
    await page.mouse.move(2, 2);
    await page.mouse.wheel(10_000, 0);
    await page.waitForTimeout(40);
    result.bodyScrollX = await page.evaluate(() => Math.round(window.scrollX));
    await page.evaluate(() => window.scrollTo(0, window.scrollY));
  }
  result.bodyOverflow = result.bodyScrollX > 1;
  if (screenshotPath && routes.length === 1 && route === routes[0]) {
    await page.screenshot({ path: screenshotPath, fullPage: true });
  }
  for (const href of result.links) {
    if (/^\/(entries|projects|research-plans|protocols|experiments|results|reports|inventory|sequences\/collections|sequences)\/[^/]+(?:\/(?:edit|run|adapt))?$/.test(href)) {
      discoveredRoutes.add(href);
    }
  }
  results.push({ route, status: response?.status() ?? 0, ...result });
}

for (const route of routes) await inspectRoute(route);
for (const route of [...discoveredRoutes].filter((route) => !routes.includes(route)).slice(0, 80)) await inspectRoute(route);

await browser.close();

const failures = results.filter((result) => result.status >= 400 || result.status === 0);
const narrowRoots = results.filter((result) => result.rootRatio > 0 && result.rootRatio < 0.94);
const overflows = results.filter((result) => result.bodyOverflow);
const mismatchedChildren = results.flatMap((result) => result.rootChildren
  .filter((child) => child.height >= 80 && child.width < result.rootWidth * 0.72)
  .map((child) => ({ route: result.route, rootWidth: result.rootWidth, ...child })));

const report = {
  viewport: { width: viewportWidth, height: viewportHeight },
  audited: results.length,
  failures,
  narrowRoots: narrowRoots.map(({ route, mainWidth, mainContentWidth, rootWidth, rootRatio }) => ({ route, mainWidth, mainContentWidth, rootWidth, rootRatio })),
  overflows: overflows.map(({ route, documentWidth, viewportWidth, overhangingElements }) => ({ route, documentWidth, viewportWidth, overhangingElements })),
  mismatchedChildren,
};

if (verbose) {
  report.routeSummary = results.map(({ route, status, pathname, mainWidth, rootWidth, rootRatio, bodyOverflow, rootChildren }) => ({
    route, status, pathname, mainWidth, rootWidth, rootRatio, bodyOverflow,
    childWidths: rootChildren.map(({ tag, width, height }) => ({ tag, width, height })),
  }));
}

console.log(JSON.stringify(report, null, 2));
