// Read-only check of the inventory pages (docs/modules/inventory/classification-20261030): every page loads in Chinese,
// has no horizontal overflow at 1440 and 390 px, and its screenshot lands in the batch's evidence folder.
// Usage: node scripts/verify-inventory-classification.mjs [base URL] [stock item id] [product id]
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.argv[2] ?? "http://localhost:3002";
const itemId = process.argv[3] ?? "i_rneasy";
const productId = process.argv[4] ?? "p_rneasy";
const out = "docs/modules/inventory/classification-20261030/evidence";
const pages = [
  ["stock", "/inventory"],
  ["stock-item", `/inventory/${itemId}`],
  ["stock-new", "/inventory/new"],
  ["products", "/inventory/products"],
  ["product", `/inventory/products/${productId}`],
  ["product-edit", `/inventory/products/${productId}/edit`],
  ["types", "/inventory/types"],
  ["locations", "/inventory/locations"],
];

await mkdir(out, { recursive: true });
const browser = await chromium.launch();
const failures = [];
for (const [width, height] of [[1440, 900], [390, 844]]) {
  const context = await browser.newContext({ viewport: { width, height }, locale: "zh-CN" });
  await context.addCookies([{ name: "labnest_locale", value: "zh", url: base }]);
  const page = await context.newPage();
  page.on("request", (request) => { if (request.method() !== "GET") failures.push(`non-GET request ${request.method()} ${request.url()}`); });
  for (const [name, path] of pages) {
    const response = await page.goto(base + path, { waitUntil: "networkidle" });
    if (!response?.ok()) failures.push(`${path} answered ${response?.status()}`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 0) failures.push(`${path} at ${width}px overflows by ${overflow}px`);
    await page.screenshot({ path: `${out}/${name}-${width}.png`, fullPage: true });
  }
  await context.close();
}
await browser.close();
console.log(failures.length ? failures.join("\n") : `${pages.length * 2} page views loaded without overflow; screenshots in ${out}`);
process.exitCode = failures.length ? 1 : 0;
