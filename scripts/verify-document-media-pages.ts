import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { prisma } from "../src/lib/db";
import { createExperimentWithProtocolSnapshot } from "../src/lib/experiments";
import { createScientificDocument, experimentSections, resultSections, reportSections } from "../src/lib/scientific-document";
import { buildEntryContent } from "../src/lib/entry-content";

async function main() {
  assert(process.env.DATABASE_URL?.includes("/labnest_media63_acceptance"), "Use the isolated media acceptance database.");
  const base = "http://127.0.0.1:3211";
  const plan = await prisma.researchPlan.findFirst({ where: { projectId: "media63-project" }, orderBy: { createdAt: "desc" } }); assert(plan);
  const version = await prisma.protocolVersion.findFirst({ where: { protocol: { canonicalTitle: { startsWith: "Media PRT-" } } }, orderBy: { createdAt: "desc" } }); assert(version);
  const experiment = await createExperimentWithProtocolSnapshot({ researchPlanId: plan.id, title: "Media acceptance experiment", date: new Date(), status: "planned", recordStatus: "draft", methodMode: "protocol", protocolVersionIds: [version.id], customSteps: [], tags: [], contentJson: createScientificDocument(experimentSections) });
  const result = await prisma.result.create({ data: { experimentId: experiment.id, title: "Media acceptance result", resultType: "media_acceptance", contentJson: createScientificDocument(resultSections) } });
  const report = await prisma.report.create({ data: { projectId: "media63-project", title: "Media acceptance report", contentJson: createScientificDocument(reportSections) } });
  const entry = await prisma.entry.create({ data: { title: "Media acceptance entry", body: "Before image", occurredAt: new Date(), contentJson: buildEntryContent("Before image", []) } });
  const cases = [
    { name: "Protocol", edit: `/protocols/${version.protocolId}/versions/${version.id}/edit`, save: "Save Protocol" },
    { name: "Experiment", edit: `/experiments/${experiment.id}/edit`, save: "Save Experiment" },
    { name: "Result", edit: `/results/${result.id}/edit`, save: "Save Result" },
    { name: "Report", edit: `/reports/${report.id}/edit`, save: "Save Report" },
    { name: "Entry", edit: `/entries/${entry.id}/edit`, save: "Save changes" },
  ];
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    for (const item of cases) {
      const filename = `${item.name}-${Date.now()}.png`;
      await page.goto(`${base}${item.edit}`, { waitUntil: "networkidle" });
      const body = page.locator('[contenteditable="true"]').first(); await body.click();
      await body.evaluate((element, filename) => {
        const canvas = document.createElement("canvas"); canvas.width = 40; canvas.height = 30; canvas.getContext("2d")!.fillRect(0, 0, 40, 30);
        const data = new DataTransfer(); data.items.add(new File([Uint8Array.from(atob(canvas.toDataURL().split(",")[1]), c => c.charCodeAt(0))], filename, { type: "image/png" }));
        element.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
      }, filename);
      const image = page.getByRole("img", { name: filename, exact: true }); await image.waitFor();
      await page.waitForFunction(filename => [...document.images].some(img => img.alt === filename && img.src.includes("/api/attachments/") && img.complete && img.naturalWidth > 0), filename);
      await page.getByRole("button", { name: item.save, exact: true }).click();
      await page.waitForURL(url => !url.pathname.endsWith("/edit"));
      await page.reload({ waitUntil: "networkidle" });
      await page.getByRole("img", { name: filename, exact: true }).first().waitFor();
      await page.goto(`${base}${item.edit}`, { waitUntil: "networkidle" });
      await page.getByRole("img", { name: filename, exact: true }).first().waitFor();
      console.log(`PASS ${item.name}: paste, save, refresh, read-only, re-edit`);
    }
    await page.goto(`${base}/experiments/${experiment.id}/run`, { waitUntil: "networkidle" });
    await page.getByRole("img", { name: "Media acceptance fixture", exact: true }).first().waitFor();
    console.log("PASS Run: image in detached Protocol snapshot");
    await page.goto(`${base}/experiments/${experiment.id}/edit`, { waitUntil: "networkidle" });
    const media = page.locator("[data-document-media]").first();
    const original = await media.getByRole("link", { name: "查看原图 / Open original", exact: true }).getAttribute("href"); assert(original);
    await media.getByRole("textbox", { name: "图注 / Caption", exact: true }).fill("Replacement caption");
    await media.getByRole("spinbutton", { name: "图片显示宽度百分比 / Image width percent", exact: true }).fill("60");
    const replacement = page.waitForEvent("filechooser");
    await media.getByRole("button", { name: "替换附件 / Replace attachment", exact: true }).click();
    await (await replacement).setFiles({ name: "Replacement.png", mimeType: "image/png", buffer: readFileSync("public/icons/lab-soft-v1/solution-prep.png") });
    await page.waitForFunction(old => [...document.querySelectorAll<HTMLAnchorElement>('[data-document-media] a')].some(link => link.getAttribute("href")?.startsWith("/api/attachments/") && link.getAttribute("href") !== old), original);
    await page.getByRole("button", { name: "Save Experiment", exact: true }).click();
    await page.waitForURL(url => !url.pathname.endsWith("/edit"));
    await page.goto(`${base}/experiments/${experiment.id}/edit`, { waitUntil: "networkidle" });
    assert.equal(await media.getByRole("textbox", { name: "图注 / Caption", exact: true }).inputValue(), "Replacement caption");
    assert.equal(await media.getByRole("spinbutton", { name: "图片显示宽度百分比 / Image width percent", exact: true }).inputValue(), "60");
    console.log("PASS replace image, caption/width persist, original retained");
    await media.getByRole("button", { name: "移除引用 / Remove reference", exact: true }).click();
    await page.getByRole("button", { name: "Save Experiment", exact: true }).click();
    await page.waitForURL(url => !url.pathname.endsWith("/edit"));
    await page.reload({ waitUntil: "networkidle" });
    assert.equal((await page.request.get(new URL(original, base).toString())).status(), 200, "Removing the image does not delete its original");
    console.log("PASS remove image reference, save/reload, original remains available");
  } finally { await browser.close(); await prisma.$disconnect(); }
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
