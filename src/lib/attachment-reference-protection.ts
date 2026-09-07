import type { Prisma } from "@/generated/prisma/client";

/** Association and physical deletion serialize on the same original-file rows. */
export async function lockAttachmentOriginals(tx: Prisma.TransactionClient, ids: string[]) {
  for (const id of [...new Set(ids)].sort()) await tx.$queryRaw`SELECT id FROM "Attachment" WHERE id = ${id} FOR UPDATE`;
}

/** Old snapshots predate indexed links. Check existence in PostgreSQL, without loading the corpus. */
export async function hasLegacyDocumentReference(tx: Prisma.TransactionClient, id: string) {
  const [result] = await tx.$queryRaw<Array<{ used: boolean }>>`SELECT
    EXISTS (SELECT 1 FROM "ProtocolVersion" WHERE strpos("contentJson"::text, ${id}) > 0) OR
    EXISTS (SELECT 1 FROM "ResearchPlan" WHERE strpos("contentJson"::text, ${id}) > 0) OR
    EXISTS (SELECT 1 FROM "Experiment" WHERE strpos("contentJson"::text, ${id}) > 0 OR strpos("protocolSnapshotJson"::text, ${id}) > 0) OR
    EXISTS (SELECT 1 FROM "Entry" WHERE strpos("contentJson"::text, ${id}) > 0) OR
    EXISTS (SELECT 1 FROM "Result" WHERE strpos("contentJson"::text, ${id}) > 0 OR strpos("templateSnapshotJson"::text, ${id}) > 0) OR
    EXISTS (SELECT 1 FROM "Report" WHERE strpos("contentJson"::text, ${id}) > 0 OR strpos("sourceSnapshotJson"::text, ${id}) > 0) OR
    EXISTS (SELECT 1 FROM "DeletedRecord" WHERE strpos("snapshotJson"::text, ${id}) > 0)
    AS used`;
  return result.used;
}
