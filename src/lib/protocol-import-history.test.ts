import { describe, expect, it } from "vitest";
import { readProtocolImportHistory } from "./protocol-import-history";
import { separateLegacyImportWarnings } from "./protocol-import-state";

describe("Protocol import history", () => {
  it("projects a legacy conflict as unverified history without changing the version or unrelated warnings", () => {
    const originalText = "Filename availability draft does not match document availability active.";
    const version = { id: "version-1", sourceFileName: "source_Draft.docx", sourceFileChecksum: "abc", sourceImportedAt: new Date("2026-08-01T00:00:00Z"), contentJson: { importWarnings: [originalText, "Empty required sections: Purpose."] } };
    const before = JSON.stringify(version);
    const history = readProtocolImportHistory([version], []);
    expect(history).toEqual([expect.objectContaining({ protocolVersionId: "version-1", decision: null, actorUserId: null, issues: [expect.objectContaining({ resolution: "legacy_unverified", importedValue: null, originalText })] })]);
    expect(separateLegacyImportWarnings(version.contentJson.importWarnings).contentWarnings).toEqual(["Empty required sections: Purpose."]);
    expect(JSON.stringify(version)).toBe(before);
  });
  it("retains archived legacy evidence when editable document warnings disappear", () => {
    const originalText = "Filename availability draft does not match document availability active.";
    const version = { id: "v", sourceFileName: null, sourceFileChecksum: "abc", sourceImportedAt: null, contentJson: {} };
    const history = readProtocolImportHistory([version], [{ id: "audit", actorUserId: null, createdAt: new Date(), metadataJson: { protocolVersionId: "v", legacyImport: { issues: separateLegacyImportWarnings([originalText]).history, sourceImportedAt: null, sourceActorUserId: null } } }]);
    expect(history[0].issues[0].originalText).toBe(originalText);
    expect(history[0].importedAt).toBeNull();
    expect(history[0].decision).toBeNull();
  });
  it("does not trust incomplete persisted decisions", () => {
    const version = { id: "v", sourceFileName: "old.docx", sourceFileChecksum: null, sourceImportedAt: null, contentJson: {} };
    expect(() => readProtocolImportHistory([version], [{ id: "audit", actorUserId: null, createdAt: new Date(), metadataJson: { protocolVersionId: "v", protocolImport: { confirmation: "preview_confirmed", decision: { policyVersion: "protocol-draft-v1" } } } }])).not.toThrow();
  });
});
