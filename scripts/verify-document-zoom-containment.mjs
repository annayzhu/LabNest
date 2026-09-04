import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.env.LABNEST_E2E_BASE_URL ?? "http://127.0.0.1:3219";

async function findProtocolEditor(page) {
  await page.goto(`${baseUrl}/protocols`, { waitUntil: "domcontentloaded" });
  const detailHref = await page.locator('main a[href^="/protocols/"]').evaluateAll((links) => links
    .map((link) => link.getAttribute("href"))
    .find((href) => href
      && !href.startsWith("/protocols/new")
      && !href.startsWith("/protocols/import")
      && !href.startsWith("/protocols/export")) ?? null);
  assert(detailHref, "No Protocol detail route is available for zoom verification.");
  await page.goto(`${baseUrl}${detailHref}`, { waitUntil: "domcontentloaded" });
  const editHref = await page.locator('main a[href*="/versions/"][href$="/edit"]').first().getAttribute("href");
  assert(editHref, `No Protocol editor route was found from ${detailHref}.`);
  return editHref;
}

async function readWidths(page) {
  return page.evaluate(() => {
    const measure = (selector) => {
      const element = document.querySelector(selector);
      if (!element) throw new Error(`Missing ${selector}.`);
      return {
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        renderedWidth: element.getBoundingClientRect().width,
      };
    };
    return {
      root: measure("html"),
      main: measure("main"),
      panel: measure(".document-editor-document-panel"),
      paper: measure(".document-a4-paper"),
    };
  });
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1024, height: 900 } });
  const editHref = await findProtocolEditor(page);
  await page.goto(`${baseUrl}${editHref}`, { waitUntil: "networkidle" });

  await page.getByRole("button", { name: "110%" }).click();
  const enlarged = await readWidths(page);
  assert(enlarged.root.scrollWidth <= enlarged.root.clientWidth + 1, `110% zoom widened the browser page: ${JSON.stringify(enlarged)}.`);
  assert(enlarged.main.scrollWidth <= enlarged.main.clientWidth + 1, `110% zoom widened the application main area: ${JSON.stringify(enlarged)}.`);
  assert(enlarged.panel.scrollWidth > enlarged.panel.clientWidth, "110% zoom should scroll inside the document panel when the enlarged A4 page does not fit.");
  assert(enlarged.paper.renderedWidth >= 870 && enlarged.paper.renderedWidth <= 876, `110% did not render the A4 paper at the expected width: ${enlarged.paper.renderedWidth}px.`);

  await page.getByRole("button", { name: "Fit" }).click();
  const fitted = await readWidths(page);
  assert(fitted.root.scrollWidth <= fitted.root.clientWidth + 1, `Fit widened the browser page: ${JSON.stringify(fitted)}.`);
  assert(fitted.main.scrollWidth <= fitted.main.clientWidth + 1, `Fit widened the application main area: ${JSON.stringify(fitted)}.`);
  assert(fitted.panel.scrollWidth <= fitted.panel.clientWidth + 2, `Fit left horizontal overflow inside the document panel: ${JSON.stringify(fitted)}.`);

  console.log(`Document zoom containment passed for ${editHref}.`);
} finally {
  await browser.close();
}
