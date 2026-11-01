import "dotenv/config";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { networkInterfaces } from "node:os";
import { chromium, webkit } from "playwright";
import pg from "pg";

const baseUrl = process.env.LABNEST_E2E_BASE_URL ?? "http://127.0.0.1:3219";
const database = new URL(process.env.DATABASE_URL);
assert(["localhost", "127.0.0.1"].includes(new URL(baseUrl).hostname), "Use an isolated local server.");
assert.equal(database.pathname, "/labnest_mobile_qa", "Never run mutation checks against real inventory.");
assert(["localhost", "127.0.0.1"].includes(database.hostname));
const evidence = process.env.MOBILE_REPAIR_EVIDENCE ?? ".local-runtime/mobile-repair-evidence";
await mkdir(evidence, { recursive: true });
const db = new pg.Client({ connectionString: database.toString() });
await db.connect();
const report = [];
const failures = [];
const cancelledPreloads = [];
const routes = ["/protocols", "/projects", "/experiments", "/results", "/reports", "/research-plans", "/sequences", "/inventory"];

async function check(name, work, page) {
  console.log(`START ${name}`);
  // A streaming response can outlive Playwright's action timeout. Save the
  // exact stalled check and fail the process rather than leave CI silent.
  const deadline = setTimeout(async () => {
    failures.push({ name, message: "Check exceeded 90 seconds." });
    await writeFile(path.join(evidence, "report.json"), JSON.stringify({ checks: report, failures, cancelledPreloads }, null, 2));
    console.error(`TIMEOUT ${name}`);
    process.exit(1);
  }, 90_000);
  try { await work(); report.push({ name, passed: true }); console.log(`PASS ${name}`); }
  catch (error) {
    failures.push({ name, message: error.message });
    console.error(`FAIL ${name}: ${error.message}`);
    await page?.screenshot({ path: path.join(evidence, `${name.replaceAll(/[^a-z0-9-]/gi, "_")}-failed.png`), fullPage: true }).catch(() => {});
  } finally { clearTimeout(deadline); }
}
async function withinViewport(panel, width, height, name) {
  const box = await panel.boundingBox();
  assert(box && box.x >= 7 && box.y >= 7 && box.x + box.width <= width - 7 && box.y + box.height <= height - 7,
    `${name}: floating panel outside ${width}×${height}: ${JSON.stringify(box)}`);
}
async function inspectMenus(page, width, height, name) {
  const triggers = page.locator("main button[popovertarget]");
  for (let i = 0; i < await triggers.count(); i++) {
    const trigger = triggers.nth(i);
    if (!await trigger.isVisible()) continue;
    const id = await trigger.getAttribute("popovertarget");
    await trigger.click();
    const panel = page.locator(`[id=${JSON.stringify(id)}]`);
    await panel.waitFor({ state: "visible" });
    await withinViewport(panel, width, height, name);
    // Let links in the newly visible menu finish preloading before the test leaves the page.
    await page.waitForLoadState("networkidle");
    await page.keyboard.press("Escape");
    await panel.waitFor({ state: "hidden" });
    assert(await trigger.evaluate(el => el === document.activeElement), `${name}: Escape must restore trigger focus.`);
  }
}

