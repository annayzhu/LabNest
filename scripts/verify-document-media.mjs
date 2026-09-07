import assert from "node:assert/strict";
import { chromium } from "playwright";

const base = process.env.LABNEST_MEDIA_TEST_URL || "http://127.0.0.1:3211";
assert.equal(new URL(base).port, "3211", "Use the dedicated media acceptance deployment, not production.");
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto(`${base}/research-plans/new`, { waitUntil: "networkidle" });
  const editor = page.locator('[contenteditable="true"]').first();
  await editor.click();
  await editor.evaluate((element) => {
    const canvas = document.createElement("canvas"); canvas.width = 40; canvas.height = 30;
    canvas.getContext("2d").fillRect(0, 0, 40, 30);
    const bytes = Uint8Array.from(atob(canvas.toDataURL().split(",")[1]), c => c.charCodeAt(0));
    const data = new DataTransfer();
    data.items.add(new File([bytes], "screenshot.png", { type: "image/png" }));
    element.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  });
  await page.locator('[data-widget-type="media"] img, [data-document-media] img').first().waitFor({ timeout: 10000 });
  await page.waitForFunction(() => {
    const image = document.querySelector('[data-widget-type="media"] img, [data-document-media] img');
    return image && new URL(image.src, location.href).pathname.startsWith("/api/attachments/") && image.complete && image.naturalWidth > 0;
  });
  console.log("PASS research plan screenshot paste and stored image display");
  const uploadedSource = await page.locator('[data-document-media] img').first().getAttribute("src");
  const attachmentId = new URL(uploadedSource, base).pathname.split("/").at(-1);
  await page.getByRole("textbox", { name: "Research Plan title", exact: true }).fill(`Media acceptance ${Date.now()}`);
  await page.getByRole("tab", { name: "Metadata", exact: true }).click();
  await page.locator('select[name="projectId"]').selectOption({ index: 1 });
  await page.locator('input[name="codeSuffix"]').fill(String(Date.now()).slice(-7));
  await page.getByRole("button", { name: "Save Research Plan", exact: true }).click();
  await page.waitForURL(url => !url.pathname.endsWith("/new"));
  const recordId = new URL(page.url()).pathname.split("/").at(-1);
  await page.reload({ waitUntil: "networkidle" });
  await page.locator(`img[src*="${attachmentId}"]`).first().waitFor();
  const attachments = await (await page.request.get(`${base}/api/attachments`)).json();
  assert(attachments.attachments.find(item => item.id === attachmentId)?.links.some(link => link.targetType === "research_plan" && link.targetId === recordId), "Saved document must formally associate the uploaded attachment");
  console.log("PASS research plan save, refresh and attachment association");
  assert.equal((await page.request.get(`${base}/attachments/${attachmentId}`)).status(), 200, "The attachment preview must open");
  const attachment = attachments.attachments.find(item => item.id === attachmentId);
  assert(attachment.metadataJson.preview.storagePath, "Image previews must be stored separately from originals");
  const link = attachment.links.find(item => item.targetType === "research_plan" && item.targetId === recordId);
  const removal = await page.request.delete(`${base}/api/attachments/${attachmentId}?linkId=${link.id}`);
  assert.equal(removal.status(), 200);
  assert.equal((await removal.json()).deletedOriginal, false, "Removing a document reference must preserve its original");
  assert.equal((await page.request.get(`${base}/api/attachments/${attachmentId}`)).status(), 200);
  console.log("PASS unlink preserves the stored original");
} finally { await browser.close(); }
