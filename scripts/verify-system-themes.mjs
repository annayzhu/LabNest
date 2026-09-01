import { chromium } from "playwright";

const baseUrl = process.env.LABNEST_E2E_BASE_URL ?? "http://127.0.0.1:3100";
const expectedThemes = {
  "moon-dai": ["rgb(165, 68, 27)", "rgb(255, 255, 255)"],
  "azure-coral": ["rgb(222, 117, 101)", "rgb(43, 24, 21)"],
  "celadon-pine": ["rgb(152, 101, 36)", "rgb(255, 255, 255)"],
  "lotus-ink": ["rgb(122, 163, 90)", "rgb(21, 33, 15)"],
  "indigo-xiangqi": ["rgb(248, 196, 113)", "rgb(47, 36, 14)"],
  "palace-jasmine": ["rgb(239, 71, 93)", "rgb(44, 16, 21)"],
  "ganqing-buddha": ["rgb(254, 215, 26)", "rgb(31, 42, 68)"],
};

function luminance(rgb) {
  const channels = rgb.match(/\d+/g).slice(0, 3).map((value) => Number(value) / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
}

function contrastRatio(first, second) {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((left, right) => right - left);
  return (lighter + 0.05) / (darker + 0.05);
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`${baseUrl}/settings`);
  const options = page.locator(".system-theme-option");
  if (await options.count() !== Object.keys(expectedThemes).length) throw new Error(`Expected ${Object.keys(expectedThemes).length} system themes, found ${await options.count()}.`);

  for (const [themeId, expected] of Object.entries(expectedThemes)) {
    await page.locator(`.system-theme-option:has(input[value="${themeId}"])`).click();
    await page.waitForFunction((id) => document.documentElement.dataset.labnestTheme === id || (id === "moon-dai" && !document.documentElement.dataset.labnestTheme), themeId);
    await page.waitForFunction(([background, foreground]) => {
      const current = document.querySelector('aside .sidebar-nav-item[aria-current="page"]');
      if (!current) return false;
      const style = getComputedStyle(current);
      return style.backgroundColor === background && style.color === foreground;
    }, expected);
    const current = page.locator('aside .sidebar-nav-item[aria-current="page"]');
    const styles = await current.evaluate((element) => {
      const style = getComputedStyle(element);
      return { background: style.backgroundColor, color: style.color, weight: Number(style.fontWeight) };
    });
    if (styles.background !== expected[0] || styles.color !== expected[1]) throw new Error(`${themeId} sidebar collision colors did not apply: ${JSON.stringify(styles)}`);
    if (styles.weight < 600) throw new Error(`${themeId} active sidebar label was not bold: ${styles.weight}`);
    if (contrastRatio(styles.background, styles.color) < 4.5) throw new Error(`${themeId} active sidebar contrast was below WCAG AA.`);
  }

  await page.reload();
  await page.waitForFunction(() => document.querySelector('input[name="system-theme"][value="ganqing-buddha"]')?.checked === true);
  await page.screenshot({ path: "/tmp/labnest-system-themes-desktop.png", fullPage: true });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.goto(`${baseUrl}/settings`);
  if ((await mobile.locator("body").evaluate((body) => body.scrollWidth > window.innerWidth))) throw new Error("System themes overflow the 390px mobile viewport.");
  await mobile.screenshot({ path: "/tmp/labnest-system-themes-mobile.png", fullPage: true });
  console.log("System theme browser seam passed: seven palettes, contrasting sidebar selection, AA text contrast, persistence, and mobile fit.");
} finally {
  await browser.close();
}