try {
  for (const [browserName, engine] of [["chromium", chromium], ["webkit", webkit]]) {
    const browser = await engine.launch({ headless: true });
    try {
      for (const [width, locale, colorScheme] of [[320, "en", "light"], [390, "en", "light"], [430, "zh", "dark"], [1440, "en", "light"]]) {
        const height = width === 1440 ? 1000 : 844;
        const context = await browser.newContext({ viewport: { width, height }, isMobile: width < 1024, hasTouch: width < 1024, colorScheme, timezoneId: width === 390 ? "America/Los_Angeles" : "Asia/Shanghai" });
        await context.addCookies([{ name: "labnest_locale", value: locale, url: baseUrl }]);
        const page = await context.newPage();
        page.setDefaultTimeout(12_000);
        const errors = [];
        const recordError = (error) => {
          // WebKit reports detached-document Next preloads as access-control failures during goto().
          // Keep these in the evidence; actual navigation and all other runtime errors still fail.
          if (browserName === "webkit" && /[?&]_rsc=.+ due to access control checks\.$/.test(error.message)) {
            cancelledPreloads.push(error.message);
          } else errors.push(error.message);
        };
        page.on("pageerror", recordError);
        const label = `${browserName}-${width}-${locale}`;
        for (const route of routes) {
          await check(`${label}-${route.slice(1)}-menus`, async () => {
            const response = await page.goto(baseUrl + route, { waitUntil: "networkidle" });
            assert.equal(response.status(), 200);
            await inspectMenus(page, width, height, route);
            assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Page overflows horizontally.");
          }, page);
        }
        await check(`${label}-home`, async () => {
          await page.goto(baseUrl, { waitUntil: "networkidle" });
          if (width < 1024) {
            const mobile = page.locator(".bench-mobile");
            assert.deepEqual(await mobile.locator("nav a").evaluateAll(nodes => nodes.map(node => node.getAttribute("href"))),
              ["/protocol-run", "/entries/new?mode=capture&experiment=active", "/tools/calculator", "/tools"]);
            assert.equal(await mobile.locator('a[href="/protocol-run"]').count(), 1, "No duplicate run-mode CTA.");
            const links = await mobile.locator('section[aria-labelledby="mobile-today-title"] a[href^="/experiments/"]').allTextContents();
            assert(links[0].includes("QA overnight experiment"), "Cross-day running experiment must lead.");
            assert(links.some(text => text.includes("QA planned today")));
            assert(!links.some(text => /QA (future|completed)/.test(text)));
            const sizes = await mobile.locator("nav a").evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().height));
            assert(sizes.every(size => size >= 64), "The four primary actions need large touch targets.");
          } else {
            assert(await page.locator(".overview-desktop").isVisible(), "Desktop Overview must remain available.");
          }
          await page.screenshot({ path: path.join(evidence, `${label}-home.png`), fullPage: true });
        }, page);
        if (width === 390) {
          await check(`${label}-capture-entrypoints`, async () => {
            // The bar is Home · Search · Run mode · ＋; ＋ writes a note on the experiment in progress.
            const nav = page.getByRole("navigation", { name: "Mobile navigation" });
            assert.deepEqual(await nav.locator("a, button").allTextContents(), ["Home", "Search", "Run mode", "New"]);
            await nav.getByRole("button", { name: "Quick note" }).click();
            await page.waitForURL("**/entries/new?mode=capture&experiment=active");
            await page.getByRole("heading", { name: "Quick capture", exact: true }).waitFor();
            // Every other module is in the drawer behind ☰, named as in #109; ＋ is not repeated there.
            await page.goto(baseUrl + "/inventory", { waitUntil: "networkidle" });
            await page.getByRole("button", { name: "Open navigation" }).click();
            const drawer = page.getByRole("dialog", { name: "Navigation" });
            assert.equal(await drawer.getByRole("link", { name: "Record history", exact: true }).getAttribute("href"), "/records");
            assert.equal(await drawer.getByRole("link", { name: "All entries", exact: true }).getAttribute("href"), "/entries");
            assert.equal(await drawer.getByRole("link", { name: "Quick capture", exact: true }).count(), 0);
            await drawer.getByRole("link", { name: "All entries", exact: true }).click();
            await page.waitForURL("**/entries");
            await drawer.waitFor({ state: "hidden" });
            // A page's header actions are behind ··· in the top bar.
            await page.getByRole("button", { name: "Page actions" }).click();
            const sheet = page.getByRole("dialog", { name: "Page actions" });
            await sheet.waitFor();
            // A bottom sheet rests on the bottom edge; once it has slid in, all of it is on screen.
            await page.waitForTimeout(400);
            const box = await sheet.boundingBox();
            assert(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= width + 1 && box.y + box.height <= height + 1, `${label}-page-actions: sheet off screen: ${JSON.stringify(box)}`);
            await page.keyboard.press("Escape");
            await sheet.waitFor({ state: "hidden" });
            await page.waitForLoadState("networkidle");
          }, page);
          await check(`${label}-filter-submission`, async () => {
            await page.goto(baseUrl + "/protocols", { waitUntil: "networkidle" });
            await page.getByRole("button", { name: /^Filters/ }).click();
            const panel = page.locator("[popover]:popover-open");
            const select = panel.locator("select").first();
            const option = await select.locator("option").nth(1).getAttribute("value");
            const name = await select.getAttribute("name");
            await select.selectOption(option);
            await page.waitForURL(url => url.searchParams.get(name) === option);
          }, page);
          await check(`${label}-inventory-results`, async () => {
            await page.goto(baseUrl + "/inventory?q=QA", { waitUntil: "networkidle" });
            assert.equal(await page.locator("[data-mobile-inventory-item]").count(), 12);
            await page.getByRole("button", { name: /^Show more/ }).click();
            assert.equal(await page.locator("[data-mobile-inventory-item]").count(), 16);
            await page.goto(baseUrl + "/inventory?q=mobile-unknown", { waitUntil: "networkidle" });
            assert.match(await page.locator("[data-mobile-inventory-item]").innerText(), /Quantity not recorded/);
            await page.goto(baseUrl + "/inventory?q=QA&flag=expired", { waitUntil: "networkidle" });
            assert.equal(await page.locator("[data-mobile-inventory-item]").count(), 1);
            assert.match(await page.locator("[data-mobile-inventory-item]").innerText(), /mobile-expired/);
            await page.goto(baseUrl + "/inventory?q=Shelf%20A", { waitUntil: "networkidle" });
            assert.equal(await page.locator("[data-mobile-inventory-item]").count(), 12, "Location search must work.");
            await page.screenshot({ path: path.join(evidence, `${label}-inventory.png`), fullPage: true });
          }, page);
          await check(`${label}-precise-stock-use`, async () => {
            const before = (await db.query('SELECT "currentQuantity" FROM "InventoryItem" WHERE id=$1', ["mobile-qr"])).rows[0].currentQuantity;
            await page.goto(baseUrl + "/inventory/mobile-qr", { waitUntil: "networkidle" });
            const movement = page.getByRole("heading", { name: "Record stock movement" });
            const material = page.getByRole("heading", { name: "Material record" });
            assert((await movement.boundingBox()).y < (await material.boundingBox()).y, "Operations must precede reference metadata on phone.");
            await page.locator('select[name="type"]').selectOption("consume");
            await page.locator('input[name="quantity"]').fill("1");
            const performer = `Mobile QA ${browserName} ${Date.now()}`;
            await page.locator('input[name="performedBy"]').fill(performer);
            const [response] = await Promise.all([
              page.waitForResponse(response => response.request().method() === "POST" && response.url().includes("/inventory/mobile-qr")),
              page.getByRole("button", { name: "Record Movement", exact: true }).click(),
            ]);
            assert(response.ok() || response.status() === 303, `Stock action returned ${response.status()}.`);
            // Wait for the committed movement to render; a redirected RSC
            // response can remain open even after the server action succeeds.
            await page.getByRole("cell", { name: performer, exact: true }).waitFor();
            await page.waitForLoadState("networkidle");
            const after = (await db.query('SELECT "currentQuantity" FROM "InventoryItem" WHERE id=$1', ["mobile-qr"])).rows[0].currentQuantity;
            assert.equal(after, before - 1);
            await page.reload({ waitUntil: "networkidle" });
            assert((await page.locator("main").innerText()).includes(performer));
          }, page);
          await check(`${label}-package-workflow`, async () => {
            await page.goto(baseUrl + "/inventory/mobile-package", { waitUntil: "networkidle" });
            const packages = page.getByRole("region", { name: "实物包装" });
            await packages.waitFor();
            const material = page.getByRole("heading", { name: "Material record" });
            assert((await packages.boundingBox()).y < (await material.boundingBox()).y);
            await packages.getByRole("button", { name: /mobile-bottle-1/ }).click();
            assert(await packages.getByRole("heading", { name: "mobile-bottle-1", exact: true }).isVisible());
          }, page);
          await check(`${label}-detail-menus`, async () => {
            await page.goto(baseUrl + "/protocols", { waitUntil: "networkidle" });
            const protocol = await page.locator('main a[href^="/protocols/"]').filter({ hasText: /transfection/i }).first().getAttribute("href");
            assert(protocol);
            await page.goto(baseUrl + protocol, { waitUntil: "networkidle" });
            await inspectMenus(page, width, height, "Protocol detail");
            await page.goto(baseUrl + "/entries/mobile-assigned-entry", { waitUntil: "networkidle" });
            await inspectMenus(page, width, height, "Entry assignment");
          }, page);
          // The actual LAN HTTP origin is not localhost: native secure-context APIs are unavailable.
          await check(`${label}-http-photo-barcodes`, async () => {
            // Keep the localhost page alive: changing its origin can cancel pending Next link preloads.
            const scanPage = await context.newPage();
            scanPage.on("pageerror", recordError);
            const address = Object.values(networkInterfaces()).flat().find(item => item?.family === "IPv4" && !item.internal)?.address;
            assert(address, "A local LAN address is needed to verify the non-secure HTTP path.");
            const insecure = new URL(baseUrl);
            insecure.hostname = address;
            for (const [name, value] of [["qr", "LN-MOBILE-QR-20261020"], ["code128", "LN-MOBILE-128-20261020"], ["ean13", "5901234123457"], ["datamatrix", "LN-MOBILE-DM-20261020"]]) {
              await scanPage.goto(insecure.origin + "/inventory", { waitUntil: "networkidle" });
              assert.equal(await scanPage.evaluate(() => isSecureContext), false);
              await scanPage.locator('input[type="file"][capture]').setInputFiles(`scripts/fixtures/mobile-barcodes/${name}.png`);
              await scanPage.waitForURL(url => url.searchParams.get("q") === value);
              await scanPage.locator("[data-mobile-inventory-item]").waitFor();
              assert.equal(await scanPage.locator("[data-mobile-inventory-item]").count(), 1, `${name}: should resolve the expected item.`);
              await scanPage.waitForLoadState("networkidle");
            }
            await scanPage.locator('input[type="file"][capture]').setInputFiles({ name: "unreadable.png", mimeType: "image/png", buffer: Buffer.from("not an image") });
            await scanPage.getByRole("status").filter({ hasText: /No readable barcode/ }).waitFor();
            assert(await scanPage.getByRole("textbox", { name: "Search inventory" }).isEditable(), "Manual search survives a failed scan.");
          }, page);
        }
        await check(`${label}-browser-errors`, async () => assert.deepEqual(errors, []), page);
        await context.close();
      }
    } finally { await browser.close(); }
  }
} finally {
  await db.end();
  await writeFile(path.join(evidence, "report.json"), JSON.stringify({ checks: report, failures, cancelledPreloads }, null, 2));
}
console.log(JSON.stringify({ passed: report.length, failed: failures.length, failures, evidence }, null, 2));
assert.equal(failures.length, 0, "Mobile repair acceptance failed; see report.json.");
