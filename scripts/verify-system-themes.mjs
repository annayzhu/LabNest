import { chromium } from "playwright";

const baseUrl = process.env.LABNEST_E2E_BASE_URL ?? "http://127.0.0.1:3100";
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
  const themeIds = await options.locator('input[name="system-theme"]').evaluateAll((inputs) => inputs.map((input) => input.value));
  if (themeIds.length < 7) throw new Error(`Expected at least 7 system themes, found ${themeIds.length}.`);
  const activeBackgrounds = new Set();

  for (const themeId of themeIds) {
    await page.locator(`.system-theme-option:has(input[value="${themeId}"])`).click();
    await page.waitForFunction((id) => document.documentElement.dataset.labnestTheme === id || (id === "moon-dai" && !document.documentElement.dataset.labnestTheme), themeId);
    await page.waitForFunction(() => {
      const current = document.querySelector('aside .sidebar-nav-item[aria-current="page"]');
      if (!current) return false;
      const style = getComputedStyle(current);
      const probe = document.createElement("span");
      probe.style.color = getComputedStyle(document.documentElement).getPropertyValue("--nav-active-bg");
      document.body.append(probe);
      const expectedBackground = getComputedStyle(probe).color;
      probe.remove();
      return style.backgroundColor === expectedBackground && Number(style.fontWeight) >= 600;
    });
    const current = page.locator('aside .sidebar-nav-item[aria-current="page"]');
    const styles = await current.evaluate((element) => {
      const style = getComputedStyle(element);
      return { background: style.backgroundColor, color: style.color, weight: Number(style.fontWeight) };
    });
    activeBackgrounds.add(styles.background);
    if (styles.weight < 600) throw new Error(`${themeId} active sidebar label was not bold: ${styles.weight}`);
    if (contrastRatio(styles.background, styles.color) < 4.5) throw new Error(`${themeId} active sidebar contrast was below WCAG AA.`);
  }
  if (activeBackgrounds.size !== themeIds.length) throw new Error(`Expected each theme to use a distinct sidebar collision color, found ${activeBackgrounds.size} across ${themeIds.length} themes.`);

  await page.reload();
  await page.waitForFunction((themeId) => document.querySelector(`input[name="system-theme"][value="${themeId}"]`)?.checked === true, themeIds.at(-1));
  await page.screenshot({ path: "/tmp/labnest-system-themes-desktop.png", fullPage: true });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.goto(`${baseUrl}/settings`);
  if ((await mobile.locator("body").evaluate((body) => body.scrollWidth > window.innerWidth))) throw new Error("System themes overflow the 390px mobile viewport.");
  await mobile.screenshot({ path: "/tmp/labnest-system-themes-mobile.png", fullPage: true });
  console.log(`System theme browser seam passed: ${themeIds.length} palettes, unique contrasting sidebar selections, AA text contrast, persistence, and mobile fit.`);
} finally {
  await browser.close();
}
