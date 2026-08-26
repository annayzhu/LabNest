import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import path from "node:path";

const root = process.env.PORTABLE_TOOLS_ROOT || path.join(process.cwd(), "outputs", "portable-tools");
const mobileViewport = process.env.MOBILE === "1";
const cases = [
  ["qPCR Plate Layout Planner", "01_qPCR_Plate_Layout_Planner/Open_qPCR_Plate_Layout_Planner.html", "qPCR", "button"],
  ["CNV Plate Layout Planner", "02_CNV_Plate_Layout_Planner/index.html", "CNV", "button"],
  ["Free Plate Layout Planner", "03_Free_Plate_Layout_Planner/index.html", "自由板布局", ".well"],
  ["qPCR Analysis Studio", "04_qPCR_Analysis_Studio/index.html", "qPCR Analysis Studio", "input[type=file]"],
  ["CNV Analysis Studio", "05_CNV_Analysis_Studio/cnvtool.html", "CNV分析工具", "#file-input"],
  ["Visualization Studio", "06_Visualization_Studio/index.html", "Visualization Studio", "input[type=file]"],
];

const browser = await chromium.launch({ headless: true });
const results = [];
try {
  for (const [name, relativePath, expectedText, selector] of cases) {
    const page = await browser.newPage({ viewport: mobileViewport ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, isMobile: mobileViewport, hasTouch: mobileViewport });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    const localPath = path.join(root, relativePath);
    await page.goto(pathToFileURL(localPath).href, { waitUntil: "load" });
    await page.waitForTimeout(500);
    const bodyText = await page.locator("body").innerText();
    if (!bodyText.includes(expectedText)) throw new Error(`${name}: missing expected text ${expectedText}`);
    const controlCount = await page.locator(selector).count();
    if (controlCount < 1) throw new Error(`${name}: missing core control ${selector}`);
    if (errors.length) throw new Error(`${name}: browser errors: ${errors.join(" | ")}`);
    const layout = await page.evaluate(() => ({ viewportWidth: document.documentElement.clientWidth, pageWidth: document.documentElement.scrollWidth }));
    results.push({ name, title: await page.title(), controlCount, horizontalOverflow: Math.max(0, layout.pageWidth - layout.viewportWidth), url: pathToFileURL(localPath).href });
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify(results, null, 2));
