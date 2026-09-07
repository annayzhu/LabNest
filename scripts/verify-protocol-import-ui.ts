import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { exportProtocolDocx } from "../src/lib/protocol-docx-export";
import { createProtocolTemplateDocument } from "../src/lib/protocol-document";
import { prisma } from "../src/lib/db";

assert(process.env.DATABASE_URL?.includes("/labnest_import60_acceptance"));
const base = "http://127.0.0.1:3210";
const output = "/private/tmp/labnest-import60-qa";
async function main() {
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const version = await prisma.protocolVersion.findFirstOrThrow({ where: { sourceFileName: { endsWith: "_Draft.docx" }, protocol: { canonicalTitle: { startsWith: "Import acceptance" } } }, orderBy: { createdAt: "desc" } });
  const bytes = exportProtocolDocx({ humanCode: "PRT-999998", canonicalTitle: "状态确认示例 / Import state confirmation", scope: "general", availability: "active", reviewStage: "reviewed", displayVersion: "0.1", tags: [] }, createProtocolTemplateDocument());
  try {
    for (const [locale, width, height] of [["zh", 1440, 1000], ["en", 390, 844]] as const) {
      const context = await browser.newContext({ viewport: { width, height } });
      await context.addCookies([{ name: "labnest_locale", value: locale, url: base }]);
      const page = await context.newPage();
      const errors: string[] = []; page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${base}/protocols/import`, { waitUntil: "networkidle" });
      await page.locator('input[type="file"]').setInputFiles({ name: "PRT-999998_状态确认_v0.1_Draft.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: Buffer.from(bytes) });
      const [response] = await Promise.all([
        page.waitForResponse((item) => item.url().endsWith("/protocols/preview")),
        page.getByRole("button", { name: locale === "zh" ? "预览字段映射" : "Preview mapping", exact: true }).click(),
      ]);
      assert.equal(response.status(), 200);
      const notice = page.locator("[data-protocol-import-decision]");
      await notice.waitFor(); await notice.scrollIntoViewIfNeeded();
      assert(await notice.getByText(locale === "zh" ? "文件状态不一致" : "File state declarations differ", { exact: true }).isVisible());
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "No horizontal overflow");
      await page.screenshot({ path: `${output}/${locale}-${width}-preview.png` });
      await page.goto(`${base}/protocols/${version.protocolId}/versions/${version.id}/edit`, { waitUntil: "networkidle" });
      await page.getByRole("tab", { name: locale === "zh" ? "元数据" : "Metadata", exact: true }).click();
      const history = page.locator("[data-protocol-import-history]");
      assert.equal(await history.getAttribute("open"), null);
      await history.locator(":scope > summary").click(); await history.scrollIntoViewIfNeeded();
      await history.evaluate(async (element) => { await Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished.catch(() => undefined))); });
      assert(await history.getByText(locale === "zh" ? "导入时发现状态不一致，已按草稿导入。" : "State declarations differed at import; imported as Draft.", { exact: true }).isVisible());
      await page.screenshot({ path: `${output}/${locale}-${width}-history.png` });
      assert.deepEqual(errors, []);
      await context.close();
    }
    console.log(`Bilingual desktop/mobile UI passed; screenshots: ${output}`);
  } finally { await browser.close(); await prisma.$disconnect(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
