import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium, devices } from "playwright";
import { prisma } from "../src/lib/db";
import { collectDocumentMedia } from "../src/lib/document-media";

async function main() {
  assert(process.env.DATABASE_URL?.includes("/labnest_media63_acceptance"));
  const plans = await prisma.researchPlan.findMany({ where: { projectId: "media63-project" }, orderBy: { createdAt: "desc" } });
  const plan = plans.find(plan => collectDocumentMedia(plan.contentJson).length); assert(plan);
  const output = "/private/tmp/labnest-media63-visual"; await mkdir(output, { recursive: true });
  const browser = await chromium.launch();
  try {
    const desktop = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await desktop.goto(`http://127.0.0.1:3211/research-plans/${plan.id}`, { waitUntil: "networkidle" });
    await desktop.locator(".ln-protocol-media-preview img").first().scrollIntoViewIfNeeded();
    await desktop.locator(".ln-protocol-media-preview img").first().evaluate(image => (image as HTMLImageElement).decode());
    const pdf = await desktop.pdf({ path: `${output}/research-plan.pdf`, format: "A4", printBackground: true });
    assert(pdf.toString("latin1").includes("/Subtype /Image"), "PDF contains embedded image data, not only an attachment link");
    await desktop.goto(`http://127.0.0.1:3211/research-plans/${plan.id}/edit`, { waitUntil: "networkidle" });
    await desktop.locator("[data-document-media]").first().scrollIntoViewIfNeeded();
    await desktop.screenshot({ path: `${output}/desktop-media.png` });
    const mobile = await browser.newPage({ ...devices["iPhone 13"] });
    await mobile.goto(`http://127.0.0.1:3211/research-plans/${plan.id}/edit`, { waitUntil: "networkidle" });
    await mobile.locator("[data-document-media]").first().scrollIntoViewIfNeeded();
    await mobile.screenshot({ path: `${output}/mobile-media.png` });
    console.log(`PASS actual PDF image embedding; desktop/mobile inspection images: ${output}`);
  } finally { await browser.close(); }
}
void main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
