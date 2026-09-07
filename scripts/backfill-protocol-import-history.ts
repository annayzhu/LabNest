import { prisma } from "../src/lib/db";
import { separateLegacyImportWarnings } from "../src/lib/protocol-import-state";

/** Add evidence only. Never rewrites versions, current states or Run snapshots. */
async function main() {
  let archived = 0;
  let cursor: string | undefined;
  while (true) {
    const versions = await prisma.protocolVersion.findMany({ take: 100, orderBy: { id: "asc" }, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), select: { id: true, protocolId: true, sourceFileName: true, sourceFileChecksum: true, sourceImportedAt: true, contentJson: true } });
    if (!versions.length) break;
    for (const version of versions) {
      const content = version.contentJson as Record<string, unknown>;
      const issues = separateLegacyImportWarnings(Array.isArray(content?.importWarnings) ? content.importWarnings.filter((value): value is string => typeof value === "string") : []).history;
      if (!issues.length) continue;
      const id = `protocol-import-legacy:${version.id}`;
      if (await prisma.activityLog.findUnique({ where: { id }, select: { id: true } })) continue;
      const logs = await prisma.activityLog.findMany({ where: { targetType: "protocol", targetId: version.protocolId, action: { in: ["structured_import", "import_docx"] } }, orderBy: { createdAt: "asc" } });
      const source = logs.find((log) => {
        const metadata = log.metadataJson as Record<string, unknown> | null;
        return metadata?.protocolVersionId === version.id || (!metadata?.protocolVersionId && version.sourceFileChecksum && metadata?.sourceFileChecksum === version.sourceFileChecksum);
      });
      // Deterministic identity + empty update makes retries/concurrent deployments non-destructive.
      await prisma.activityLog.upsert({ where: { id }, update: {}, create: {
        id, action: "protocol_import_legacy", targetType: "protocol", targetId: version.protocolId, actorUserId: null,
        metadataJson: { protocolVersionId: version.id, sourceFileName: version.sourceFileName, sourceFileChecksum: version.sourceFileChecksum,
          legacyImport: { issues, sourceImportedAt: (source?.createdAt ?? version.sourceImportedAt)?.toISOString() ?? null, sourceActorUserId: source?.actorUserId ?? null, sourceAuditId: source?.id ?? null } },
      } });
      archived++;
    }
    cursor = versions.at(-1)!.id;
  }
  console.log(`Protocol import history: ${archived} legacy records archived; source documents unchanged.`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
