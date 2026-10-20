import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium, webkit } from "playwright";
import readExcelFile from "read-excel-file/node";

const base = process.env.LABNEST_E2E_BASE_URL || "http://127.0.0.1:3340";
const configuredBase = process.env.LABNEST_STUDIO_TEST_BASE_URL || "http://127.0.0.1:3341";
const studio = process.env.LABNEST_STUDIO_TEST_URL || "http://127.0.0.1:3342/studio/";
for (const url of [base, configuredBase, studio]) {
  assert(["127.0.0.1", "localhost"].includes(new URL(url).hostname), "Acceptance must use isolated local services");
}
const out = process.env.LABNEST_TOOL_EVIDENCE_DIR || "docs/tools-entrypoints-20261020/evidence";
await mkdir(out, { recursive: true });
const checks = [];
const errors = [];
const externalRequests = [];
const names = ["QA_Sample_A", "QA_Sample_B"];

async function importNames(page, frame, id) {
  await page.getByText("导入样本名单文件", { exact: true }).click();
  await page.getByLabel("样本名单文件", { exact: true }).setInputFiles({
    name: "synthetic-samples.csv", mimeType: "text/csv",
    buffer: Buffer.from(`Name\n${names.join("\n")}`),
  });
  await page.getByRole("button", { name: "送入样本导入区", exact: true }).click();
  const textarea = frame.locator(id === "qpcr-plate-layout"
    ? 'textarea[aria-label="批量粘贴样本"], textarea[aria-label="Paste samples in bulk"]'
    : "textarea.bulk-input");
  assert.equal(await textarea.inputValue(), names.join("\n"));
}

