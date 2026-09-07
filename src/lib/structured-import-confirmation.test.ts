import { describe, expect, it } from "vitest";
import { parseStructuredFile } from "./structured-files";
import { createImportConfirmation, matchesImportConfirmation } from "./structured-import-confirmation";

describe("import confirmation", () => {
  it("binds the confirmed decision to bytes, filename and final states", async () => {
    const parsed = await parseStructuredFile(new File(['[{"canonicalTitle":"QC","availability":"active"}]'], "batch.json"), "protocols");
    const token = createImportConfirmation(parsed);
    expect(matchesImportConfirmation(parsed, token)).toBe(true);
    expect(matchesImportConfirmation({ ...parsed, fileName: "renamed.json" }, token)).toBe(false);
    expect(matchesImportConfirmation({ ...parsed, checksum: "changed" }, token)).toBe(false);
    expect(matchesImportConfirmation({ ...parsed, protocolDecisions: [] }, token)).toBe(false);
    expect(matchesImportConfirmation(parsed, "")).toBe(false);
  });
});
