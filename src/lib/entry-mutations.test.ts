import { describe, expect, it } from "vitest";
import { parseEntryMutationFormData } from "@/lib/entry-mutations";

function baseEntryForm() {
  const formData = new FormData();
  formData.set("title", "Microscopy observation");
  formData.set("contentMarkdown", "Cells retained normal morphology.");
  formData.set("occurredAt", "2026-09-03T10:00:00.000Z");
  return formData;
}

describe("parseEntryMutationFormData", () => {
  it("keeps optional initial Result creation explicit", () => {
    const formData = baseEntryForm();
    formData.set("createInitialResult", "true");
    formData.set("protocolVersionId", "protocol-version-1");
    formData.set("resultTitle", "Microscopy result");
    formData.set("resultType", "observation");

    const parsed = parseEntryMutationFormData(formData);

    expect(parsed.createInitialResult).toBe(true);
    expect(parsed.resultTitle).toBe("Microscopy result");
    expect(parsed.resultType).toBe("observation");
    expect(parsed.contentMarkdown).toContain("normal morphology");
  });

  it("does not create a Result by default", () => {
    expect(parseEntryMutationFormData(baseEntryForm()).createInitialResult).toBe(false);
  });

  it("rejects initial Result creation without a Protocol-based Experiment", () => {
    const formData = baseEntryForm();
    formData.set("createInitialResult", "true");
    expect(() => parseEntryMutationFormData(formData)).toThrow("Choose a Protocol version");
  });
});