try {
  for (const [engine, browserType] of [["chromium", chromium], ["webkit", webkit]]) {
    const browser = await browserType.launch();
    try {
      const context = await browser.newContext({ acceptDownloads: true });
      await context.addCookies([{ name: "labnest_locale", value: "en", url: base }]);
      context.on("request", (request) => {
        const url = new URL(request.url());
        if (["http:", "https:"].includes(url.protocol) && !["localhost", "127.0.0.1"].includes(url.hostname)) {
          externalRequests.push(url.href);
        }
      });
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      page.setDefaultNavigationTimeout(30000);
      page.on("pageerror", (error) => errors.push({ engine, url: page.url(), message: error.message }));
      for (const width of [1440, 834, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(`${base}/tools`);
        await page.waitForLoadState("networkidle");
        await page.screenshot({ path: path.join(out, `${engine}-catalog-${width}.png`), fullPage: true });
        const links = await page.locator("article a[aria-label^='Open ']").evaluateAll((items) =>
          items.map((item) => ({ href: item.getAttribute("href"), target: item.getAttribute("target") })));
        assert.equal(links.length, 7);
        for (const link of links) {
          assert(link.href.startsWith("/tools/"));
          assert.equal(link.target, null);
        }

        for (const link of links.filter((item) => item.href !== "/tools/visualization")) {
          await page.goto(`${base}/tools`);
          await page.waitForLoadState("networkidle");
          const card = page.locator("article").filter({ has: page.locator(`a[href="${link.href}"]`) });
          await card.getByRole("button", { name: "Preview", exact: true }).click();
          const dialog = page.getByRole("dialog");
          assert.match(await dialog.innerText(), /Runs inside the LabNest workspace/);
          await dialog.getByRole("link", { name: "Open tool", exact: true }).click();
          await page.waitForURL(new URL(link.href, base).href);
          const id = link.href.split("/")[2];
          let inner = page;
          if (["qpcr-plate-layout", "cnv-plate-layout", "qpcr-analysis", "cnv-analysis"].includes(id)) {
            const iframe = page.locator("iframe");
            await iframe.waitFor();
            inner = await iframe.elementHandle().then((handle) => handle.contentFrame());
            assert(inner);
            await inner.waitForLoadState();
            assert.equal(new URL(inner.url()).origin, new URL(base).origin);
            assert.equal(new URL(inner.url()).pathname, `/tools/${id}/index.html`);
            if (id === "qpcr-plate-layout") await inner.getByLabel("批量粘贴样本", { exact: true }).waitFor();
            if (id === "cnv-plate-layout") await inner.locator("textarea.bulk-input").waitFor();
          }
          const body = await inner.locator("body").innerText();
          assert(body.length > 200, `${id} actual tool rendered`);
          assert(!body.includes("404: This page could not be found"));
          assert.equal(context.pages().length, 1, `${id} opens in the same tab`);
          assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${id} outer overflow`);
          if (id.endsWith("plate-layout")) {
            assert(await inner.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${id} inner overflow`);
            await page.screenshot({ path: path.join(out, `${engine}-${id}-${width}.png`) });
            if (width === 1440 && id !== "free-plate-layout") {
              await importNames(page, inner, id);
              checks.push({ engine, id, sampleImport: "passed" });
            }
          }
          checks.push({ engine, width, id, url: page.url(), status: "passed" });
        }
      }

      // The bundled qPCR build must support its actual import, calculation and download workflow.
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto(`${base}/tools/qpcr-plate-layout`);
      const frame = await page.locator("iframe").elementHandle().then((handle) => handle.contentFrame());
      await frame.getByRole("button", { name: "EN", exact: true }).click();
      await importNames(page, frame, "qpcr-plate-layout");
      await frame.getByRole("button", { name: "Import 2 sample names", exact: true }).click();
      await frame.getByLabel("Paste assays in bulk", { exact: true }).fill("QA_Target\nQA_Reference");
      await frame.getByRole("button", { name: /Import 2.*names/ }).click();
      await frame.getByRole("button", { name: "Change QA_Reference to reference", exact: true }).click();
      await frame.getByRole("button", { name: "Generate layout", exact: true }).click();
      await frame.getByRole("button", { name: "Confirm", exact: true }).click();
      const downloaded = page.waitForEvent("download");
      await frame.getByRole("button", { name: "Export Excel", exact: true }).click();
      const download = await downloaded;
      const workbookPath = path.join(out, `${engine}-synthetic-qpcr.xlsx`);
      await download.saveAs(workbookPath);
      const workbook = await readExcelFile(workbookPath);
      const wells = workbook.find((sheet) => sheet.sheet === "Well_Detail")?.data;
      assert(wells, "Well_Detail worksheet present");
      const sampleColumn = wells[0].findIndex((value) => String(value).includes("样本 / Sample"));
      assert(sampleColumn >= 0);
      const used = wells.slice(1).filter((row) => names.includes(row[sampleColumn]));
      assert.equal(used.length, 12, "2 samples × 2 assays × 3 technical replicates");
      for (const name of names) assert.equal(used.filter((row) => row[sampleColumn] === name).length, 6);
      await frame.getByRole("button", { name: "Save", exact: true }).click();
      await page.reload();
      const restored = page.frameLocator("iframe");
      await restored.getByRole("button", { name: "Export Excel", exact: true }).waitFor();
      assert(await restored.getByRole("button", { name: "Export Excel", exact: true }).isEnabled());
      checks.push({ engine, workflow: "English import → generate → confirm → export/readback → save/reload", usedWells: used.length, status: "passed" });

      const direct = await page.goto(`${base}/tools/qpcr-plate-layout/index.html`);
      assert.equal(direct.status(), 200);
      assert.equal(new URL(page.url()).pathname, "/tools/qpcr-plate-layout/index.html");
      await page.getByRole("button", { name: "Export Excel", exact: true }).waitFor();
      await page.goto(`${base}/tools/visualization`);
      await page.getByRole("alert").filter({ hasText: "尚未配置独立 Studio 地址" }).waitFor();
      // Finish same-origin prefetches before the harness switches to a different deployment.
      await page.waitForLoadState("networkidle");
      checks.push({ engine, studioUnconfigured: "passed", legacyQpcrHtml: "passed" });

      await page.goto(`${configuredBase}/tools`);
      await page.waitForLoadState("networkidle");
      const studioLink = page.locator(`article a[href="${studio}"]`);
      assert.equal(await studioLink.getAttribute("target"), "_blank");
      const popupPromise = page.waitForEvent("popup");
      await studioLink.click();
      const popup = await popupPromise;
      await popup.waitForLoadState();
      assert.equal(popup.url(), studio);
      await popup.close();
      await page.goto(`${configuredBase}/tools/visualization`);
      await page.waitForURL(studio);
      checks.push({ engine, studioConfigured: "catalog new tab and compatibility redirect passed", endpoint: "local fixture; validates integration only" });

      await page.goto(`${configuredBase}/tools`);
      await page.waitForLoadState("networkidle");
      const legacyKey = "labnest:visualization-studio:palette";
      const preference = JSON.stringify({ themeId: "cn-beihai" });
      await page.evaluate(([key, value]) => localStorage.setItem(key, value), [legacyKey, preference]);
      await page.goto(`${configuredBase}/tools/visualization`);
      const migrationDownload = page.waitForEvent("download");
      await page.getByRole("button", { name: "下载旧配色迁移文件", exact: true }).click();
      const migration = await migrationDownload;
      const migrationPath = path.join(out, `${engine}-synthetic-preferences.json`);
      await migration.saveAs(migrationPath);
      const exported = JSON.parse(await readFile(migrationPath, "utf8"));
      assert.deepEqual(exported.preferences[legacyKey], JSON.parse(preference));
      assert.equal(await page.evaluate((key) => localStorage.getItem(key), legacyKey), preference);
      assert.equal(new URL(page.url()).pathname, "/tools/visualization");
      await page.getByRole("link", { name: "Back to tools", exact: true }).click();
      await page.waitForURL(`${configuredBase}/tools`);
      await page.waitForLoadState("networkidle");
      checks.push({ engine, studioLegacyPreferences: "exported without clearing storage; return to Tools passed" });
    } finally {
      await browser.close();
    }
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(externalRequests, []);
} finally {
  await writeFile(path.join(out, "report.json"), JSON.stringify({ base, configuredBase, checks, errors, externalRequests }, null, 2));
}
console.log(`Passed ${checks.length} browser checks; no external requests or page errors.`);
