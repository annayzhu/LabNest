import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.env.LABNEST_E2E_BASE_URL ?? "http://127.0.0.1:3010";
assert(/:(3010|3011|3002)$/.test(base), "Only the isolated acceptance service is allowed.");
const output = ".local-runtime/collections-20261104";
const f = JSON.parse(await readFile(`${output}/fixtures.json`, "utf8"));
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addCookies([{ name: "labnest_locale", value: "en", url: base }]);
const page = await context.newPage();
page.setDefaultTimeout(30000);
const errors = [];
page.on("pageerror", error => errors.push(error.message));
const checks = [];
const drawer = () => page.locator("dialog.ln-bulk-drawer");
async function go(route) {
  const response = await page.goto(`${base}${route}`, { waitUntil: "networkidle", timeout: 120000 });
  assert(response?.ok(), `${route}: ${response?.status()}`);
}
async function select(ids) {
  for (const id of ids) await page.locator(`input.selection-checkbox[value="${id}"]`).check();
  await page.locator(".ln-bulk-selection-count").filter({ hasText: `${ids.length} selected` }).waitFor();
}
async function done() {
  await drawer().getByRole("button", { name: "Confirm changes", exact: true }).click();
  await drawer().getByRole("status").filter({ hasText: "Completed:" }).waitFor();
  await drawer().getByRole("button", { name: "Close", exact: true }).last().click();
}
try {
  for (const [module, id] of [["projects", f.projectId], ["research-plans", f.planId], ["protocols", f.protocolId], ["experiments", f.experimentId], ["results", f.resultId]]) {
    await go(`/${module}`); await select([id]);
    await page.getByRole("button", { name: "Modify…", exact: true }).click();
    await drawer().locator(".ln-bulk-title-list textarea").waitFor();
    const title = drawer().locator(".ln-bulk-title-list textarea").first();
    await title.fill((await title.inputValue()).replace(/(?: — UI verified(?: \d+)?)+$/, "") + ` — UI verified ${Date.now()}`);
    if (module === "experiments") assert.equal(await drawer().locator("select").count(), 1, "No execution-state editing");
    if (module === "results") {
      assert.equal(await drawer().locator("select").count(), 0, "No Result tags");
      await drawer().getByLabel("Append notes (blank leaves unchanged)").fill(`UI append ${Date.now()}`);
    }
    await drawer().getByRole("button", { name: "Preview changes", exact: true }).click();
    await drawer().locator(".ln-bulk-preview").waitFor();
    await done();
    assert.equal(new URL(page.url()).pathname, `/${module}`);
    assert.equal(await page.locator("input.selection-checkbox:checked").count(), 0);
    checks.push(`${module}: select → edit → preview → confirm → list refresh`);
  }
  await go("/results"); await select([f.resultId, f.lockedResultId]);
  await page.getByRole("button", { name: "Modify…", exact: true }).click();
  await drawer().getByLabel("Append notes (blank leaves unchanged)").fill("Mixed locked UI test");
  await drawer().getByRole("button", { name: "Preview changes", exact: true }).click();
  await drawer().getByText("Submitted or reviewed; reopen from the record page first.").waitFor();
  await done(); checks.push("Locked mix: preview skip and apply editable record only");

  await go("/projects"); await select([f.projectId]);
  await page.getByRole("button", { name: "Delete…", exact: true }).click();
  await drawer().getByText(/Linked records; archive instead/).waitFor();
  assert(await drawer().getByRole("button", { name: "Confirm changes", exact: true }).isDisabled());
  await drawer().getByLabel("Selected count confirmation").fill("1"); await done();
  await select([f.projectId]); await page.getByRole("button", { name: "Restore", exact: true }).click();
  await drawer().getByRole("button", { name: "Confirm changes", exact: true }).waitFor(); await done();
  checks.push("Delete fallback visibly requires count; archived Project restores without archiving descendants");

  await go("/projects?q=500");
  assert.equal(await page.locator("input.selection-checkbox").count(), 500);
  await page.getByRole("checkbox", { name: "Select all rows in this list", exact: true }).check();
  await page.locator(".ln-bulk-selection-count").filter({ hasText: "500 selected" }).waitFor();
  await page.getByRole("button", { name: "Modify…", exact: true }).click();
  await drawer().locator(".ln-bulk-title-list label").last().waitFor();
  assert.equal(await drawer().locator(".ln-bulk-title-list label").count(), 500);
  await page.screenshot({ path: `${output}/drawer-500.png` });
  await drawer().getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Clear selection", exact: true }).click();
  assert.equal(await page.locator("input.selection-checkbox:checked").count(), 0);
  checks.push("500 selected records load in a single-scroller drawer; clear resets header checkbox");

  await select([f.manyIds[0]]);
  const search = page.locator('input[type="search"][name="q"]');
  await search.fill("NoSyntheticMatch"); await search.press("Enter");
  await page.waitForURL(/q=NoSyntheticMatch/);
  assert.equal(await page.locator("input.selection-checkbox:checked").count(), 0);
  checks.push("Changing search clears hidden selection");

  await go("/projects"); await page.getByRole("checkbox", { name: "Select all rows in this list", exact: true }).check();
  await page.getByRole("alert").filter({ hasText: "at most 500" }).waitFor();
  assert(await page.getByRole("button", { name: "Modify…", exact: true }).isDisabled());
  await page.getByRole("button", { name: "Clear selection", exact: true }).click();
  checks.push("Over 500 rejected visibly; no silent truncation");

  await select([f.projectId]);
  await page.getByRole("button", { name: "Import / Export", exact: true }).click();
  assert.equal(await page.getByRole("menuitem").filter({ hasText: "Export selected" }).count(), 0);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await page.waitForURL(/\/projects\/export/);
  assert(new URL(page.url()).searchParams.getAll("id").includes(f.projectId));
  checks.push("Selected export has one entry and carries only selected IDs");
  assert.deepEqual(errors, [], "No browser errors");
  await writeFile(`${output}/ui-results.json`, JSON.stringify({ base, checks, errors }, null, 2));
  console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
} finally { await browser.close(); }
