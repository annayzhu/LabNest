import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { prisma } from "../src/lib/db";
assert(new URL(process.env.DATABASE_URL!).pathname.startsWith("/labnest_test_collections_"));
async function main() {
  const path = ".local-runtime/collections-20261104/fixtures.json";
  const f = JSON.parse(await readFile(path, "utf8"));
  await prisma.project.update({ where: { id: f.projectId }, data: { name: "合成验收项目 — 五类列表多选批量操作与关联保护（仅软件测试）" } });
  await prisma.researchPlan.update({ where: { id: f.planId }, data: { title: "合成研究方案 — 标题、状态与标签批量修改验收" } });
  await prisma.protocol.update({ where: { id: f.protocolId }, data: { title: "合成多体系规程 — 长条件名称、范围值与打印一致性验收", canonicalTitle: "合成多体系规程 — 长条件名称、范围值与打印一致性验收" } });
  await prisma.experiment.update({ where: { id: f.experimentId }, data: { title: "合成实验 — 含执行事实，批量删除应预览为归档" } });
  await prisma.result.update({ where: { id: f.resultId }, data: { title: "合成结果 — 数值单位保留，备注仅追加" } });
  const recyclable = await prisma.result.create({ data: { title: "合成可回收条目 — 验收删除与回收站恢复", resultType: "Observation", metadataJson: { synthetic: true } } });
  f.finalRecycleId = recyclable.id;
  f.finalOldArchiveId = (await prisma.result.create({ data: { title: "合成旧归档结果 — 恢复时需选择状态", resultType: "Observation", status: "archived", metadataJson: { synthetic: true } } })).id;
  assert.equal(await prisma.project.count({ where: { id: { in: f.manyIds } } }), 500);
  const result = await prisma.result.findUniqueOrThrow({ where: { id: f.resultId } });
  assert.equal(result.numericValue, 12.5); assert.equal(result.unit, "test-unit");
  assert.equal((await prisma.protocolVersion.findUniqueOrThrow({ where: { id: f.versionId } })).title, "Frozen synthetic version title");
  await writeFile(path, JSON.stringify(f, null, 2));
  console.log("Acceptance data has readable synthetic names, a 500-row collection, locked cases, an old archive and a recoverable record.");
}
main().finally(() => prisma.$disconnect());
