import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { unzipSync } from "fflate";
import { exportProtocolDocx } from "../src/lib/protocol-docx-export";
import { createProtocolTemplateDocument } from "../src/lib/protocol-document";
import { documentMediaToMarkdown } from "../src/lib/document-media";

const base = "http://127.0.0.1:3211";
async function main() {
const code = `PRT-${String(Date.now()).slice(-6)}`;
const document = createProtocolTemplateDocument();
const original = new Uint8Array(readFileSync("public/icons/lab-soft-v1/solution-prep.png"));
document.sections.find(section => section.key === "material")!.blocks = [{ id: "table-images", type: "table", rows: [["Image"], [documentMediaToMarkdown({ id: "cell", type: "media", mediaType: "image", attachmentId: "fixture", url: "", filename: "Cell.png", caption: "Table image fixture" })]] }];
const template = document.sections.find(section => section.key === "result_templates")!.blocks[0];
if (template.type === "table" && template.resultTemplate) template.resultTemplate.instructions = [{ type: "paragraph", content: [{ text: documentMediaToMarkdown({ id: "instructions", type: "media", mediaType: "image", attachmentId: "fixture", url: "", filename: "Instructions.png", caption: "Instruction fixture" }) }] }];
document.sections.find(section => section.key === "steps")!.blocks = [
  { id: "observe", type: "heading", text: "1. Observe fixture" },
  { id: "image", type: "media", mediaType: "image", url: "", attachmentId: "fixture", filename: "原图.png", caption: "Media acceptance fixture", widthPercent: 60 },
];
const bytes = exportProtocolDocx({ humanCode: code, canonicalTitle: `Media ${code}`, availability: "draft", reviewStage: "draft", displayVersion: "0.1", scope: "general", tags: [] }, document, { fixture: { bytes: original, width: 512, height: 512, extension: "png", mimeType: "image/png" } });
const source = new File([new Uint8Array(bytes).buffer], `${code}_Media_v0.1_Draft.docx`);
const form = new FormData(); form.set("file", source);
const previewResponse = await fetch(`${base}/api/structured-import/protocols/preview`, { method: "POST", body: form });
const preview = (await previewResponse.json()).preview;
assert.equal(previewResponse.status, 200); assert(preview.canImport, JSON.stringify(preview));
form.set("checksum", preview.checksum); form.set("confirmationToken", preview.confirmationToken);
const confirmation = await fetch(`${base}/api/structured-import/protocols/confirm`, { method: "POST", body: form });
const saved = await confirmation.json(); assert.equal(confirmation.status, 201, JSON.stringify(saved));
console.log("Confirmed imported document", saved.result.href);
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(`${base}${saved.result.href}`, { waitUntil: "networkidle" });
  const image = page.getByRole("img", { name: "Media acceptance fixture", exact: true });
  await image.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => [...window.document.images].some(image => image.alt === "Media acceptance fixture" && image.complete && image.naturalWidth > 0));
  console.log("Displayed step image");
  const tableImage = page.getByRole("img", { name: "Table image fixture", exact: true });
  await tableImage.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => [...window.document.images].some(image => image.alt === "Table image fixture" && image.complete && image.naturalWidth > 0));
  console.log("Displayed table image");
  const instructionImage = page.getByRole("img", { name: "Instruction fixture", exact: true });
  await instructionImage.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => [...window.document.images].some(image => image.alt === "Instruction fixture" && image.complete && image.naturalWidth > 0));
  const edit = await page.locator('a[href*="/versions/"][href$="/edit"]').first().getAttribute("href"); assert(edit);
  const json = await (await fetch(`${base}/api${edit.replace(/\/edit$/, "/json")}`)).json();
  const exported = await fetch(`${base}/api${edit.replace(/\/edit$/, "/docx")}`);
  assert.equal(exported.status, 200);
  const archive = unzipSync(new Uint8Array(await exported.arrayBuffer()));
  const images = Object.entries(archive).filter(([name]) => name.startsWith("word/media/"));
  assert.equal(images.length, 3); for (const [, bytes] of images) assert.deepEqual(bytes, original);
  const content = JSON.stringify(json);
  assert(!content.includes("importImageKey"), "Temporary Word image keys must not be persisted");
  assert(content.includes("attachmentId"));
  console.log(`PASS Word import → confirmed save → actual image → Word re-export (${saved.result.href})`);
} finally { await browser.close(); }
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
