import { prisma } from "./db";
import { readProtocolImportHistory } from "./protocol-import-history";

export async function getProtocolImportHistory(protocolId: string) {
  const [versions, logs] = await Promise.all([
    prisma.protocolVersion.findMany({ where: { protocolId }, orderBy: { revision: "asc" }, select: { id: true, sourceFileName: true, sourceFileChecksum: true, sourceImportedAt: true, contentJson: true } }),
    prisma.activityLog.findMany({ where: { targetType: "protocol", targetId: protocolId, action: { in: ["structured_import", "import_docx", "protocol_import_legacy"] } }, orderBy: { createdAt: "asc" } }),
  ]);
  return readProtocolImportHistory(versions, logs);
}
