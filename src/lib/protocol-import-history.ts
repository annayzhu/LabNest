import { readImportDecision, readImportIssues, separateLegacyImportWarnings, type ProtocolImportDecision, type ProtocolImportIssue } from "./protocol-import-state";

type VersionEvidence = { id: string; sourceFileName: string | null; sourceFileChecksum: string | null; sourceImportedAt: Date | null; contentJson: unknown };
type AuditEvidence = { id: string; actorUserId: string | null; createdAt: Date; metadataJson: unknown };
export type ProtocolImportHistoryEntry = {
  id: string;
  protocolVersionId: string;
  sourceFileName: string | null;
  sourceFileChecksum: string | null;
  sourceAttachmentId: string | null;
  importedAt: string | null;
  actorUserId: string | null;
  decision: ProtocolImportDecision | null;
  issues: ProtocolImportIssue[];
};
function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

/** Read model only: current Protocol state is intentionally not an input to historical facts. */
export function readProtocolImportHistory(versions: VersionEvidence[], logs: AuditEvidence[]): ProtocolImportHistoryEntry[] {
  return versions.flatMap((version) => {
    const audit = logs.find((log) => object(log.metadataJson).protocolVersionId === version.id)
      ?? logs.find((log) => !object(log.metadataJson).protocolVersionId && version.sourceFileChecksum && object(log.metadataJson).sourceFileChecksum === version.sourceFileChecksum);
    const metadata = object(audit?.metadataJson);
    const imported = object(metadata.protocolImport);
    const decision = imported.confirmation === "preview_confirmed" ? readImportDecision(imported.decision) : null;
    const archivedAudit = logs.find((log) => object(log.metadataJson).protocolVersionId === version.id && object(log.metadataJson).legacyImport);
    const archived = object(object(archivedAudit?.metadataJson).legacyImport);
    const warnings = object(version.contentJson).importWarnings;
    const legacy = separateLegacyImportWarnings(Array.isArray(warnings) ? warnings.filter((value): value is string => typeof value === "string") : []).history;
    if (!version.sourceFileName && !decision && !legacy.length && !archivedAudit) return [];
    return [{
      id: audit?.id ?? `legacy-${version.id}`, protocolVersionId: version.id,
      sourceFileName: typeof metadata.sourceFileName === "string" ? metadata.sourceFileName : version.sourceFileName,
      sourceFileChecksum: typeof metadata.sourceFileChecksum === "string" ? metadata.sourceFileChecksum : version.sourceFileChecksum,
      sourceAttachmentId: typeof imported.sourceAttachmentId === "string" ? imported.sourceAttachmentId : null,
      importedAt: archivedAudit && !decision ? (typeof archived.sourceImportedAt === "string" ? archived.sourceImportedAt : null) : (audit?.createdAt ?? version.sourceImportedAt)?.toISOString() ?? null,
      actorUserId: archivedAudit && !decision ? (typeof archived.sourceActorUserId === "string" ? archived.sourceActorUserId : null) : audit?.actorUserId ?? null, decision,
      issues: decision ? [...decision.issues, ...readImportIssues(imported.legacyIssues)] : archivedAudit ? readImportIssues(archived.issues) : legacy,
    }];
  });
}
