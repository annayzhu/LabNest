import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { prisma } from "../src/lib/db";
import { applyCollectionBulk, previewCollectionBulk } from "../src/lib/collection-bulk.server";
import { restoreDeletedRecord } from "../src/lib/recycle-bin";
import { structuredProtocolFixture } from "./fixtures/structured-protocol";
import { versionContent } from "../src/lib/protocol-draft.server";
import { createScientificDocument, researchPlanSections, experimentSections, resultSections, reportSections } from "../src/lib/scientific-document";
import { buildEntryContent } from "../src/lib/entry-content";

assert(new URL(process.env.DATABASE_URL!).pathname.startsWith("/labnest_test_collections_"), "Only an isolated synthetic database is allowed.");
const output = ".local-runtime/collections-20261104";
const stamp = Date.now();
const checks: string[] = [];
async function run(input: unknown, expected?: string[]) {
  const preview = await previewCollectionBulk(input);
  if (expected) assert.deepEqual(preview.rows.map(row => row.outcome), expected);
  const batchId = randomUUID();
  const count = (input as { ids: string[] }).ids.length;
  const result = await applyCollectionBulk(input, preview.token, batchId, String(count));
  assert.equal(result.applied, true);
  return { result, preview, batchId };
}
async function main() {
  await mkdir(output, { recursive: true });
  const project = await prisma.project.create({ data: { name: `合成验收项目 ${stamp} — 包含长名称、归档与关联保护的测试数据`, tags: ["合成数据"] } });
  const plan = await prisma.researchPlan.create({ data: { projectId: project.id, code: `RPL-CB-${stamp}`, title: "合成研究方案 — 保存正文与归属不变", contentJson: createScientificDocument(researchPlanSections), tags: ["原标签"] } });
  const document = structuredProtocolFixture();
  document.systems!.dimensions[1].label = "是否进行扩展记录与长条件名称可读性检查（合成测试）";
  document.systems!.dimensions.push(...Array.from({ length: 5 }, (_, i) => ({ id: `condition-${i}`, label: `是否包含第 ${i + 1} 类补充条件的合成验证记录`, kind: "condition" as const, options: [{ id: "yes", label: "是" }, { id: "no", label: "否" }] })));
  document.systems!.parameters.push({ id: "pending-range", label: "合成待选范围", unit: "µL", range: { min: { value: 1, unit: "µL" }, max: { value: 3, unit: "µL" } }, source: { kind: "fixed", value: null, unit: "µL" } });
  const protocol = await prisma.protocol.create({ data: { humanCode: `PRT-CB-${stamp}`, title: "合成多体系规程 — 长条件与范围值验收", canonicalTitle: "合成多体系规程 — 长条件与范围值验收", availability: "active", tags: ["合成数据"], versions: { create: { revision: 1, title: "Frozen synthetic version title", displayVersion: "1.0", ...versionContent(document) } } }, include: { versions: true } });
  const version = protocol.versions[0];
  await prisma.researchPlanProtocol.create({ data: { researchPlanId: plan.id, protocolId: protocol.id, isPrimary: true } });
  const experiment = await prisma.experiment.create({ data: { projectId: project.id, researchPlanId: plan.id, runCode: `EXP-CB-${stamp}`, title: "合成实验 — 含执行事实，删除应改为归档", status: "running", contentJson: createScientificDocument(experimentSections), protocolSnapshotJson: { synthetic: true, unchanged: "snapshot" }, primaryProtocolVersionId: version.id, protocolRun: { create: { protocolVersionId: version.id, status: "planned" } }, steps: { create: { order: 0, title: "合成检查", description: "合成执行记录", completed: true } } } });
  await prisma.experimentProtocolVersion.create({ data: { experimentId: experiment.id, protocolVersionId: version.id, order: 0, role: "primary" } });
  const result = await prisma.result.create({ data: { experimentId: experiment.id, researchPlanId: plan.id, projectId: project.id, title: "合成结果 — 原始数值与单位保持不变", resultType: "Observation", numericValue: 12.5, unit: "test-unit", notes: "原始备注", contentJson: createScientificDocument(resultSections), valuesJson: { syntheticValue: 12.5 } } });
  const locked = await prisma.result.create({ data: { title: "合成已审核结果 — 批量修改应跳过", resultType: "Observation", recordStatus: "reviewed", numericValue: 42, notes: "锁定备注" } });
  const oldArchive = await prisma.result.create({ data: { title: "合成历史归档结果 — 恢复需选择状态", resultType: "Observation", status: "archived" } });
  const report = await prisma.report.create({ data: { projectId: project.id, title: "合成报告", contentJson: createScientificDocument(reportSections) } });
  const entry = await prisma.entry.create({ data: { title: "合成快速记录", body: "仅用于界面验收", contentJson: buildEntryContent("仅用于界面验收", []) } });
  await prisma.inventoryItem.create({ data: { name: "合成库存材料 — 长名称与余量展示", currentQuantity: 100, unit: "mL" } });

  const baselineExperiment = await prisma.experiment.findUniqueOrThrow({ where: { id: experiment.id }, include: { steps: true } });
  const baselineVersion = JSON.stringify(version);
  await run({ kind: "project", ids: [project.id], operation: "edit", titles: [{ id: project.id, title: `${project.name}（已批量修改）` }], tags: { mode: "add", values: ["批量验收"] } }, ["edit"]);
  await run({ kind: "research_plan", ids: [plan.id], operation: "edit", status: "active", tags: { mode: "replace", values: ["合成替换标签"] } }, ["edit"]);
  await run({ kind: "protocol", ids: [protocol.id], operation: "edit", titles: [{ id: protocol.id, title: `${protocol.title}（新标题）` }] }, ["edit"]);
  const renamed = await prisma.protocol.findUniqueOrThrow({ where: { id: protocol.id } });
  assert.equal(renamed.title, renamed.canonicalTitle);
  assert.equal(JSON.stringify(await prisma.protocolVersion.findUniqueOrThrow({ where: { id: version.id } })), baselineVersion);
  await run({ kind: "experiment", ids: [experiment.id], operation: "edit", tags: { mode: "add", values: ["元数据测试"] } }, ["edit"]);
  const afterExperiment = await prisma.experiment.findUniqueOrThrow({ where: { id: experiment.id }, include: { steps: true } });
  assert.deepEqual(afterExperiment.protocolSnapshotJson, baselineExperiment.protocolSnapshotJson);
  assert.deepEqual(afterExperiment.steps, baselineExperiment.steps);
  assert.equal(afterExperiment.status, "running");
  checks.push("Five types use allowed metadata; protocol identity is consistent; frozen version, execution facts and snapshots unchanged.");

  const notesRequest = { kind: "result", ids: [result.id, locked.id], operation: "edit", appendNotes: "追加的合成验收备注" };
  const receipt = await run(notesRequest, ["edit", "skip"]);
  const retry = await applyCollectionBulk(notesRequest, receipt.preview.token, receipt.batchId);
  assert.deepEqual(retry, receipt.result);
  const edited = await prisma.result.findUniqueOrThrow({ where: { id: result.id } });
  assert.equal(edited.notes, "原始备注\n\n追加的合成验收备注");
  assert.equal(edited.numericValue, 12.5); assert.equal(edited.unit, "test-unit");
  assert.equal((await prisma.result.findUniqueOrThrow({ where: { id: locked.id } })).notes, "锁定备注");
  assert.equal(await prisma.activityLog.count({ where: { targetType: "result", targetId: result.id, metadataJson: { path: ["batchId"], equals: receipt.batchId } } }), 1);
  checks.push("Locked records skipped; retry returns the original result without duplicate notes/logs; scientific values unchanged.");

  const staleRequest = { kind: "result", ids: [result.id, locked.id], operation: "archive" };
  const stale = await previewCollectionBulk(staleRequest);
  await prisma.result.update({ where: { id: result.id }, data: { notes: "并发编辑后的备注" } });
  const stopped = await applyCollectionBulk(staleRequest, stale.token, randomUUID());
  assert.equal(stopped.applied, false);
  assert.equal((await prisma.result.findUniqueOrThrow({ where: { id: locked.id } })).status, "active");
  checks.push("A changed preview stops all writes and returns a refreshed plan.");

  // A database-triggered second-row failure proves the first row and its log also roll back.
  const rollbackResult = await prisma.result.create({ data: { title: "合成回滚验证", resultType: "Observation", notes: "before" } });
  await prisma.$executeRawUnsafe('CREATE OR REPLACE FUNCTION cb_test_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.title = \'Synthetic forced failure\' THEN RAISE EXCEPTION \'synthetic test failure\'; END IF; RETURN NEW; END $$');
  await prisma.$executeRawUnsafe('CREATE TRIGGER cb_test_failure_trigger BEFORE UPDATE ON "Result" FOR EACH ROW EXECUTE FUNCTION cb_test_failure()');
  try {
    const input = { kind: "result", ids: [result.id, rollbackResult.id], operation: "edit", appendNotes: "must roll back", titles: [{ id: rollbackResult.id, title: "Synthetic forced failure" }] };
    const preview = await previewCollectionBulk(input);
    await assert.rejects(applyCollectionBulk(input, preview.token, randomUUID()));
    assert.equal((await prisma.result.findUniqueOrThrow({ where: { id: result.id } })).notes, "并发编辑后的备注");
  } finally {
    await prisma.$executeRawUnsafe('DROP TRIGGER cb_test_failure_trigger ON "Result"');
    await prisma.$executeRawUnsafe('DROP FUNCTION cb_test_failure()');
  }
  checks.push("Unexpected second-row failure rolls back the entire batch.");

  await run({ kind: "experiment", ids: [experiment.id], operation: "archive" }, ["archive"]);
  await run({ kind: "experiment", ids: [experiment.id], operation: "archive" }, ["noop"]);
  await run({ kind: "experiment", ids: [experiment.id], operation: "restore" }, ["restore"]);
  assert.equal((await prisma.experiment.findUniqueOrThrow({ where: { id: experiment.id } })).status, "running");
  assert.equal((await prisma.protocolRun.findUniqueOrThrow({ where: { experimentId: experiment.id } })).status, "planned");
  const old = await previewCollectionBulk({ kind: "result", ids: [oldArchive.id], operation: "restore" });
  assert.equal(old.rows[0].needsStatus, true);
  await assert.rejects(applyCollectionBulk({ kind: "result", ids: [oldArchive.id], operation: "restore" }, old.token, randomUUID()));
  await run({ kind: "result", ids: [oldArchive.id], operation: "restore", restoreStatuses: { [oldArchive.id]: "inactive" } }, ["restore"]);
  checks.push("Archive is idempotent; experiment and run restore their own prior statuses; old archives require an explicit valid status.");

  const emptyProject = await prisma.project.create({ data: { name: `合成待回收空项目 ${stamp}` } });
  await run({ kind: "project", ids: [emptyProject.id, project.id], operation: "delete" }, ["recycle", "archive"]);
  assert.equal(await prisma.project.findUnique({ where: { id: emptyProject.id } }), null);
  assert.equal((await prisma.researchPlan.findUniqueOrThrow({ where: { id: plan.id } })).status, "active");
  const emptyDeleted = await prisma.deletedRecord.findFirstOrThrow({ where: { targetId: emptyProject.id, restoredAt: null } });
  await restoreDeletedRecord(emptyDeleted.id);
  assert(await prisma.project.findUnique({ where: { id: emptyProject.id } }));
  await run({ kind: "project", ids: [project.id], operation: "restore" });
  await run({ kind: "experiment", ids: [experiment.id], operation: "delete" }, ["archive"]);
  await run({ kind: "experiment", ids: [experiment.id], operation: "restore" });
  for (const [kind, id] of [["research_plan", plan.id], ["protocol", protocol.id]] as const) {
    await run({ kind, ids: [id], operation: "delete" }, ["retain_recycle"]);
    const deleted = await prisma.deletedRecord.findFirstOrThrow({ where: { targetType: kind, targetId: id, restoredAt: null } });
    await restoreDeletedRecord(deleted.id);
  }
  const asset = await prisma.attachment.create({ data: { filename: `synthetic-${stamp}.txt`, originalFilename: "合成附件.txt", mimeType: "text/plain", size: 9, storagePath: `collections-${stamp}.txt` } });
  await mkdir("storage/attachments", { recursive: true }); await writeFile(`storage/attachments/collections-${stamp}.txt`, "synthetic");
  await prisma.attachmentLink.create({ data: { attachmentId: asset.id, targetType: "result", targetId: result.id } });
  await run({ kind: "result", ids: [result.id], operation: "delete" }, ["retain_recycle"]);
  assert(await prisma.attachment.findUnique({ where: { id: asset.id } }));
  assert.equal(await prisma.attachmentLink.count({ where: { attachmentId: asset.id } }), 1);
  const resultDeleted = await prisma.deletedRecord.findFirstOrThrow({ where: { targetId: result.id, restoredAt: null } });
  await restoreDeletedRecord(resultDeleted.id);
  const disposablePlan = await prisma.researchPlan.create({ data: { projectId: project.id, code: `RPL-DELETE-${stamp}`, title: "合成可回收方案" } });
  const disposableProtocol = await prisma.protocol.create({ data: { humanCode: `PRT-DELETE-${stamp}`, title: "合成可回收规程" } });
  const disposableExperiment = await prisma.experiment.create({ data: { runCode: `EXP-DELETE-${stamp}`, title: "合成可回收实验" } });
  const disposableResult = await prisma.result.create({ data: { title: "合成可回收结果", resultType: "Observation" } });
  for (const [kind, id] of [["research_plan", disposablePlan.id], ["protocol", disposableProtocol.id], ["experiment", disposableExperiment.id], ["result", disposableResult.id]] as const) {
    await run({ kind, ids: [id], operation: "delete" }, ["recycle"]);
    const deleted = await prisma.deletedRecord.findFirstOrThrow({ where: { targetType: kind, targetId: id, restoredAt: null } });
    await restoreDeletedRecord(deleted.id);
  }
  checks.push("All five types recycle and restore; project/experiment blockers fall back to archive; associated records and original attachment assets are retained.");

  const many = Array.from({ length: 500 }, (_, i) => ({ id: `cb-${stamp}-${i}`, name: `合成 500 条选择测试 ${String(i + 1).padStart(3, "0")}`, tags: ["500条测试"] }));
  await prisma.project.createMany({ data: many });
  const large = await run({ kind: "project", ids: many.map(row => row.id), operation: "edit", tags: { mode: "add", values: ["批量500已验证"] } });
  assert.equal(large.preview.rows.filter(row => row.outcome === "edit").length, 500);
  assert.equal(await prisma.project.count({ where: { id: { in: many.map(row => row.id) }, tags: { has: "批量500已验证" } } }), 500);
  await assert.rejects(previewCollectionBulk({ kind: "project", ids: [...many.map(row => row.id), project.id], operation: "archive" }));
  checks.push("500-record transaction readback succeeds; 501 records rejected without truncation.");
  const fixture = { synthetic: true, projectId: project.id, planId: plan.id, protocolId: protocol.id, versionId: version.id, experimentId: experiment.id, resultId: result.id, lockedResultId: locked.id, oldArchiveId: oldArchive.id, reportId: report.id, entryId: entry.id, manyIds: many.map(row => row.id), checks };
  await writeFile(`${output}/fixtures.json`, JSON.stringify(fixture, null, 2));
  console.log(JSON.stringify({ passed: checks.length, checks }, null, 2));
}
main().finally(() => prisma.$disconnect());
