import assert from "node:assert/strict";
import { chromium } from "playwright";

const baseUrl = process.env.LABNEST_E2E_BASE_URL ?? "http://127.0.0.1:3219";
const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(10_000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });

  const response = await page.goto(baseUrl, { waitUntil: "networkidle" });
  assert(response && response.status() < 400, `Overview returned ${response?.status() ?? "no response"}.`);

  const mobileNav = page.getByRole("navigation", { name: "Mobile navigation" });
  await mobileNav.waitFor();
  assert.deepEqual(
    await mobileNav.locator("a, button").allTextContents(),
    ["Today", "Runs", "Records", "Inventory", "More"],
    "Mobile navigation must use task-oriented Bench Mode destinations.",
  );

  await page.getByRole("heading", { name: "Today at the bench" }).waitFor();
  await page.getByRole("link", { name: /Quick capture/i }).waitFor();
  await page.getByRole("heading", { name: "Today’s plan" }).waitFor();
  await page.getByRole("link", { name: /Quick capture/i }).click();
  await page.getByRole("heading", { name: "Quick capture" }).waitFor();
  await page.getByPlaceholder("What did you observe?").waitFor();
  await page.getByPlaceholder("Title is generated automatically · optional").waitFor();
  await page.getByRole("button", { name: "Take photo", exact: true }).waitFor();
  await page.goBack({ waitUntil: "networkidle" });
  await page.getByRole("link", { name: "Open monthly calendar" }).click();
  await page.getByRole("heading", { name: "Calendar" }).waitFor();
  await page.getByRole("link", { name: "Back to Today" }).click();
  await page.getByRole("heading", { name: "Today at the bench" }).waitFor();
  await mobileNav.getByRole("button", { name: "Open more navigation" }).click();
  await page.getByRole("group", { name: "Switch language" }).waitFor();
  await page.getByRole("dialog", { name: "All modules" }).getByRole("button", { name: "Close menu" }).click();
  await mobileNav.getByRole("link", { name: "Records" }).click();
  await page.getByRole("heading", { name: "Records" }).waitFor();
  const experimentRecord = page.locator('main a[href^="/experiments/"]').first();
  assert.equal(await experimentRecord.count(), 1, "Seeded journey requires at least one Experiment record.");
  const experimentHref = await experimentRecord.getAttribute("href");
  assert(experimentHref, "Experiment record must have a destination.");
  assert.deepEqual(errors, [], `Browser errors after opening Records: ${errors.join("\n")}`);
  await mobileNav.getByRole("link", { name: "Inventory" }).click();
  await page.getByRole("heading", { name: "Inventory at the bench" }).waitFor();
  await page.getByRole("button", { name: "Scan barcode" }).waitFor();
  await page.getByRole("textbox", { name: "Search inventory" }).waitFor();
  assert.equal(await page.getByRole("table").isVisible().catch(() => false), false, "Mobile Inventory must not expose the desktop DataTable.");
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Today at the bench" }).waitFor();
  assert.equal(await page.locator(".overview-desktop").isHidden(), true, "Desktop Overview must be hidden on a phone.");

  const layout = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    smallestTarget: Math.min(...[...document.querySelectorAll("nav[aria-label='Mobile navigation'] a, nav[aria-label='Mobile navigation'] button, main a, main button")]
      .filter((element) => element.getClientRects().length)
      .map((element) => element.getBoundingClientRect().height)),
  }));
  assert(layout.scrollWidth <= layout.clientWidth + 1, `Mobile Bench page overflows: ${layout.scrollWidth}px > ${layout.clientWidth}px.`);
  assert(layout.smallestTarget >= 44, `Visible Bench actions must be at least 44px high; found ${layout.smallestTarget}px.`);
  assert.deepEqual(errors, [], `Browser errors: ${errors.join("\n")}`);

  await page.goto(`${baseUrl}/protocol-run`, { waitUntil: "networkidle" });
  const firstRun = page.locator('main a[href$="/run"]').first();
  if (await firstRun.count()) {
    await firstRun.click();
    await page.getByRole("heading", { name: "Current step" }).waitFor();
    await page.getByRole("button", { name: "Complete step" }).waitFor();
    await page.getByRole("region", { name: "Step timer" }).waitFor();
    await page.getByText("Record a deviation", { exact: true }).click();
    await page.getByLabel("Deviation type").waitFor();
    await page.getByLabel("Impact assessment").waitFor();
    await page.getByRole("button", { name: "Measurement", exact: true }).click();
    const measurementDialog = page.getByRole("dialog", { name: "Record measurement" });
    await measurementDialog.getByLabel("Value *").waitFor();
    await measurementDialog.getByLabel("Unit *").waitFor();
    await measurementDialog.getByLabel("Observed at *").waitFor();
    await measurementDialog.getByRole("button", { name: "Close measurement" }).click();
    await page.getByText(/Linked to Step/).first().waitFor();
    await page.getByRole("button", { name: "All steps", exact: true }).first().click();
    await page.getByRole("dialog", { name: "All steps" }).waitFor();
    await page.getByRole("button", { name: "Close all steps" }).last().click();
    assert.equal(
      await page.getByText("Whole block", { exact: false }).isVisible().catch(() => false),
      false,
      "Mobile run focus must not expose bulk group completion by default.",
    );
  }

  await page.goto(`${baseUrl}${experimentHref}/run`, { waitUntil: "networkidle" });
  const allStepsButton = page.getByRole("button", { name: "All steps", exact: true }).last();
  await allStepsButton.waitFor();
  await allStepsButton.click();
  await page.getByRole("dialog", { name: "All steps" }).waitFor();
  assert.equal(await page.getByText("Whole block", { exact: false }).isVisible().catch(() => false), false, "All Steps sheet must list individual steps, not bulk group completion.");

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Overview" }).waitFor();
  assert.equal(await page.locator(".bench-mobile").isHidden(), true, "Bench Mode must not replace desktop Overview.");

  console.log("Mobile Bench Mode shell and Today journey passed.");
} finally {
  await browser.close();
}
