import { describe, expect, it } from "vitest";
import { migrateEntryDraftFields } from "./entry-draft-migration";

const baseline = {
  contentMarkdown: "Observation",
  protocolVersionId: "",
  createInitialResult: "false",
  resultTitle: "",
  resultType: "",
  title: "Entry",
};

describe("migrateEntryDraftFields", () => {
  it("moves legacy Result text into visible rich Entry content", () => {
    const migrated = migrateEntryDraftFields(baseline, {
      resultTextValue: "Cells recovered.",
      resultNotes: "Repeat tomorrow.",
    });
    expect(migrated.migratedLegacyResult).toBe(true);
    expect(migrated.fields.contentMarkdown).toContain("## Recovered initial result");
    expect(migrated.fields.contentMarkdown).toContain("Cells recovered.");
    expect(migrated.fields.contentMarkdown).toContain("Repeat tomorrow.");
    expect(migrated.fields).not.toHaveProperty("resultTextValue");
  });

  it("retains initial Result creation intent when a Protocol version exists", () => {
    const migrated = migrateEntryDraftFields(baseline, {
      protocolVersionId: "protocol-version-1",
      resultTitle: "Recovered result",
      resultType: "observation",
    });
    expect(migrated.fields.createInitialResult).toBe("true");
  });
});
