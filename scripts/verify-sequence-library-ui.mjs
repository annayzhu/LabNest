import { chromium } from "playwright";

const baseUrl = process.env.LABNEST_VERIFY_URL ?? "http://127.0.0.1:3200";
const outputDir = process.env.LABNEST_VERIFY_OUTPUT ?? "/private/tmp/labnest-sequence-library-ui";
const browser = await chromium.launch({ headless: true });

async function verify(viewport, name) {
  const page = await browser.newPage({ viewport });
  await page.goto(`${baseUrl}/sequences`, { waitUntil: "networkidle" });
  const pairLinks = page.locator('a[href^="/sequences/pairs/"]');
  const pairCount = await pairLinks.count();
  if (pairCount !== 14) throw new Error(`${name}: expected 14 paired entries, found ${pairCount}`);
  if (await page.getByText("Forward", { exact: true }).count()) throw new Error(`${name}: a member sequence is exposed as a separate table row`);
  const firstPairHref = await pairLinks.first().getAttribute("href");
  if (!firstPairHref) throw new Error(`${name}: pair detail link is missing`);
  await page.screenshot({ path: `${outputDir}/${name}-sequences.png`, fullPage: true });
  await page.goto(`${baseUrl}${firstPairHref}`, { waitUntil: "networkidle" });
  const pairPanels = await page.getByText(/Forward primer|Sense strand/, { exact: true }).count();
  if (pairPanels !== 1) throw new Error(`${name}: paired detail did not expose exactly one first-member panel`);
  await page.screenshot({ path: `${outputDir}/${name}-pair-detail.png`, fullPage: true });
  await page.goto(`${baseUrl}/sequences/new?category=primer-pair`, { waitUntil: "networkidle" });
  if (!await page.getByRole("heading", { name: "New primer pair" }).count()) throw new Error(`${name}: primer-pair creation form is missing`);
  if (!await page.getByLabel("Gene / target name *").count()) throw new Error(`${name}: gene-first pair identity field is missing`);
  if (await page.getByText("Pair name *", { exact: true }).count()) throw new Error(`${name}: the old pair-name field is still visible`);
  await page.screenshot({ path: `${outputDir}/${name}-pair-create.png`, fullPage: true });
  await page.goto(`${baseUrl}/sequences/new?category=dna-rna`, { waitUntil: "networkidle" });
  if (await page.locator('input[placeholder="FBN2 qPCR forward primer"]').count()) throw new Error(`${name}: the old forward-primer name suggestion is still visible`);
  if (await page.locator('select[name="designType"] option[value="primer"]').count()) throw new Error(`${name}: the single-sequence form still offers Primer instead of the paired flow`);
  await page.close();
  return { name, pairCount, firstPairHref };
}

try {
  const desktop = await verify({ width: 1440, height: 1000 }, "desktop");
  const mobile = await verify({ width: 390, height: 844 }, "mobile");
  console.log(JSON.stringify({ desktop, mobile }, null, 2));
} finally {
  await browser.close();
}
