import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { prisma } from "../src/lib/db";
import { previewCollectionBulk, applyCollectionBulk } from "../src/lib/collection-bulk.server";
assert(new URL(process.env.DATABASE_URL!).pathname.startsWith("/labnest_test_collections_"));
const path = ".local-runtime/collections-20261104/fixtures.json";
async function main() {
  const f = JSON.parse(await readFile(path, "utf8"));
  const result = await prisma.result.findUniqueOrThrow({ where: { id: f.resultId } });
  assert.equal(result.numericValue, 12.5); assert.equal(result.unit, "test-unit");
  assert.deepEqual(result.valuesJson, { syntheticValue: 12.5 });
  assert.equal((await prisma.result.findUniqueOrThrow({ where: { id: f.lockedResultId } })).notes, "锁定备注");
  for (const record of [await prisma.project.findUniqueOrThrow({ where: { id: f.projectId } }), await prisma.researchPlan.findUniqueOrThrow({ where: { id: f.planId } }), await prisma.protocol.findUniqueOrThrow({ where: { id: f.protocolId } }), await prisma.experiment.findUniqueOrThrow({ where: { id: f.experimentId } }), result]) assert(("name" in record ? record.name : record.title).includes(" — UI verified"));
  const concurrent = await prisma.result.create({ data: { title: "合成并行重试验证", resultType: "Observation", notes: "original" } });
  const input = { kind: "result", ids: [concurrent.id], operation: "edit", appendNotes: "append once" };
  const preview = await previewCollectionBulk(input); const batchId = randomUUID();
  const responses = await Promise.all([applyCollectionBulk(input, preview.token, batchId), applyCollectionBulk(input, preview.token, batchId)]);
  assert(responses.every(row => row.applied));
  assert.equal((await prisma.result.findUniqueOrThrow({ where: { id: concurrent.id } })).notes, "original\n\nappend once");
  const type = await prisma.scientificSchemaDefinition.upsert({ where: { key: "cb-synthetic-sample" }, create: { key: "cb-synthetic-sample", label: "合成验收样本", objectKind: "sample", prefix: "CBS" }, update: {} });
  const sample = await prisma.sample.create({ data: { code: `CBS-${Date.now()}`, name: "合成长名称样本 — 列表与编辑区排版验收", typeId: type.id, projectId: f.projectId, amount: 10, amountUnit: "µL" } });
  const dependentProject = await prisma.project.create({ data: { name: `合成依赖复核 ${randomUUID()}` } });
  const deletion = { kind: "project", ids: [dependentProject.id], operation: "delete" };
  const beforeReference = await previewCollectionBulk(deletion);
  await prisma.sample.create({ data: { code: `CBS-${randomUUID()}`, name: "合成新关联", typeId: type.id, projectId: dependentProject.id } });
  const stopped = await applyCollectionBulk(deletion, beforeReference.token, randomUUID(), "1");
  assert(!stopped.applied && stopped.preview.rows[0].outcome === "archive");
  assert.equal((await prisma.project.findUniqueOrThrow({ where: { id: dependentProject.id } })).status, "active");
  const lockedProtocol = await prisma.protocol.create({ data: { humanCode: `PRT-LOCK-${randomUUID()}`, title: "合成审核规程", recordStatus: "reviewed", tags: ["keep"] } });
  const lockedExperiment = await prisma.experiment.create({ data: { runCode: `EXP-LOCK-${randomUUID()}`, title: "合成提交实验", recordStatus: "submitted", tags: ["keep"] } });
  for (const [kind, id] of [["protocol", lockedProtocol.id], ["experiment", lockedExperiment.id]]) {
    const lockedInput = { kind, ids: [id], operation: "edit", tags: { mode: "replace", values: ["must not change"] } };
    const lockedPreview = await previewCollectionBulk(lockedInput);
    assert.equal(lockedPreview.rows[0].outcome, "skip");
    await applyCollectionBulk(lockedInput, lockedPreview.token, randomUUID());
  }
  assert.deepEqual((await prisma.protocol.findUniqueOrThrow({ where: { id: lockedProtocol.id } })).tags, ["keep"]);
  assert.deepEqual((await prisma.experiment.findUniqueOrThrow({ where: { id: lockedExperiment.id } })).tags, ["keep"]);
  f.sampleId = sample.id;
  f.inventoryId = (await prisma.inventoryItem.findFirstOrThrow()).id;
  f.protocolVersionHash = createHash("sha256").update(JSON.stringify(await prisma.protocolVersion.findUniqueOrThrow({ where: { id: f.versionId } }))).digest("hex");
  await writeFile(path, JSON.stringify(f, null, 2));
  console.log("Passed UI data readback, scientific-field preservation, locks on all applicable types, simultaneous retry idempotency, new-dependency preview invalidation, and synthetic audit fixtures.");
}
main().finally(() => prisma.$disconnect());
