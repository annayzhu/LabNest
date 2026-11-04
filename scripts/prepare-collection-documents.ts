import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { prisma } from "../src/lib/db";
import { exportProtocolDocx } from "../src/lib/protocol-docx-export";
import { normalizeProtocolDocument } from "../src/lib/protocol-document";
assert(new URL(process.env.DATABASE_URL!).pathname.startsWith("/labnest_test_collections_"));
async function main() {
  const output = ".local-runtime/collections-20261104";
  const f = JSON.parse(await readFile(`${output}/fixtures.json`, "utf8"));
  const version = await prisma.protocolVersion.findUniqueOrThrow({ where: { id: f.versionId } });
  const document = normalizeProtocolDocument(version.contentJson)!;
  const bytes = exportProtocolDocx({ canonicalTitle: `合成 Word 导入验收 ${Date.now()}`, availability: "draft", reviewStage: "draft", displayVersion: "0.1", scope: "general", tags: ["合成验收"] }, document);
  await writeFile(`${output}/synthetic-protocol.docx`, bytes);
  console.log("Prepared a synthetic Word source with long conditions, tables, ranges and parameters for real import verification.");
}
main().finally(() => prisma.$disconnect());
