import assert from "node:assert/strict";
import { chromium } from "playwright";
import { exportProtocolDocx, protocolDocxFilename } from "../src/lib/protocol-docx-export";
import { parseProtocolDocxBytes } from "../src/lib/protocol-docx";
import { createProtocolTemplateDocument } from "../src/lib/protocol-document";
import { prisma } from "../src/lib/db";
import { execFileSync } from "node:child_process";

// Only run writes against the dedicated acceptance database, never a user's production server.
const base = process.env.LABNEST_IMPORT_TEST_URL ?? "http://127.0.0.1:3210";
assert(new URL(base).port === "3210", "Use the isolated import acceptance server on port 3210.");
assert(process.env.DATABASE_URL?.includes("/labnest_import60_acceptance"), "Use the isolated acceptance database.");
const stamp = Date.now().toString();
const code = `PRT-${stamp.slice(-6)}`;
const document = createProtocolTemplateDocument();
document.sections.find((section) => section.key === "steps")!.blocks = [{ id: "step1", type: "checklist", items: ["Mix gently."] }];
const identity = { humanCode: code, canonicalTitle: `Import acceptance ${stamp}`, scope: "general", availability: "active", reviewStage: "reviewed", displayVersion: "0.1", tags: [] };
const bytes = exportProtocolDocx(identity, document);
const sourceName = `${code}_Import_v0.1_Draft.docx`;
function file(body: Uint8Array | string, name: string) { return new File([typeof body === "string" ? body : new Uint8Array(body).buffer], name); }
type Preview = { checksum: string; confirmationToken: string; canImport: boolean; rows: Array<{ protocolDecision: { importedAvailability: string; importedReviewStage: string; issues: Array<{ code: string }> } }> };
async function preview(source: File): Promise<Preview> {
  const data = new FormData(); data.set("file", source);
  const response = await fetch(`${base}/api/structured-import/protocols/preview`, { method: "POST", body: data });
  const result = await response.json(); assert.equal(response.status, 200, JSON.stringify(result)); return result.preview;
}
async function confirm(source: File, checked: Preview, extras: Record<string, string> = {}) {
  const data = new FormData(); data.set("file", source); data.set("checksum", checked.checksum); data.set("confirmationToken", checked.confirmationToken);
  for (const [key, value] of Object.entries(extras)) data.set(key, value);
  return fetch(`${base}/api/structured-import/protocols/confirm`, { method: "POST", body: data });
}
async function main() {
  const source = file(bytes, sourceName);
  const checked = await preview(source);
  assert.equal(checked.canImport, true, JSON.stringify(checked));
  assert.equal(checked.rows[0].protocolDecision.importedAvailability, "draft");
  assert.equal(checked.rows[0].protocolDecision.importedReviewStage, "draft");
  assert(checked.rows[0].protocolDecision.issues.some((issue) => issue.code === "PROTOCOL_AVAILABILITY_MISMATCH"));
  assert.equal((await confirm(file(bytes, sourceName.replace("Draft", "Active")), checked)).status, 409, "Renaming after preview must be rejected");
  assert.equal((await confirm(source, checked, { confirmationToken: "forged" })).status, 409);
  assert.equal((await confirm(file(new Uint8Array([...bytes, 0]), sourceName), checked)).status, 409, "Changed file bytes must be rejected");
  const committed = await confirm(source, checked, { availability: "active", reviewStage: "reviewed", actorUserId: "forged-user", importedAt: "1900-01-01" });
  const result = await committed.json(); assert.equal(committed.status, 201, JSON.stringify(result));
  const href = result.result.href;
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`${base}${href}`, { waitUntil: "networkidle" });
    const edit = await page.locator('a[href*="/versions/"][href$="/edit"]').first().getAttribute("href");
    assert(edit);
    const jsonUrl = `${base}/api${edit.replace(/\/edit$/, "/json")}`;
    const saved = await (await fetch(jsonUrl)).json();
    assert.equal(saved.protocol.availability, "draft");
    assert.equal(saved.version.reviewStage, "draft");
    assert.equal(saved.version.recordStatus, "draft");
    assert.equal(saved.importHistory[0].actorUserId, null);
    assert.equal(saved.importHistory[0].decision.issues[0].resolution, "import_as_draft");
    assert(saved.importHistory[0].importedAt.startsWith(new Date().getUTCFullYear().toString()));
    assert.equal(await page.locator('[data-protocol-import-history][open]').count(), 0);
    const historyBefore = JSON.stringify(saved.importHistory);
    await page.goto(`${base}${edit}`, { waitUntil: "networkidle" });
    await page.getByRole("tab", { name: "Metadata", exact: true }).click();
    await page.locator('input[name="availability"][value="active"]').check();
    await page.getByRole("button", { name: "Save metadata", exact: true }).click();
    await page.waitForURL(`${base}${href}`);
    const updated = await (await fetch(jsonUrl)).json();
    assert.equal(updated.protocol.availability, "active");
    assert.equal(updated.version.reviewStage, "draft");
    assert.equal(JSON.stringify(updated.importHistory), historyBefore, "Changing current state must preserve original import history");
    const exported = await fetch(jsonUrl.replace(/\/json$/, "/docx"));
    const exportName = decodeURIComponent(exported.headers.get("content-disposition")!.split("UTF-8''")[1]);
    const exportedBytes = new Uint8Array(await exported.arrayBuffer());
    const roundTrip = parseProtocolDocxBytes(exportedBytes, exportName);
    assert(exportName.endsWith("_Active.docx"));
    assert.equal(roundTrip.availability, "active");
    assert(!roundTrip.importDecision.issues.some((issue) => issue.code === "PROTOCOL_AVAILABILITY_MISMATCH"));
    assert.equal(roundTrip.importDecision.importedAvailability, "draft");
    const reimport = await preview(file(exportedBytes, exportName));
    assert(!reimport.canImport, "Reimport of the same Protocol must preserve duplicate-code protection");
    const cloneIdentity = { ...identity, humanCode: `PRT-${String((Number(code.slice(4)) + 1) % 1000000).padStart(6, "0")}`, canonicalTitle: `Round trip ${stamp}`, reviewStage: "draft" };
    const clone = file(exportProtocolDocx(cloneIdentity, roundTrip.document), protocolDocxFilename(cloneIdentity));
    const clonePreview = await preview(clone);
    assert(clonePreview.canImport);
    assert(!clonePreview.rows[0].protocolDecision.issues.some((issue) => issue.code === "PROTOCOL_AVAILABILITY_MISMATCH"));
    assert.equal((await confirm(clone, clonePreview)).status, 201);
    const batch = file(JSON.stringify([{ canonicalTitle: `Batch ${stamp} 1`, availability: "active", reviewStage: "reviewed" }, { canonicalTitle: `Batch ${stamp} 2`, availability: "Actve" }, { canonicalTitle: `Batch ${stamp} 3` }]), `batch-${stamp}.json`);
    const batchPreview = await preview(batch);
    assert(batchPreview.canImport);
    assert(batchPreview.rows.every((row) => row.protocolDecision.importedAvailability === "draft"));
    assert.equal((await confirm(batch, batchPreview)).status, 201);
    const batchSaved = await prisma.protocol.findMany({ where: { canonicalTitle: { startsWith: `Batch ${stamp}` } }, include: { versions: true } });
    assert.equal(batchSaved.length, 3);
    assert(batchSaved.every((item) => item.availability === "draft" && item.versions.every((version) => version.reviewStage === "draft")));
    const markdown = file(`---\ncanonicalTitle: Markdown ${stamp}\navailability: active\nreviewStage: reviewed\n---\n# Markdown ${stamp}\n## Steps\nMix gently.`, `protocol-${stamp}.md`);
    const markdownPreview = await preview(markdown); assert(markdownPreview.canImport);
    const concurrent = await Promise.all([confirm(markdown, markdownPreview), confirm(markdown, markdownPreview)]);
    assert.equal(concurrent.filter((response) => response.status === 201).length, 1);
    const duplicateResponse = concurrent.find((response) => response.status !== 201)!;
    assert([400, 422].includes(duplicateResponse.status));
    assert.match(JSON.stringify(await duplicateResponse.json()), /already been imported|already exists|no longer passes/i);
    assert.equal(await prisma.protocol.count({ where: { canonicalTitle: `Markdown ${stamp}` } }), 1);
    for (const [offset, availability] of [[2, "Actve"], [3, ""]] as const) {
      const invalidIdentity = { ...identity, humanCode: `PRT-${String((Number(code.slice(4)) + offset) % 1000000).padStart(6, "0")}`, availability, canonicalTitle: `Declaration ${stamp} ${offset}` };
      const declarationSource = file(exportProtocolDocx(invalidIdentity, document), `${invalidIdentity.humanCode}_State_v0.1_Draft.docx`);
      const declarationPreview = await preview(declarationSource);
      assert(declarationPreview.canImport);
      assert(!declarationPreview.rows[0].protocolDecision.issues.some((issue) => issue.code === "PROTOCOL_AVAILABILITY_MISMATCH"));
      assert.equal((await confirm(declarationSource, declarationPreview)).status, 201);
    }
    const originalText = "Filename availability draft does not match document availability active.";
    const legacyDocument = { ...document, importWarnings: [originalText, "Empty required sections: Purpose."] };
    const legacy = await prisma.protocol.create({ data: { humanCode: `LEGACY-${stamp}`, title: `Legacy ${stamp}`, canonicalTitle: `Legacy ${stamp}`, availability: "active", versions: { create: { revision: 1, title: "Legacy", contentJson: legacyDocument, sourceFileName: "old_Draft.docx", sourceFileChecksum: `legacy-${stamp}`, sourceImportedAt: new Date("2026-08-01") } } }, include: { versions: true } });
    const beforeVersion = JSON.stringify(legacy.versions[0]);
    execFileSync("node_modules/.bin/tsx", ["scripts/backfill-protocol-import-history.ts"], { env: process.env });
    const auditBefore = await prisma.activityLog.findUniqueOrThrow({ where: { id: `protocol-import-legacy:${legacy.versions[0].id}` } });
    execFileSync("node_modules/.bin/tsx", ["scripts/backfill-protocol-import-history.ts"], { env: process.env });
    assert.equal(JSON.stringify(await prisma.activityLog.findUnique({ where: { id: auditBefore.id } })), JSON.stringify(auditBefore));
    assert.equal(JSON.stringify(await prisma.protocolVersion.findUnique({ where: { id: legacy.versions[0].id } })), beforeVersion);
    assert.equal((await prisma.protocol.findUniqueOrThrow({ where: { id: legacy.id } })).availability, "active");
    await page.goto(`${base}/protocols/${legacy.id}`, { waitUntil: "networkidle" });
    assert(await page.getByText("Empty required sections: Purpose.", { exact: true }).isVisible());
    assert.equal(await page.getByText(originalText, { exact: true }).isVisible(), false);
    await page.locator('[data-protocol-import-history] > summary').click();
    assert(await page.getByText("Historical import notice; resolution needs verification.", { exact: true }).isVisible());
    assert.equal((await confirm(source, checked)).status, 422, "Duplicate source must not create another import");
    console.log(JSON.stringify({ passed: true, href, code, exportName, filename: protocolDocxFilename(identity), checks: "DOCX/batch, confirmation binding, actual persisted states/history, state change, duplicate, export round trip" }));
  } finally { await browser.close(); await prisma.$disconnect(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
