import assert from "node:assert/strict";
import { chromium, devices } from "playwright";

const base = "http://127.0.0.1:3211";
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ ...devices["iPhone 13"] });
  await page.goto(`${base}/entries/new?mode=capture`, { waitUntil: "networkidle" });
  const editor = page.locator('[contenteditable="true"]:visible').first();
  await editor.fill("Mobile media acceptance observation");
  await editor.press("End");
  await editor.press("Enter");
  let attempts = 0;
  await page.route("**/api/attachments", async route => {
    if (route.request().method() === "POST" && attempts++ === 0) {
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Acceptance: retry upload" }) });
    } else await route.continue();
  });
  await editor.evaluate(element => {
    const canvas = document.createElement("canvas"); canvas.width = 40; canvas.height = 30;
    const bytes = Uint8Array.from(atob(canvas.toDataURL().split(",")[1]), c => c.charCodeAt(0));
    const transfer = new DataTransfer(); transfer.items.add(new File([bytes], "mobile-photo.png", { type: "image/png" }));
    element.dispatchEvent(new ClipboardEvent("paste", { clipboardData: transfer, bubbles: true, cancelable: true }));
  });
  await page.getByRole("button", { name: "重试 / Retry", exact: true }).waitFor();
  assert(await page.locator('img[src^="blob:"]').count(), "Failed upload retains local preview");
  await page.getByRole("button", { name: "重试 / Retry", exact: true }).click();
  await page.waitForFunction(() => [...document.images].some(img => img.alt === "mobile-photo.png" && img.src.includes("/api/attachments/") && img.complete && img.naturalWidth > 0));
  await page.getByRole("button", { name: "Save Entry", exact: true }).click();
  await page.waitForURL(url => /\/entries\/(?!new)/.test(url.pathname));
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("img", { name: "mobile-photo.png", exact: true }).first().waitFor();
  console.log("PASS mobile-sized Quick capture: rich body, failed preview, retry, save and refresh");
} finally { await browser.close(); }
