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
  const newSequenceHref = await page.getByRole("link", { name: "New Sequence", exact: true }).getAttribute("href");
  if (newSequenceHref !== "/sequences/new") throw new Error(`${name}: New Sequence still bypasses the type chooser`);
  const firstPairHref = await pairLinks.first().getAttribute("href");
  if (!firstPairHref) throw new Error(`${name}: pair detail link is missing`);
  await page.screenshot({ path: `${outputDir}/${name}-sequences.png`, fullPage: true });
  await page.goto(`${baseUrl}${firstPairHref}`, { waitUntil: "networkidle" });
  const pairPanels = await page.getByText(/Forward primer|Sense strand/, { exact: true }).count();
  if (pairPanels !== 1) throw new Error(`${name}: paired detail did not expose exactly one first-member panel`);
  await page.screenshot({ path: `${outputDir}/${name}-pair-detail.png`, fullPage: true });
  await page.goto(`${baseUrl}/sequences/new`, { waitUntil: "networkidle" });
  if (!await page.getByRole("heading", { name: "What are you recording?" }).count()) throw new Error(`${name}: sequence type chooser is missing`);
  if (!await page.getByRole("link", { name: /Primer/ }).count()) throw new Error(`${name}: Primer is not a first-class category`);
  if (!await page.getByRole("link", { name: /CRISPR guide/ }).count()) throw new Error(`${name}: CRISPR guide category is missing`);
  await page.screenshot({ path: `${outputDir}/${name}-type-chooser.png`, fullPage: true });
  await page.getByRole("link", { name: /Primer/ }).first().click();
  await page.waitForURL(/category=primer/);
  await page.waitForLoadState("networkidle");
  if (!await page.getByRole("heading", { name: "New primer pair" }).count()) throw new Error(`${name}: primer-pair creation form is missing`);
  if (!await page.getByRole("link", { name: "Single primer · advanced" }).count()) throw new Error(`${name}: advanced single-primer route is missing`);
  if (!await page.getByLabel("Gene name *").count()) throw new Error(`${name}: primer-specific gene identity field is missing`);
  if (!await page.getByText("Upstream primer sequence (Forward)", { exact: true }).count()) throw new Error(`${name}: upstream primer prompt is missing`);
  if (!await page.getByText("Downstream primer sequence (Reverse)", { exact: true }).count()) throw new Error(`${name}: downstream primer prompt is missing`);
  if (await page.getByText("Pair name *", { exact: true }).count()) throw new Error(`${name}: the old pair-name field is still visible`);
  if (!await page.getByLabel("Application").count()) throw new Error(`${name}: primer application field is missing`);
  if (!await page.getByText("Tm difference", { exact: false }).count()) throw new Error(`${name}: primer pair Tm difference is missing`);
  await page.screenshot({ path: `${outputDir}/${name}-pair-create.png`, fullPage: true });
  await page.goto(`${baseUrl}/sequences/new?category=single-primer`, { waitUntil: "networkidle" });
  const singlePrimerTypes = await page.locator('select[name="designType"] option').evaluateAll((options) => options.map((option) => option.value));
  if (JSON.stringify(singlePrimerTypes) !== JSON.stringify(["primer"])) throw new Error(`${name}: advanced single primer is not locked to Primer`);
  await page.goto(`${baseUrl}/sequences/new?category=sirna-duplex`, { waitUntil: "networkidle" });
  if (!await page.getByLabel("Target gene *").count()) throw new Error(`${name}: siRNA-specific target prompt is missing`);
  if (!await page.getByText("Sense strand sequence", { exact: true }).count()) throw new Error(`${name}: siRNA sense-strand prompt is missing`);
  if (!await page.locator('textarea[placeholder="GCUACU…dTdT"]').count()) throw new Error(`${name}: siRNA sequence example is missing`);
  await page.screenshot({ path: `${outputDir}/${name}-sirna-create.png`, fullPage: true });
  await page.goto(`${baseUrl}/sequences/new?category=dna-rna`, { waitUntil: "networkidle" });
  if (!await page.locator('input[placeholder="FBN2 CDS fragment"]').count()) throw new Error(`${name}: DNA/RNA fragment name prompt is missing`);
  if (!await page.getByLabel("DNA sequence (5′ → 3′) *").count()) throw new Error(`${name}: DNA sequence-direction prompt is missing`);
  if (await page.locator('input[name="displayVersion"]').inputValue() !== "1.0") throw new Error(`${name}: a new sequence does not start at version 1.0`);
  const nucleicAcidTypes = await page.locator('select[name="designType"] option').evaluateAll((options) => options.map((option) => option.value));
  if (JSON.stringify(nucleicAcidTypes) !== JSON.stringify(["plasmid", "fragment", "other"])) throw new Error(`${name}: DNA/RNA design types are not properly scoped`);
  await page.locator('select[name="designType"]').selectOption("plasmid");
  if (!await page.locator('input[placeholder="pLenti-FBN2"]').count()) throw new Error(`${name}: Plasmid-specific prompt did not update with design type`);
  if (!await page.getByText("Insert / construct", { exact: true }).count()) throw new Error(`${name}: Plasmid insert prompt did not update with design type`);
  await page.screenshot({ path: `${outputDir}/${name}-plasmid-create.png`, fullPage: true });
  await page.goto(`${baseUrl}/sequences/new?category=amino-acid`, { waitUntil: "networkidle" });
  if (!await page.locator('input[placeholder="FBN2 protein construct"]').count()) throw new Error(`${name}: protein-specific name prompt is missing`);
  if (!await page.getByLabel("Amino acid sequence (N → C) *").count()) throw new Error(`${name}: protein sequence-direction prompt is missing`);
  const aminoAcidTypes = await page.locator('select[name="designType"] option').evaluateAll((options) => options.map((option) => option.value));
  if (JSON.stringify(aminoAcidTypes) !== JSON.stringify(["peptide", "protein", "other"])) throw new Error(`${name}: amino-acid design types are not properly scoped`);
  await page.screenshot({ path: `${outputDir}/${name}-protein-create.png`, fullPage: true });
  await page.goto(`${baseUrl}/sequences/new?category=probe-oligo`, { waitUntil: "networkidle" });
  if (!await page.locator('input[placeholder="FBN2 TaqMan probe"]').count()) throw new Error(`${name}: probe-specific name prompt is missing`);
  const oligoTypes = await page.locator('select[name="designType"] option').evaluateAll((options) => options.map((option) => option.value));
  if (JSON.stringify(oligoTypes) !== JSON.stringify(["probe", "oligo", "other"])) throw new Error(`${name}: Probe / oligo design types are not properly scoped`);
  await page.screenshot({ path: `${outputDir}/${name}-oligo-create.png`, fullPage: true });
  await page.goto(`${baseUrl}/sequences/new?category=crispr-guide`, { waitUntil: "networkidle" });
  if (!await page.locator('select[name="designType"] option[value="gRNA"]').count()) throw new Error(`${name}: CRISPR guide form is not locked to gRNA`);
  if (!await page.getByText("PAM", { exact: true }).count()) throw new Error(`${name}: CRISPR PAM field is missing`);
  await page.goto(`${baseUrl}/sequences/new?category=shrna`, { waitUntil: "networkidle" });
  if (!await page.locator('select[name="designType"] option[value="shRNA"]').count()) throw new Error(`${name}: shRNA form is not locked to shRNA`);
  if (!await page.getByText("Loop sequence", { exact: true }).count()) throw new Error(`${name}: shRNA loop field is missing`);
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
