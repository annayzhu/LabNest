import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { prisma } from "../src/lib/db";
import { previewCollectionBulk, applyCollectionBulk } from "../src/lib/collection-bulk.server";
assert(new URL(process.env.DATABASE_URL!).pathname.startsWith("/labnest_test_collections_"));
async function main() {
  const record = await prisma.result.create({ data: { title: "合成不同批次并发验证", resultType: "Observation", notes: "original" } });
  const requests = ["first", "second"].map(appendNotes => ({ kind: "result", ids: [record.id], operation: "edit", appendNotes }));
  const previews = await Promise.all(requests.map(previewCollectionBulk));
  const batchIds = [randomUUID(), randomUUID()];
  const results = await Promise.all(requests.map((request, index) => applyCollectionBulk(request, previews[index].token, batchIds[index])));
  assert.equal(results.filter(result => result.applied).length, 1);
  const stoppedIndex = results.findIndex(result => !result.applied);
  const stopped = results[stoppedIndex]; assert(!stopped.applied);
  const afterFirst = await prisma.result.findUniqueOrThrow({ where: { id: record.id } });
  assert.equal(stopped.preview.rows[0].before?.notes, afterFirst.notes);
  assert.equal(await prisma.activityLog.count({ where: { targetType: "collection_bulk", targetId: batchIds[stoppedIndex] } }), 0);
  const confirmed = await applyCollectionBulk(requests[stoppedIndex], stopped.preview.token, batchIds[stoppedIndex]);
  assert(confirmed.applied);
  await applyCollectionBulk(requests[stoppedIndex], stopped.preview.token, batchIds[stoppedIndex]);
  const final = await prisma.result.findUniqueOrThrow({ where: { id: record.id } });
  assert.equal(final.notes?.split("first").length, 2); assert.equal(final.notes?.split("second").length, 2);
  await writeFile(".local-runtime/collections-20261104/concurrency.json", JSON.stringify({ passed: true, oneBatchStopped: true, previewAutomaticallyRefreshed: true, confirmationPreservesBothNotes: true, retryDoesNotAppendAgain: true }, null, 2));
  console.log("Different concurrent batches: one commits; the other returns a fresh preview without writing, then confirms safely. Retry remains idempotent.");
}
main().finally(() => prisma.$disconnect());
