import assert from "node:assert/strict";
import { chromium } from "playwright";
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:3211/research-plans/new", { waitUntil: "networkidle" });
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route("**/api/attachments", async route => {
    if (route.request().method() === "POST") await gate;
    await route.continue();
  });
  const editor = page.locator('[contenteditable="true"]').first(); await editor.click();
  await editor.evaluate(element => {
    const canvas = document.createElement("canvas"); canvas.width = 40; canvas.height = 30;
    const bytes = Uint8Array.from(atob(canvas.toDataURL().split(",")[1]), c => c.charCodeAt(0));
    const transfer = new DataTransfer();
    for (const name of ["first.png", "second.png"]) transfer.items.add(new File([bytes], name, { type: "image/png" }));
    const rect = element.getBoundingClientRect();
    element.dispatchEvent(new DragEvent("drop", { dataTransfer: transfer, bubbles: true, cancelable: true, clientX: rect.left + 20, clientY: rect.top + 20 }));
  });
  await page.getByRole("textbox", { name: "图注 / Caption", exact: true }).first().fill("Caption written during upload");
  await editor.click(); await editor.press("ControlOrMeta+End"); await editor.press("Enter"); await editor.pressSequentially("Text written during upload");
  release();
  await page.waitForFunction(() => document.querySelectorAll('[data-document-media] img[src*="/api/attachments/"]').length === 2);
  assert.deepEqual(await page.locator('[data-document-media] img').evaluateAll(images => images.map(image => image.alt)), ["Caption written during upload", "second.png"]);
  assert.equal(await page.getByRole("textbox", { name: "图注 / Caption", exact: true }).first().inputValue(), "Caption written during upload");
  assert((await editor.innerText()).includes("Text written during upload"));
  console.log("PASS multi-image drop keeps order, caption and continued typing during upload");
} finally { await browser.close(); }
